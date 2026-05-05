"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/AppShell";
import { supabase, syncDeleteTaskOnUnload } from "@/lib/supabase";
import { dismiss as dismissToast, toast } from "@/lib/toast";
import type {
  Scope,
  SlotNumber,
  Task,
  TeamMember,
  TopPriority,
} from "@/lib/types";

// Shared task + priority state machine. Used by /internal, /management, /digital.
// Each page wraps the returned `setTasks` to plug in its own create handler
// (different scopes need different insert payloads — internal uses AI tags,
// management sets `artist`, digital sets `client_id`).
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

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("scope", scope)
        .order("created_at", { ascending: false });
      if (!cancelled && !error && data) setTasks(data as Task[]);
      if (error) {
        console.error("[tasks] load error:", error);
        toast.error("Couldn't load tasks");
      }

      const { data: pdata, error: perror } = await supabase
        .from("top_priorities")
        .select("*")
        .eq("scope", scope)
        .order("slot");
      if (!cancelled && !perror && pdata) setPriorities(pdata as TopPriority[]);
      if (perror) console.warn("[priorities] load skipped:", perror.message);
    }
    load();

    const channel = supabase
      .channel(`tasks-${scope}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `scope=eq.${scope}`,
        },
        (payload) => {
          setTasks((prev) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as Task;
              if (prev.some((t) => t.id === row.id)) return prev;
              return [row, ...prev];
            }
            if (payload.eventType === "UPDATE") {
              const row = payload.new as Task;
              // If a task moved out of this scope (artist reassign across
              // scopes — unlikely today but cheap to handle), drop it.
              if (row.scope !== scope) return prev.filter((t) => t.id !== row.id);
              return prev.map((t) => (t.id === row.id ? row : t));
            }
            if (payload.eventType === "DELETE") {
              const row = payload.old as Task;
              return prev.filter((t) => t.id !== row.id);
            }
            return prev;
          });
        }
      )
      .subscribe();

    const pchannel = supabase
      .channel(`priorities-${scope}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "top_priorities",
          filter: `scope=eq.${scope}`,
        },
        (payload) => {
          setPriorities((prev) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as TopPriority;
              return [...prev.filter((p) => p.slot !== row.slot), row].sort(
                (a, b) => a.slot - b.slot
              );
            }
            if (payload.eventType === "UPDATE") {
              const row = payload.new as TopPriority;
              return prev
                .filter((p) => p.slot !== row.slot)
                .concat(row)
                .sort((a, b) => a.slot - b.slot);
            }
            if (payload.eventType === "DELETE") {
              const row = payload.old as Partial<TopPriority>;
              if (row.slot != null) return prev.filter((p) => p.slot !== row.slot);
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      supabase.removeChannel(pchannel);
    };
  }, [scope]);

  const patchTask = useCallback(
    async (id: string, patch: Partial<Task>) => {
      let previous: Task | undefined;
      setTasks((prev) => {
        previous = prev.find((t) => t.id === id);
        return prev.map((t) => (t.id === id ? { ...t, ...patch } : t));
      });
      const { error } = await supabase.from("tasks").update(patch).eq("id", id);
      if (error) {
        console.error("[tasks] update error:", error);
        toast.error("Update failed");
        if (previous) {
          const snapshot = previous;
          setTasks((prev) => prev.map((t) => (t.id === id ? snapshot : t)));
        }
      }
    },
    []
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
        const { error } = await supabase
          .from("top_priorities")
          .delete()
          .eq("scope", scope)
          .eq("slot", slot);
        if (error) {
          console.error("[priorities] unpin error:", error);
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
      const { error } = await supabase.from("top_priorities").insert({
        scope,
        slot,
        task_id: taskId,
        pinned_by: currentUser,
      });
      if (error) {
        console.error("[priorities] pin error:", error);
        toast.error("Couldn't pin");
        setPriorities((prev) => prev.filter((p) => p.slot !== slot));
      }
    },
    [priorities, currentUser, scope]
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
      const { error } = await supabase.rpc("swap_priority_slots", {
        p_scope: scope,
        slot_a: from,
        slot_b: to,
      });
      if (error) {
        console.error("[priorities] reorder error:", error);
        toast.error("Couldn't reorder");
        setPriorities(snap);
      }
    },
    [priorities, scope]
  );

  const commitPendingDelete = useCallback(async (id: string, task: Task) => {
    const t = deleteCommitTimersRef.current.get(id);
    if (t) clearTimeout(t);
    deleteCommitTimersRef.current.delete(id);
    setPendingDeletes((m) => {
      const next = new Map(m);
      next.delete(id);
      return next;
    });
    setTasks((prev) => prev.filter((x) => x.id !== id));
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) {
      console.error("[tasks] delete error:", error);
      toast.error("Delete failed");
      setTasks((prev) =>
        prev.some((x) => x.id === id) ? prev : [task, ...prev]
      );
    }
  }, []);

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
  };
}
