"use client";

import { useState, type FormEvent } from "react";
import { TaskListDnD } from "@/components/TaskListDnD";
import type { Artist, Task, TeamMember } from "@/lib/types";

interface Props {
  artist: Artist;
  tasks: Task[]; // pre-filtered, pre-sorted by position
  pinnedTaskIds: Set<string>;
  prioritiesFull: boolean;
  recentlyDeletingIds: Set<string>;
  onCreate: (title: string) => void | Promise<void>;
  onReorder: (taskId: string, newPosition: number) => void | Promise<void>;
  onToggleDone: (id: string, nextDone: boolean) => Promise<void>;
  onUpdateTitle: (id: string, title: string) => Promise<void>;
  onUpdateOwner: (id: string, owner: TeamMember) => Promise<void>;
  onDelete: (id: string) => void;
  onTogglePin: (id: string, isCurrentlyPinned: boolean) => void;
}

export function ArtistCard({
  artist,
  tasks,
  pinnedTaskIds,
  prioritiesFull,
  recentlyDeletingIds,
  onCreate,
  onReorder,
  onToggleDone,
  onUpdateTitle,
  onUpdateOwner,
  onDelete,
  onTogglePin,
}: Props) {
  const [input, setInput] = useState("");
  const activeCount = tasks.filter((t) => t.status === "Todo").length;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const title = input.trim();
    if (!title) return;
    onCreate(title);
    setInput("");
  }

  return (
    <section className="artist-card">
      <header className="artist-card-header">
        <h3 className="artist-card-title">{artist}</h3>
        <span className="artist-card-count">
          {activeCount} {activeCount === 1 ? "task" : "tasks"}
        </span>
      </header>

      <form className="artist-card-input-wrap" onSubmit={handleSubmit}>
        <input
          type="text"
          className="artist-card-input"
          placeholder={`Add task for ${artist}…`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          aria-label={`Add task for ${artist}`}
        />
      </form>

      <TaskListDnD
        tasks={tasks}
        pinnedTaskIds={pinnedTaskIds}
        prioritiesFull={prioritiesFull}
        recentlyDeletingIds={recentlyDeletingIds}
        maxVisible={3}
        onReorder={onReorder}
        onToggleDone={onToggleDone}
        onUpdateTitle={onUpdateTitle}
        onUpdateOwner={onUpdateOwner}
        onDelete={onDelete}
        onTogglePin={onTogglePin}
      />
    </section>
  );
}
