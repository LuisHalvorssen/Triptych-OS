"use client";

import { useCallback, useEffect, useState } from "react";
import { ConfigMissing } from "@/components/ConfigMissing";
import { Header } from "@/components/Header";
import { TaskInput } from "@/components/TaskInput";
import { TaskList } from "@/components/TaskList";
import { Toaster } from "@/components/Toaster";
import { TopPriorities, type PrioritySlot } from "@/components/TopPriorities";
import { UserSelector } from "@/components/UserSelector";
import { DEFAULT_TAG } from "@/lib/constants";
import { readUserCookie, writeUserCookie } from "@/lib/cookies";
import { isSupabaseConfigured, missingSupabaseEnvVars, supabase } from "@/lib/supabase";
import {
  applyTheme,
  readThemeCookie,
  writeThemeCookie,
  type Theme,
} from "@/lib/theme";
import { toast } from "@/lib/toast";
import type {
  CategorizeResponse,
  ContextTag,
  SlotNumber,
  Task,
  TeamMember,
  TopPriority,
} from "@/lib/types";

export default function HomePage() {
  const [currentUser, setCurrentUser] = useState<TeamMember | null>(null);
  const [theme, setTheme] = useState<Theme>("dark");
  const [hydrated, setHydrated] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [priorities, setPriorities] = useState<TopPriority[]>([]);

  /* eslint-disable react-hooks/set-state-in-effect --
   * Hydrating from document.cookie, which only exists after mount. Initial
   * server render returns null so cascading renders here aren't a concern. */
  useEffect(() => {
    const t = readThemeCookie();
    setTheme(t);
    applyTheme(t);
    setCurrentUser(readUserCookie());
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!hydrated || !isSupabaseConfigured) return;
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });
      if (!cancelled && !error && data) setTasks(data as Task[]);
      if (error) {
        console.error("[tasks] load error:", error);
        toast.error("Couldn't load tasks");
      }

      // Priorities: silent failure if the table isn't migrated yet
      // (rolling deploy — UI degrades to an empty billboard).
      const { data: pdata, error: perror } = await supabase
        .from("top_priorities")
        .select("*")
        .order("slot");
      if (!cancelled && !perror && pdata) setPriorities(pdata as TopPriority[]);
      if (perror) console.warn("[priorities] load skipped:", perror.message);
    }
    load();

    const channel = supabase
      .channel("tasks-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        (payload) => {
          setTasks((prev) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as Task;
              if (prev.some((t) => t.id === row.id)) return prev;
              return [row, ...prev];
            }
            if (payload.eventType === "UPDATE") {
              const row = payload.new as Task;
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
      .channel("priorities-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "top_priorities" },
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
  }, [hydrated]);

  function handleSelectUser(member: TeamMember) {
    writeUserCookie(member);
    setCurrentUser(member);
  }

  function handleToggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    writeThemeCookie(next);
  }

  const handleCreate = useCallback(
    async (owner: TeamMember, title: string) => {
      try {
        const res = await fetch("/api/categorize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ owner, title }),
        });
        const cat = (await res.json()) as CategorizeResponse;

        const { data, error } = await supabase
          .from("tasks")
          .insert({
            title,
            owner,
            context: cat.context_tag ?? DEFAULT_TAG,
            status: "Todo",
          })
          .select()
          .single();

        if (error) {
          console.error("[tasks] insert error:", error);
          toast.error("Couldn't save task");
          return false;
        }
        if (data) {
          const row = data as Task;
          setTasks((prev) =>
            prev.some((t) => t.id === row.id) ? prev : [row, ...prev]
          );
        }
        return true;
      } catch (err) {
        console.error("[tasks] create failed:", err);
        toast.error("Couldn't save task");
        return false;
      }
    },
    []
  );

  // Optimistic update + rollback on failure.
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

  const handleUpdateContext = useCallback(
    (id: string, context: ContextTag) => patchTask(id, { context }),
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

      // Pin: find lowest empty slot
      const used = new Set(priorities.map((p) => p.slot));
      const slot = ([1, 2, 3] as SlotNumber[]).find((s) => !used.has(s));
      if (!slot) {
        toast.info("Top 3 full — unpin one first");
        return;
      }
      const optimistic: TopPriority = {
        slot,
        task_id: taskId,
        pinned_at: new Date().toISOString(),
        pinned_by: currentUser ?? "unknown",
      };
      setPriorities((prev) =>
        [...prev.filter((p) => p.slot !== slot), optimistic].sort(
          (a, b) => a.slot - b.slot
        )
      );
      const { error } = await supabase.from("top_priorities").insert({
        slot,
        task_id: taskId,
        pinned_by: currentUser ?? "unknown",
      });
      if (error) {
        console.error("[priorities] pin error:", error);
        toast.error("Couldn't pin");
        setPriorities((prev) => prev.filter((p) => p.slot !== slot));
      }
    },
    [priorities, currentUser]
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
        slot_a: from,
        slot_b: to,
      });
      if (error) {
        console.error("[priorities] reorder error:", error);
        toast.error("Couldn't reorder");
        setPriorities(snap);
      }
    },
    [priorities]
  );

  const handleDelete = useCallback(async (id: string) => {
    let removed: Task | undefined;
    setTasks((prev) => {
      removed = prev.find((t) => t.id === id);
      return prev.filter((t) => t.id !== id);
    });
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) {
      console.error("[tasks] delete error:", error);
      toast.error("Delete failed");
      if (removed) {
        const snapshot = removed;
        setTasks((prev) =>
          prev.some((t) => t.id === id) ? prev : [snapshot, ...prev]
        );
      }
    }
  }, []);

  if (!hydrated) return null;

  if (!isSupabaseConfigured) {
    return <ConfigMissing missing={missingSupabaseEnvVars} />;
  }

  if (!currentUser) {
    return (
      <>
        <UserSelector onSelect={handleSelectUser} />
        <Toaster />
      </>
    );
  }

  const slots: PrioritySlot[] = ([1, 2, 3] as SlotNumber[]).map((slot) => {
    const p = priorities.find((x) => x.slot === slot);
    const task = p ? tasks.find((t) => t.id === p.task_id) ?? null : null;
    return {
      slot,
      task,
      pinnedBy: p?.pinned_by,
      pinnedAt: p?.pinned_at,
    };
  });
  const pinnedTaskIds = new Set(priorities.map((p) => p.task_id));
  const prioritiesFull = priorities.length >= 3;
  const lastUpdate = priorities.length
    ? priorities
        .slice()
        .sort((a, b) => (a.pinned_at < b.pinned_at ? 1 : -1))[0]
    : null;

  return (
    <div className="app-shell">
      <Header
        currentUser={currentUser}
        onSwitchUser={handleSelectUser}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />
      <TaskInput currentUser={currentUser} onCreate={handleCreate} />
      <TopPriorities
        slots={slots}
        onUnpin={(slot) => {
          const p = priorities.find((x) => x.slot === slot);
          if (p) handleTogglePin(p.task_id, true);
        }}
        onReorder={handleReorderPriorities}
        lastUpdate={
          lastUpdate
            ? { by: lastUpdate.pinned_by, at: lastUpdate.pinned_at }
            : null
        }
      />
      <TaskList
        tasks={tasks}
        currentUser={currentUser}
        pinnedTaskIds={pinnedTaskIds}
        prioritiesFull={prioritiesFull}
        onToggleDone={handleToggleDone}
        onUpdateTitle={handleUpdateTitle}
        onUpdateOwner={handleUpdateOwner}
        onUpdateContext={handleUpdateContext}
        onDelete={handleDelete}
        onTogglePin={handleTogglePin}
      />
      <Toaster />
    </div>
  );
}
