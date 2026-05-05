"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/AppShell";
import { ClientCard } from "@/components/ClientCard";
import { NewClientForm, type NewClientPayload } from "@/components/NewClientForm";
import { TopPriorities, type PrioritySlot } from "@/components/TopPriorities";
import { supabase } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import { useScopedTasks } from "@/lib/useScopedTasks";
import type { DigitalClient, SlotNumber, Task } from "@/lib/types";

const SCOPE = "digital" as const;

export default function DigitalPage() {
  const { currentUser } = useApp();
  const {
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
  } = useScopedTasks(SCOPE);

  const [clients, setClients] = useState<DigitalClient[]>([]);
  const [showNewForm, setShowNewForm] = useState(false);

  // Load + realtime for clients.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data, error } = await supabase
        .from("digital_clients")
        .select("*")
        .order("created_at", { ascending: false });
      if (!cancelled && !error && data) setClients(data as DigitalClient[]);
      if (error) {
        console.error("[clients] load error:", error);
        toast.error("Couldn't load clients");
      }
    }
    load();

    const channel = supabase
      .channel("digital-clients")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "digital_clients" },
        (payload) => {
          setClients((prev) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as DigitalClient;
              if (prev.some((c) => c.id === row.id)) return prev;
              return [row, ...prev];
            }
            if (payload.eventType === "UPDATE") {
              const row = payload.new as DigitalClient;
              return prev.map((c) => (c.id === row.id ? row : c));
            }
            if (payload.eventType === "DELETE") {
              const row = payload.old as DigitalClient;
              return prev.filter((c) => c.id !== row.id);
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
  }, []);

  const handleCreateClient = useCallback(
    async (payload: NewClientPayload) => {
      const { data, error } = await supabase
        .from("digital_clients")
        .insert(payload)
        .select()
        .single();
      if (error) {
        console.error("[clients] insert error:", error);
        toast.error("Couldn't create client");
        return;
      }
      if (data) {
        const row = data as DigitalClient;
        setClients((prev) =>
          prev.some((c) => c.id === row.id) ? prev : [row, ...prev]
        );
      }
      setShowNewForm(false);
    },
    []
  );

  const handleUpdateClient = useCallback(
    async (id: string, patch: Partial<DigitalClient>) => {
      let previous: DigitalClient | undefined;
      setClients((prev) => {
        previous = prev.find((c) => c.id === id);
        return prev.map((c) => (c.id === id ? { ...c, ...patch } : c));
      });
      const { error } = await supabase
        .from("digital_clients")
        .update(patch)
        .eq("id", id);
      if (error) {
        console.error("[clients] update error:", error);
        toast.error("Update failed");
        if (previous) {
          const snap = previous;
          setClients((prev) => prev.map((c) => (c.id === id ? snap : c)));
        }
      }
    },
    []
  );

  const handleArchiveClient = useCallback(
    (id: string) =>
      handleUpdateClient(id, {
        status: "archived",
        archived_at: new Date().toISOString(),
      }),
    [handleUpdateClient]
  );

  const handleCreateTask = useCallback(
    async (clientId: string, title: string) => {
      const existing = visibleTasks.filter((t) => t.client_id === clientId);
      const minPos = existing.reduce<number | null>(
        (acc, t) => (t.position == null ? acc : acc == null ? t.position : Math.min(acc, t.position)),
        null
      );
      const newPosition = minPos == null ? 0 : minPos - 1;

      const { data, error } = await supabase
        .from("tasks")
        .insert({
          title,
          owner: currentUser,
          context: null,
          status: "Todo",
          scope: SCOPE,
          client_id: clientId,
          position: newPosition,
        })
        .select()
        .single();
      if (error) {
        console.error("[tasks] insert error:", error);
        toast.error("Couldn't save task");
        return;
      }
      if (data) {
        const row = data as Task;
        setTasks((prev) =>
          prev.some((t) => t.id === row.id) ? prev : [row, ...prev]
        );
      }
    },
    [currentUser, visibleTasks, setTasks]
  );

  const handleReorderTask = useCallback(
    (taskId: string, newPosition: number) =>
      patchTask(taskId, { position: newPosition }),
    [patchTask]
  );

  const tasksByClient = useMemo(() => {
    const map = new Map<string, Task[]>();
    visibleTasks.forEach((t) => {
      if (!t.client_id) return;
      if (!map.has(t.client_id)) map.set(t.client_id, []);
      map.get(t.client_id)!.push(t);
    });
    map.forEach((list) =>
      list.sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    );
    return map;
  }, [visibleTasks]);

  const active = clients.filter((c) => c.status === "active");
  const upcoming = clients.filter((c) => c.status === "upcoming");

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

  return (
    <>
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

      <div className="digital-page">
        <div className="digital-page-toolbar">
          <h2 className="digital-page-section-title">Active</h2>
          {!showNewForm && (
            <button
              type="button"
              className="digital-new-client-btn"
              onClick={() => setShowNewForm(true)}
            >
              + New client
            </button>
          )}
        </div>

        {showNewForm && (
          <NewClientForm
            onCreate={handleCreateClient}
            onCancel={() => setShowNewForm(false)}
          />
        )}

        {active.length === 0 && !showNewForm && (
          <div className="digital-empty">
            No active clients yet. Click <em>+ New client</em> to add one.
          </div>
        )}

        <div className="client-stack">
          {active.map((c) => (
            <ClientCard
              key={c.id}
              client={c}
              tasks={tasksByClient.get(c.id) ?? []}
              pinnedTaskIds={pinnedTaskIds}
              prioritiesFull={prioritiesFull}
              recentlyDeletingIds={recentlyDeletingIds}
              onUpdateClient={handleUpdateClient}
              onArchiveClient={handleArchiveClient}
              onCreateTask={handleCreateTask}
              onReorderTask={handleReorderTask}
              onToggleDone={handleToggleDone}
              onUpdateTitle={handleUpdateTitle}
              onUpdateOwner={handleUpdateOwner}
              onDeleteTask={handleDelete}
              onTogglePin={handleTogglePin}
            />
          ))}
        </div>

        {upcoming.length > 0 && (
          <>
            <h2 className="digital-page-section-title digital-page-section-title-upcoming">
              Upcoming
            </h2>
            <div className="client-stack">
              {upcoming.map((c) => (
                <ClientCard
                  key={c.id}
                  client={c}
                  tasks={tasksByClient.get(c.id) ?? []}
                  pinnedTaskIds={pinnedTaskIds}
                  prioritiesFull={prioritiesFull}
                  recentlyDeletingIds={recentlyDeletingIds}
                  onUpdateClient={handleUpdateClient}
                  onArchiveClient={handleArchiveClient}
                  onCreateTask={handleCreateTask}
                  onReorderTask={handleReorderTask}
                  onToggleDone={handleToggleDone}
                  onUpdateTitle={handleUpdateTitle}
                  onUpdateOwner={handleUpdateOwner}
                  onDeleteTask={handleDelete}
                  onTogglePin={handleTogglePin}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
