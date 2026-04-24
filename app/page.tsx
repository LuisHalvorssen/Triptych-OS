"use client";

import { useCallback, useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { TaskInput } from "@/components/TaskInput";
import { TaskList } from "@/components/TaskList";
import { UserSelector } from "@/components/UserSelector";
import { DEFAULT_TAG } from "@/lib/constants";
import { readUserCookie, writeUserCookie } from "@/lib/cookies";
import { supabase } from "@/lib/supabase";
import {
  applyTheme,
  readThemeCookie,
  writeThemeCookie,
  type Theme,
} from "@/lib/theme";
import type {
  CategorizeResponse,
  ContextTag,
  Task,
  TeamMember,
} from "@/lib/types";

export default function HomePage() {
  const [currentUser, setCurrentUser] = useState<TeamMember | null>(null);
  const [theme, setTheme] = useState<Theme>("dark");
  const [hydrated, setHydrated] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);

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
    if (!hydrated) return;
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });
      if (!cancelled && !error && data) setTasks(data as Task[]);
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

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
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
        return false;
      }
      if (data) {
        const row = data as Task;
        setTasks((prev) =>
          prev.some((t) => t.id === row.id) ? prev : [row, ...prev]
        );
      }
      return true;
    },
    []
  );

  const patchTask = useCallback(
    async (id: string, patch: Partial<Task>) => {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
      const { error } = await supabase.from("tasks").update(patch).eq("id", id);
      if (error) {
        console.error("[tasks] update error:", error);
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

  const handleDelete = useCallback(async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) {
      console.error("[tasks] delete error:", error);
    }
  }, []);

  if (!hydrated) return null;

  if (!currentUser) {
    return <UserSelector onSelect={handleSelectUser} />;
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        color: "var(--text-primary)",
      }}
    >
      <Header
        currentUser={currentUser}
        onSwitchUser={handleSelectUser}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />
      <TaskInput currentUser={currentUser} onCreate={handleCreate} />
      <TaskList
        tasks={tasks}
        currentUser={currentUser}
        onToggleDone={handleToggleDone}
        onUpdateTitle={handleUpdateTitle}
        onUpdateOwner={handleUpdateOwner}
        onUpdateContext={handleUpdateContext}
        onDelete={handleDelete}
      />
    </div>
  );
}
