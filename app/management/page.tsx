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

  // Group tasks. Done tasks are hidden from the cards (they pile up
  // otherwise). Tasks with `artist === null` go into the "General"
  // bucket — used for cross-artist management work.
  const { tasksByArtist, generalTasks } = useMemo(() => {
    const byArtist = new Map<Artist, Task[]>();
    ARTISTS.forEach((a) => byArtist.set(a, []));
    const general: Task[] = [];
    visibleTasks.forEach((t) => {
      if (t.status === "Done") return;
      if (t.artist && byArtist.has(t.artist as Artist)) {
        byArtist.get(t.artist as Artist)!.push(t);
      } else if (t.artist == null) {
        general.push(t);
      }
    });
    const sortPos = (a: Task, b: Task) =>
      (a.position ?? 0) - (b.position ?? 0);
    byArtist.forEach((list) => list.sort(sortPos));
    general.sort(sortPos);
    return { tasksByArtist: byArtist, generalTasks: general };
  }, [visibleTasks]);

  // `artist` may be null → general bucket. New tasks land at the top of
  // their bucket (smallest position).
  const handleCreate = useCallback(
    async (artist: Artist | null, title: string) => {
      const bucket =
        artist == null ? generalTasks : tasksByArtist.get(artist) ?? [];
      const minPos = bucket.reduce<number | null>(
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
    [currentUser, setTasks, tasksByArtist, generalTasks, inflight]
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
      <div className="management-header-strip">
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
        <ArtistCard
          title="General"
          placeholder="Add a management task…"
          tasks={generalTasks}
          pinnedTaskIds={pinnedTaskIds}
          prioritiesFull={prioritiesFull}
          recentlyDeletingIds={recentlyDeletingIds}
          onCreate={(t) => handleCreate(null, t)}
          onReorder={handleReorder}
          onToggleDone={handleToggleDone}
          onUpdateTitle={handleUpdateTitle}
          onUpdateOwner={handleUpdateOwner}
          onDelete={handleDelete}
          onTogglePin={handleTogglePin}
        />
      </div>

      <div className="artist-grid">
        {ARTISTS.map((artist) => (
          <ArtistCard
            key={artist}
            title={artist}
            tasks={tasksByArtist.get(artist) ?? []}
            pinnedTaskIds={pinnedTaskIds}
            prioritiesFull={prioritiesFull}
            recentlyDeletingIds={recentlyDeletingIds}
            onCreate={(t) => handleCreate(artist, t)}
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
