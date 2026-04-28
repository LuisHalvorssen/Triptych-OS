"use client";

import { useState } from "react";
import { OWNER_COLORS, tagStyle } from "@/lib/constants";
import type { SlotNumber, Task } from "@/lib/types";

export interface PrioritySlot {
  slot: SlotNumber;
  task: Task | null;
  pinnedBy?: string;
  pinnedAt?: string;
}

interface Props {
  slots: PrioritySlot[]; // always length 3
  onUnpin: (slot: SlotNumber) => void;
  onReorder: (from: SlotNumber, to: SlotNumber) => void;
  lastUpdate?: { by: string; at: string } | null;
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

export function TopPriorities({ slots, onUnpin, onReorder, lastUpdate }: Props) {
  const [dragSlot, setDragSlot] = useState<SlotNumber | null>(null);
  const [overSlot, setOverSlot] = useState<SlotNumber | null>(null);

  return (
    <div className="container-responsive" style={{ paddingTop: 8 }}>
      <div className="priorities-card">
        <div className="priorities-header">
          <span className="priorities-label">TOP 3 · PRIORITIES</span>
          {lastUpdate && (
            <span className="priorities-update">
              UPDATED {relativeTime(lastUpdate.at)} BY {lastUpdate.by.toUpperCase()}
            </span>
          )}
        </div>

        <div className="priorities-list">
          {slots.map((entry) => {
            const { slot, task } = entry;
            const empty = !task;
            const isDragging = dragSlot === slot;
            const isOver = overSlot === slot && dragSlot !== null && dragSlot !== slot;

            return (
              <div
                key={slot}
                className={`priority-row${empty ? " priority-row-empty" : ""}${isDragging ? " priority-row-dragging" : ""}${isOver ? " priority-row-over" : ""}`}
                draggable={!empty}
                onDragStart={(e) => {
                  if (empty) return;
                  setDragSlot(slot);
                  e.dataTransfer.setData("text/plain", String(slot));
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  if (dragSlot === null) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (overSlot !== slot) setOverSlot(slot);
                }}
                onDragLeave={() => {
                  if (overSlot === slot) setOverSlot(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const raw = e.dataTransfer.getData("text/plain");
                  const from = Number(raw) as SlotNumber;
                  setDragSlot(null);
                  setOverSlot(null);
                  if (from === slot) return;
                  if (from === 1 || from === 2 || from === 3) {
                    onReorder(from, slot);
                  }
                }}
                onDragEnd={() => {
                  setDragSlot(null);
                  setOverSlot(null);
                }}
              >
                <SlotNumberCell slot={slot} />
                {empty ? (
                  <span className="priority-empty-label">Pin a task to slot {slot}</span>
                ) : (
                  <>
                    <span
                      className="priority-owner"
                      title={`Owner: ${task.owner}`}
                      style={{ background: OWNER_COLORS[task.owner] }}
                      aria-label={`Owner ${task.owner}`}
                    >
                      {task.owner[0]}
                    </span>
                    <span className="priority-title" title={task.title}>
                      {task.title}
                    </span>
                    <span className="priority-meta">
                      <PriorityTag tag={task.context} />
                      <button
                        type="button"
                        className="priority-unpin tap-target"
                        onClick={() => onUnpin(slot)}
                        aria-label={`Unpin slot ${slot}`}
                        title="Unpin"
                      >
                        ×
                      </button>
                    </span>
                    <MoveButtons slot={slot} onReorder={onReorder} />
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SlotNumberCell({ slot }: { slot: SlotNumber }) {
  return (
    <span className="priority-slot-num" aria-hidden="true">
      0{slot}
    </span>
  );
}

function PriorityTag({ tag }: { tag: Task["context"] }) {
  const { color, bg } = tagStyle(tag);
  return (
    <span
      className="priority-tag-pill task-tag-pill"
      style={{ color, background: bg }}
    >
      {tag}
    </span>
  );
}

// Mobile-only up/down chevrons. Hidden on (hover: hover) via CSS.
function MoveButtons({
  slot,
  onReorder,
}: {
  slot: SlotNumber;
  onReorder: (from: SlotNumber, to: SlotNumber) => void;
}) {
  const upTo: SlotNumber | null = slot === 1 ? null : ((slot - 1) as SlotNumber);
  const downTo: SlotNumber | null = slot === 3 ? null : ((slot + 1) as SlotNumber);
  return (
    <span className="priority-move">
      <button
        type="button"
        className="priority-move-btn"
        disabled={!upTo}
        onClick={() => upTo && onReorder(slot, upTo)}
        aria-label={`Move slot ${slot} up`}
        title="Move up"
      >
        ▲
      </button>
      <button
        type="button"
        className="priority-move-btn"
        disabled={!downTo}
        onClick={() => downTo && onReorder(slot, downTo)}
        aria-label={`Move slot ${slot} down`}
        title="Move down"
      >
        ▼
      </button>
    </span>
  );
}
