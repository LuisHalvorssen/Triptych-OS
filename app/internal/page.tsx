"use client";

import { useCallback } from "react";
import { useApp } from "@/components/AppShell";
import { TaskInput } from "@/components/TaskInput";
import { TaskList } from "@/components/TaskList";
import { TopPriorities, type PrioritySlot } from "@/components/TopPriorities";
import { api } from "@/lib/api-client";
import { DEFAULT_TAG } from "@/lib/constants";
import { toast } from "@/lib/toast";
import { useScopedTasks } from "@/lib/useScopedTasks";
import type {
  CategorizeResponse,
  ContextTag,
  SlotNumber,
  Task,
  TeamMember,
} from "@/lib/types";

const SCOPE = "internal" as const;

export default function InternalPage() {
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

  const handleCreate = useCallback(
    async (owner: TeamMember, title: string) => {
      try {
        const res = await fetch("/api/categorize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ owner, title }),
        });
        const cat = (await res.json()) as CategorizeResponse;

        const { task } = await inflight(() =>
          api.post<{ task: Task }>("/api/tasks", {
            title,
            owner,
            context: cat.context_tag ?? DEFAULT_TAG,
            status: "Todo",
            scope: SCOPE,
          })
        );

        setTasks((prev) =>
          prev.some((t) => t.id === task.id) ? prev : [task, ...prev]
        );
        return true;
      } catch (err) {
        console.error("[tasks] create failed:", err);
        toast.error("Couldn't save task");
        return false;
      }
    },
    [setTasks, inflight]
  );

  const handleUpdateContext = useCallback(
    (id: string, context: ContextTag) => patchTask(id, { context }),
    [patchTask]
  );

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
        tasks={visibleTasks}
        currentUser={currentUser}
        pinnedTaskIds={pinnedTaskIds}
        prioritiesFull={prioritiesFull}
        recentlyDeletingIds={recentlyDeletingIds}
        onToggleDone={handleToggleDone}
        onUpdateTitle={handleUpdateTitle}
        onUpdateOwner={handleUpdateOwner}
        onUpdateContext={handleUpdateContext}
        onDelete={handleDelete}
        onTogglePin={handleTogglePin}
      />
    </>
  );
}
