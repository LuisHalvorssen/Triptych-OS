"use client";

import { useRef, useState } from "react";
import { TaskRow } from "@/components/TaskRow";
import type { Task, TeamMember } from "@/lib/types";

interface Props {
  tasks: Task[]; // pre-sorted by position ascending
  pinnedTaskIds: Set<string>;
  prioritiesFull: boolean;
  recentlyDeletingIds: Set<string>;
  emptyMessage?: string;
  onReorder: (taskId: string, newPosition: number) => void | Promise<void>;
  onToggleDone: (id: string, nextDone: boolean) => Promise<void>;
  onUpdateTitle: (id: string, title: string) => Promise<void>;
  onUpdateOwner: (id: string, owner: TeamMember) => Promise<void>;
  onDelete: (id: string) => void;
  onTogglePin: (id: string, isCurrentlyPinned: boolean) => void;
}

const DRAG_MIME = "application/x-triptych-task-id";

// Reusable drag-reorder list. Used by /management (artist cards) and
// /digital (client cards). The list is "scoped" by whoever passes the
// pre-filtered tasks — cross-list drags are not supported (the dragged
// task simply isn't found in `tasks` and the drop becomes a no-op).
export function TaskListDnD({
  tasks,
  pinnedTaskIds,
  prioritiesFull,
  recentlyDeletingIds,
  emptyMessage = "No tasks yet",
  onReorder,
  onToggleDone,
  onUpdateTitle,
  onUpdateOwner,
  onDelete,
  onTogglePin,
}: Props) {
  const [dropIndex, setDropIndexState] = useState<number | null>(null);
  const dropIndexRef = useRef<number | null>(null);
  const setDropIndex = (v: number | null) => {
    dropIndexRef.current = v;
    setDropIndexState(v);
  };
  const [draggingId, setDraggingId] = useState<string | null>(null);

  function handleRowDragOver(e: React.DragEvent<HTMLLIElement>, index: number) {
    if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = e.currentTarget.getBoundingClientRect();
    const upperHalf = e.clientY < rect.top + rect.height / 2;
    setDropIndex(upperHalf ? index : index + 1);
  }

  function handleListDragLeave(e: React.DragEvent<HTMLUListElement>) {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setDropIndex(null);
  }

  function handleDrop(e: React.DragEvent<HTMLElement>) {
    if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
    e.preventDefault();
    const taskId = e.dataTransfer.getData(DRAG_MIME);
    const idx = dropIndexRef.current;
    setDropIndex(null);
    setDraggingId(null);
    if (!taskId || idx == null) return;

    const draggedIdx = tasks.findIndex((t) => t.id === taskId);
    if (draggedIdx === -1) return; // dragged from another list; cross-list moves not supported
    if (idx === draggedIdx || idx === draggedIdx + 1) return;

    const newPosition = computeInsertPosition(tasks, idx, taskId);
    onReorder(taskId, newPosition);
  }

  if (tasks.length === 0) {
    return <div className="dnd-list-empty">{emptyMessage}</div>;
  }

  return (
    <ul
      className="dnd-list"
      onDragLeave={handleListDragLeave}
      onDrop={handleDrop}
    >
      {tasks.map((t, i) => {
        const showLineAbove = dropIndex === i;
        const showLineBelow = i === tasks.length - 1 && dropIndex === tasks.length;
        const dimmed = draggingId === t.id;
        return (
          <li
            key={t.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(DRAG_MIME, t.id);
              e.dataTransfer.effectAllowed = "move";
              setDraggingId(t.id);
            }}
            onDragEnd={() => {
              setDraggingId(null);
              setDropIndex(null);
            }}
            onDragOver={(e) => handleRowDragOver(e, i)}
            className={[
              "dnd-list-item",
              showLineAbove && "is-drop-above",
              showLineBelow && "is-drop-below",
              dimmed && "is-dragging",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <TaskRow
              task={t}
              isPinned={pinnedTaskIds.has(t.id)}
              canPin={!prioritiesFull || pinnedTaskIds.has(t.id)}
              isDeleting={recentlyDeletingIds.has(t.id)}
              onToggleDone={onToggleDone}
              onUpdateTitle={onUpdateTitle}
              onUpdateOwner={onUpdateOwner}
              onUpdateContext={() => {
                /* scoped tasks have no context tag; pill is hidden */
              }}
              onDelete={onDelete}
              onTogglePin={onTogglePin}
            />
          </li>
        );
      })}
    </ul>
  );
}

function computeInsertPosition(
  tasks: Task[],
  dropIndex: number,
  draggedId: string
): number {
  const filtered = tasks.filter((t) => t.id !== draggedId);
  const draggedOriginalIdx = tasks.findIndex((t) => t.id === draggedId);
  const adjustedIndex =
    draggedOriginalIdx !== -1 && draggedOriginalIdx < dropIndex
      ? dropIndex - 1
      : dropIndex;

  if (filtered.length === 0) return 0;
  if (adjustedIndex <= 0) {
    return (filtered[0].position ?? 0) - 1;
  }
  if (adjustedIndex >= filtered.length) {
    return (filtered[filtered.length - 1].position ?? 0) + 1;
  }
  const prev = filtered[adjustedIndex - 1].position ?? 0;
  const next = filtered[adjustedIndex].position ?? 0;
  return (prev + next) / 2;
}
