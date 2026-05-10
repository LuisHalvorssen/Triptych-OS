"use client";

import { useCallback, useMemo } from "react";
import { useApp } from "@/components/AppShell";
import { ArtistCard } from "@/components/ArtistCard";
import { TopPriorities, type PrioritySlot } from "@/components/TopPriorities";
import { api } from "@/lib/api-client";
import { ARTISTS } from "@/lib/constants";
import { toast } from "@/lib/toast";
import { useScopedTasks } from "@/lib/useScopedTasks";
import type { Artist, SlotNumber, Task } from "@/lib/types";

const SCOPE = "management" as const;

export default function ManagementPage() {
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

  // Done tasks are hidden from the cards (they pile up otherwise). Still in
  // the DB; future "Show completed" toggle could reveal them.
  const tasksByArtist = useMemo(() => {
    const map = new Map<Artist, Task[]>();
    ARTISTS.forEach((a) => map.set(a, []));
    visibleTasks.forEach((t) => {
      if (t.status === "Done") return;
      if (t.artist && map.has(t.artist as Artist)) {
        map.get(t.artist as Artist)!.push(t);
      }
    });
    map.forEach((list) => {
      list.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    });
    return map;
  }, [visibleTasks]);

  const handleCreate = useCallback(
    async (artist: Artist, title: string) => {
      const existing = tasksByArtist.get(artist) ?? [];
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
            artist,
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
    [currentUser, setTasks, tasksByArtist, inflight]
  );

  const handleReorder = useCallback(
    (taskId: string, newPosition: number) =>
      patchTask(taskId, { position: newPosition }),
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

      <div className="artist-grid">
        {ARTISTS.map((artist) => (
          <ArtistCard
            key={artist}
            artist={artist}
            tasks={tasksByArtist.get(artist) ?? []}
            pinnedTaskIds={pinnedTaskIds}
            prioritiesFull={prioritiesFull}
            recentlyDeletingIds={recentlyDeletingIds}
            onCreate={(title) => handleCreate(artist, title)}
            onReorder={handleReorder}
            onToggleDone={handleToggleDone}
            onUpdateTitle={handleUpdateTitle}
            onUpdateOwner={handleUpdateOwner}
            onDelete={handleDelete}
            onTogglePin={handleTogglePin}
          />
        ))}
      </div>
    </>
  );
}
