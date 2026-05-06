"use client";

import { useCallback, useMemo, useState } from "react";
import { useApp } from "@/components/AppShell";
import { ClientCard } from "@/components/ClientCard";
import { NewClientForm, type NewClientPayload } from "@/components/NewClientForm";
import { TopPriorities, type PrioritySlot } from "@/components/TopPriorities";
import { api } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { useDigitalClients } from "@/lib/useDigitalClients";
import { useScopedTasks } from "@/lib/useScopedTasks";
import type { SlotNumber, Task } from "@/lib/types";

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
    inflight,
  } = useScopedTasks(SCOPE);

  const { clients, createClient, updateClient, archiveClient } =
    useDigitalClients();
  const [showNewForm, setShowNewForm] = useState(false);

  const handleCreateClient = useCallback(
    async (payload: NewClientPayload) => {
      const created = await createClient(payload);
      if (created) setShowNewForm(false);
    },
    [createClient]
  );

  const handleCreateTask = useCallback(
    async (clientId: string, title: string) => {
      const existing = visibleTasks.filter((t) => t.client_id === clientId);
      const minPos = existing.reduce<number | null>(
        (acc, t) =>
          t.position == null ? acc : acc == null ? t.position : Math.min(acc, t.position),
        null
      );
      const newPosition = minPos == null ? 0 : minPos - 1;

      try {
        const { task } = await inflight(() =>
          api.post<{ task: Task }>("/api/tasks", {
            title,
            owner: currentUser,
            context: null,
            status: "Todo",
            scope: SCOPE,
            client_id: clientId,
            position: newPosition,
          })
        );
        setTasks((prev) =>
          prev.some((t) => t.id === task.id) ? prev : [task, ...prev]
        );
      } catch (err) {
        console.error("[tasks] create failed:", err);
        toast.error("Couldn't save task");
      }
    },
    [currentUser, visibleTasks, setTasks, inflight]
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
              onUpdateClient={updateClient}
              onArchiveClient={archiveClient}
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
                  onUpdateClient={updateClient}
                  onArchiveClient={archiveClient}
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
