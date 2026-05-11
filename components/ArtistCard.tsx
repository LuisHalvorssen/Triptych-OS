"use client";

import { useState, type FormEvent } from "react";
import { TaskListDnD } from "@/components/TaskListDnD";
import type { Task, TeamMember } from "@/lib/types";

interface Props {
  // Displayed in the card header and used to build the input placeholder
  // unless `placeholder` is provided. Used for both artist cards
  // ("Wacomo", "Cam Rao", …) and the General management bucket.
  title: string;
  tasks: Task[]; // pre-filtered, pre-sorted by position
  pinnedTaskIds: Set<string>;
  prioritiesFull: boolean;
  recentlyDeletingIds: Set<string>;
  placeholder?: string;
  onCreate: (title: string) => void | Promise<void>;
  onReorder: (taskId: string, newPosition: number) => void | Promise<void>;
  onToggleDone: (id: string, nextDone: boolean) => Promise<void>;
  onUpdateTitle: (id: string, title: string) => Promise<void>;
  onUpdateOwner: (id: string, owner: TeamMember) => Promise<void>;
  onDelete: (id: string) => void;
  onTogglePin: (id: string, isCurrentlyPinned: boolean) => void;
}

export function ArtistCard({
  title,
  tasks,
  pinnedTaskIds,
  prioritiesFull,
  recentlyDeletingIds,
  placeholder,
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
  const effectivePlaceholder = placeholder ?? `Add task for ${title}…`;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const value = input.trim();
    if (!value) return;
    onCreate(value);
    setInput("");
  }

  return (
    <section className="artist-card">
      <header className="artist-card-header">
        <h3 className="artist-card-title">{title}</h3>
        <span className="artist-card-count">
          {activeCount} {activeCount === 1 ? "task" : "tasks"}
        </span>
      </header>

      <form className="artist-card-input-wrap" onSubmit={handleSubmit}>
        <input
          type="text"
          className="artist-card-input"
          placeholder={effectivePlaceholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          aria-label={effectivePlaceholder}
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
