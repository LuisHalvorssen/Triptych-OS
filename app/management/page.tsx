"use client";

import { useCallback, useMemo } from "react";
import { useApp } from "@/components/AppShell";
import { ArtistCard } from "@/components/ArtistCard";
import { TopPriorities, type PrioritySlot } from "@/components/TopPriorities";
import { ARTISTS } from "@/lib/constants";
import { supabase } from "@/lib/supabase";
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
  } = useScopedTasks(SCOPE);

  // Group + sort tasks by artist (ascending position; smaller = top of card).
  const tasksByArtist = useMemo(() => {
    const map = new Map<Artist, Task[]>();
    ARTISTS.forEach((a) => map.set(a, []));
    visibleTasks.forEach((t) => {
      if (t.artist && map.has(t.artist as Artist)) {
        map.get(t.artist as Artist)!.push(t);
      }
    });
    map.forEach((list) => {
      list.sort((a, b) => {
        const pa = a.position ?? 0;
        const pb = b.position ?? 0;
        return pa - pb;
      });
    });
    return map;
  }, [visibleTasks]);

  const handleCreate = useCallback(
    async (artist: Artist, title: string) => {
      // New tasks go to the top of the artist's card → smallest position.
      const existing = tasksByArtist.get(artist) ?? [];
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
          artist,
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
    [currentUser, setTasks, tasksByArtist]
  );

  const handleReorder = useCallback(
    (taskId: string, newPosition: number) => patchTask(taskId, { position: newPosition }),
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
