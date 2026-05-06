"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/AppShell";
import { api, syncDeleteTaskOnUnload } from "@/lib/api-client";
import { dismiss as dismissToast, toast } from "@/lib/toast";
import type {
  Scope,
  SlotNumber,
  Task,
  TeamMember,
  TopPriority,
} from "@/lib/types";

const POLL_INTERVAL_MS = 5000;

// Shared task + priority state machine. Used by /internal, /management, /digital.
//
// Replaces the previous Supabase-realtime model with API + polling. The
// browser no longer holds the anon key; every CRUD round-trips through
// /api/* routes (service_role server-side). Polling refreshes state every
// POLL_INTERVAL_MS but is paused while local mutations are in flight so a
// poll never clobbers an optimistic update.
//
// Each page wraps `setTasks` to plug in its own create handler — different
// scopes need different insert payloads.
export function useScopedTasks(scope: Scope) {
  const { currentUser } = useApp();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [priorities, setPriorities] = useState<TopPriority[]>([]);

  const [pendingDeletes, setPendingDeletes] = useState<Map<string, Task>>(
    new Map()
  );
  const [recentlyDeletingIds, setRecentlyDeletingIds] = useState<Set<string>>(
    new Set()
  );
  const deleteCommitTimersRef = useRef<
    Map<string, ReturnType<typeof setTimeout>>
  >(new Map());
  const deleteToastIdRef = useRef<string | null>(null);

  // Pause polling while user-driven mutations are in flight to prevent
  // a fresh GET from overwriting in-progress optimistic updates.
  const inflightRef = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const [tasksRes, prioritiesRes] = await Promise.all([
        api.get<{ tasks: Task[] }>(`/api/tasks?scope=${scope}`),
        api.get<{ priorities: TopPriority[] }>(
          `/api/priorities?scope=${scope}`
        ),
      ]);
      // Merge: drop tasks that are pending soft-delete from the fetched
      // list so they don't visibly reappear during the undo window.
      setTasks(tasksRes.tasks);
      setPriorities(prioritiesRes.priorities);
    } catch (err) {
      console.error("[scoped-tasks] refresh failed:", err);
    }
  }, [scope]);

  // Initial load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [tasksRes, prioritiesRes] = await Promise.all([
          api.get<{ tasks: Task[] }>(`/api/tasks?scope=${scope}`),
          api.get<{ priorities: TopPriority[] }>(
            `/api/priorities?scope=${scope}`
          ),
        ]);
        if (cancelled) return;
        setTasks(tasksRes.tasks);
        setPriorities(prioritiesRes.priorities);
      } catch (err) {
        if (cancelled) return;
        console.error("[scoped-tasks] initial load failed:", err);
        toast.error("Couldn't load tasks");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scope]);

  // Polling loop. Refresh every 5s when no mutation is in flight.
  // Pauses when the document is hidden so we don't poll background tabs.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      if (document.visibilityState !== "visible") return;
      if (inflightRef.current > 0) return;
      await refresh();
    };
    const handle = setInterval(tick, POLL_INTERVAL_MS);
    // Refresh immediately on tab return.
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(handle);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  // Wraps mutations so polling is paused during the round trip.
  const inflight = useCallback(async <T>(fn: () => Promise<T>): Promise<T> => {
    inflightRef.current++;
    try {
      return await fn();
    } finally {
      inflightRef.current--;
    }
  }, []);

  const patchTask = useCallback(
    async (id: string, patch: Partial<Task>) => {
      let previous: Task | undefined;
      setTasks((prev) => {
        previous = prev.find((t) => t.id === id);
        return prev.map((t) => (t.id === id ? { ...t, ...patch } : t));
      });
      try {
        await inflight(() => api.patch(`/api/tasks/${id}`, patch));
      } catch (err) {
        console.error("[tasks] update error:", err);
        toast.error("Update failed");
        if (previous) {
          const snapshot = previous;
          setTasks((prev) => prev.map((t) => (t.id === id ? snapshot : t)));
        }
      }
    },
    [inflight]
  );

  const handleToggleDone = useCallback(
    (id: string, nextDone: boolean) =>
      patchTask(id, { status: nextDone ? "Done" : "Todo" }),
    [patchTask]
  );

  const handleUpdateTitle = useCallback(
    (id: string, title: string) => patchTask(id, { title }),
    [patchTask]
  );

  const handleUpdateOwner = useCallback(
    (id: string, owner: TeamMember) => patchTask(id, { owner }),
    [patchTask]
  );

  const handleTogglePin = useCallback(
    async (taskId: string, isCurrentlyPinned: boolean) => {
      if (isCurrentlyPinned) {
        const existing = priorities.find((p) => p.task_id === taskId);
        if (!existing) return;
        const slot = existing.slot;
        setPriorities((prev) => prev.filter((p) => p.slot !== slot));
        try {
          await inflight(() =>
            api.del(`/api/priorities?scope=${scope}&slot=${slot}`)
          );
        } catch (err) {
          console.error("[priorities] unpin error:", err);
          toast.error("Couldn't unpin");
          setPriorities((prev) =>
            prev.some((p) => p.slot === slot)
              ? prev
              : [...prev, existing].sort((a, b) => a.slot - b.slot)
          );
        }
        return;
      }

      const used = new Set(priorities.map((p) => p.slot));
      const slot = ([1, 2, 3] as SlotNumber[]).find((s) => !used.has(s));
      if (!slot) {
        toast.info("Top 3 full — unpin one first");
        return;
      }
      const optimistic: TopPriority = {
        scope,
        slot,
        task_id: taskId,
        pinned_at: new Date().toISOString(),
        pinned_by: currentUser,
      };
      setPriorities((prev) =>
        [...prev.filter((p) => p.slot !== slot), optimistic].sort(
          (a, b) => a.slot - b.slot
        )
      );
      try {
        await inflight(() =>
          api.post("/api/priorities", {
            scope,
            slot,
            task_id: taskId,
            pinned_by: currentUser,
          })
        );
      } catch (err) {
        console.error("[priorities] pin error:", err);
        toast.error("Couldn't pin");
        setPriorities((prev) => prev.filter((p) => p.slot !== slot));
      }
    },
    [priorities, currentUser, scope, inflight]
  );

  const handleReorderPriorities = useCallback(
    async (from: SlotNumber, to: SlotNumber) => {
      if (from === to) return;
      const snap = priorities;
      setPriorities((prev) =>
        prev
          .map((p) => {
            if (p.slot === from) return { ...p, slot: to };
            if (p.slot === to) return { ...p, slot: from };
            return p;
          })
          .sort((a, b) => a.slot - b.slot)
      );
      try {
        await inflight(() =>
          api.post("/api/priorities/swap", { scope, from, to })
        );
      } catch (err) {
        console.error("[priorities] reorder error:", err);
        toast.error("Couldn't reorder");
        setPriorities(snap);
      }
    },
    [priorities, scope, inflight]
  );

  const commitPendingDelete = useCallback(
    async (id: string, task: Task) => {
      const t = deleteCommitTimersRef.current.get(id);
      if (t) clearTimeout(t);
      deleteCommitTimersRef.current.delete(id);
      setPendingDeletes((m) => {
        const next = new Map(m);
        next.delete(id);
        return next;
      });
      setTasks((prev) => prev.filter((x) => x.id !== id));
      try {
        await inflight(() => api.del(`/api/tasks/${id}`));
      } catch (err) {
        console.error("[tasks] delete error:", err);
        toast.error("Delete failed");
        setTasks((prev) =>
          prev.some((x) => x.id === id) ? prev : [task, ...prev]
        );
      }
    },
    [inflight]
  );

  const handleUndoDelete = useCallback((id: string) => {
    const t = deleteCommitTimersRef.current.get(id);
    if (t) clearTimeout(t);
    deleteCommitTimersRef.current.delete(id);
    setPendingDeletes((m) => {
      if (!m.has(id)) return m;
      const next = new Map(m);
      next.delete(id);
      return next;
    });
    setRecentlyDeletingIds((s) => {
      if (!s.has(id)) return s;
      const next = new Set(s);
      next.delete(id);
      return next;
    });
    if (deleteToastIdRef.current) {
      dismissToast(deleteToastIdRef.current);
      deleteToastIdRef.current = null;
    }
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      pendingDeletes.forEach((prevTask, prevId) => {
        if (prevId !== id) commitPendingDelete(prevId, prevTask);
      });
      if (deleteToastIdRef.current) {
        dismissToast(deleteToastIdRef.current);
        deleteToastIdRef.current = null;
      }

      const task = tasks.find((t) => t.id === id);
      if (!task) return;

      setRecentlyDeletingIds((s) => new Set(s).add(id));
      setTimeout(() => {
        setRecentlyDeletingIds((s) => {
          if (!s.has(id)) return s;
          const next = new Set(s);
          next.delete(id);
          return next;
        });
        setPendingDeletes((m) => {
          if (m.has(id)) return m;
          const next = new Map(m);
          next.set(id, task);
          return next;
        });
      }, 200);

      const timer = setTimeout(() => {
        commitPendingDelete(id, task);
        if (deleteToastIdRef.current) {
          dismissToast(deleteToastIdRef.current);
          deleteToastIdRef.current = null;
        }
      }, 4000);
      deleteCommitTimersRef.current.set(id, timer);

      deleteToastIdRef.current = toast.action(
        "Task deleted",
        {
          label: "Undo",
          onClick: () => handleUndoDelete(id),
        },
        4000
      );
    },
    [tasks, pendingDeletes, commitPendingDelete, handleUndoDelete]
  );

  useEffect(() => {
    function flushPendingDeletes() {
      pendingDeletes.forEach((_task, id) => {
        const t = deleteCommitTimersRef.current.get(id);
        if (t) clearTimeout(t);
        syncDeleteTaskOnUnload(id);
      });
    }
    window.addEventListener("beforeunload", flushPendingDeletes);
    return () => window.removeEventListener("beforeunload", flushPendingDeletes);
  }, [pendingDeletes]);

  const visibleTasks = useMemo(
    () => tasks.filter((t) => !pendingDeletes.has(t.id)),
    [tasks, pendingDeletes]
  );

  const pinnedTaskIds = useMemo(
    () => new Set(priorities.map((p) => p.task_id)),
    [priorities]
  );
  const prioritiesFull = priorities.length >= 3;
  const lastUpdate = priorities.length
    ? priorities
        .slice()
        .sort((a, b) => (a.pinned_at < b.pinned_at ? 1 : -1))[0]
    : null;

  return {
    tasks,
    visibleTasks,
    priorities,
    pinnedTaskIds,
    prioritiesFull,
    lastUpdate,
    recentlyDeletingIds,
    setTasks,
    patchTask,
    handleToggleDone,
    handleUpdateTitle,
    handleUpdateOwner,
    handleTogglePin,
    handleReorderPriorities,
    handleDelete,
    inflight,
    refresh,
  };
}
