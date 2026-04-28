"use client";

import { useEffect, useRef, useState } from "react";
import { OWNER_COLORS, TAGS, TEAM, tagStyle } from "@/lib/constants";
import { useSwipe } from "@/lib/useSwipe";
import type { ContextTag, Task, TeamMember } from "@/lib/types";

interface Props {
  task: Task;
  isPinned: boolean;
  canPin: boolean; // false when 3 slots full and this task is not already pinned
  onToggleDone: (id: string, nextDone: boolean) => void;
  onUpdateTitle: (id: string, title: string) => void;
  onUpdateOwner: (id: string, owner: TeamMember) => void;
  onUpdateContext: (id: string, context: ContextTag) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string, isCurrentlyPinned: boolean) => void;
}

function formatCreatedAt(iso: string): string {
  try {
    return new Date(iso)
      .toLocaleDateString("en-US", { month: "short", day: "numeric" })
      .toUpperCase();
  } catch {
    return "";
  }
}

function OwnerDotSelect({
  owner,
  onChange,
  disabled,
}: {
  owner: TeamMember;
  onChange: (next: TeamMember) => void;
  disabled?: boolean;
}) {
  const color = OWNER_COLORS[owner];
  return (
    <label
      title={`Owner: ${owner}`}
      style={{
        position: "relative",
        width: 22,
        height: 22,
        flexShrink: 0,
        display: "inline-flex",
        cursor: disabled ? "default" : "pointer",
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: color,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 9,
          fontWeight: 800,
          color: "#fff",
          fontFamily: "'Syne', sans-serif",
          pointerEvents: "none",
        }}
      >
        {owner[0]}
      </span>
      {!disabled && (
        <select
          value={owner}
          onChange={(e) => onChange(e.target.value as TeamMember)}
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0,
            cursor: "pointer",
            border: "none",
            background: "transparent",
          }}
        >
          {TEAM.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      )}
    </label>
  );
}

function TagPillSelect({
  tag,
  onChange,
  disabled,
}: {
  tag: ContextTag;
  onChange: (next: ContextTag) => void;
  disabled?: boolean;
}) {
  const { color, bg } = tagStyle(tag);
  return (
    <label
      title="Change context tag"
      style={{
        position: "relative",
        display: "inline-flex",
        cursor: disabled ? "default" : "pointer",
        flexShrink: 0,
      }}
    >
      <span
        className="task-tag-pill"
        style={{
          fontSize: "0.6875rem", // 11px desktop
          fontWeight: 500,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          fontFamily: "'Syne', sans-serif",
          color,
          background: bg,
          padding: "2px 7px",
          borderRadius: 2,
          whiteSpace: "nowrap",
          pointerEvents: "none",
        }}
      >
        {tag}
      </span>
      {!disabled && (
        <select
          value={tag}
          onChange={(e) => onChange(e.target.value as ContextTag)}
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0,
            cursor: "pointer",
            border: "none",
            background: "transparent",
          }}
        >
          {TAGS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      )}
    </label>
  );
}

function EditableTitle({
  value,
  onCommit,
  muted,
}: {
  value: string;
  onCommit: (next: string) => void;
  muted: boolean;
}) {
  const [editing, setEditing] = useState(false);
  // Draft is seeded from `value` at the moment edit mode is entered
  // (via the `key` remount), so we never need to sync it via an effect.
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function commit() {
    const trimmed = draft.trim();
    setEditing(false);
    if (trimmed && trimmed !== value) onCommit(trimmed);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="task-title-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          else if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        style={{
          flex: 1,
          minWidth: 0,
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "0.9375rem", // 15px
          fontWeight: 500,
          color: "var(--task-title)",
          background: "var(--surface)",
          border: "1px solid var(--accent-blue)",
          borderRadius: 2,
          padding: "4px 8px",
          outline: "none",
          letterSpacing: "-0.01em",
        }}
      />
    );
  }

  return (
    <button
      className="task-title-btn"
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      title="Click to edit"
      style={{
        flex: "1 1 180px",
        minWidth: 0,
        background: "none",
        border: "none",
        padding: "4px 0",
        textAlign: "left",
        cursor: "text",
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "0.9375rem", // 15px
        fontWeight: 500,
        color: muted ? "var(--text-muted)" : "var(--task-title)",
        letterSpacing: "-0.01em",
        textDecoration: muted ? "line-through" : "none",
        lineHeight: 1.45,
        whiteSpace: "normal",
        wordBreak: "break-word",
        overflowWrap: "anywhere",
      }}
    >
      {value}
    </button>
  );
}

export function TaskRow({
  task,
  isPinned,
  canPin,
  onToggleDone,
  onUpdateTitle,
  onUpdateOwner,
  onUpdateContext,
  onDelete,
  onTogglePin,
}: Props) {
  const isDone = task.status === "Done";

  // Swipe-right-to-complete on touch devices. Disabled when the row is
  // already done (so you can't double-fire the action). Caps the visual
  // translate at 120px so the row can't fly off-screen.
  const swipe = useSwipe({
    onCompleteRight: isDone ? undefined : () => onToggleDone(task.id, true),
    threshold: 80,
  });
  const dx = isDone ? 0 : Math.max(0, Math.min(swipe.state.dx, 120));
  const showSwipeBg = dx > 0;

  return (
    <div
      className="task-row-swipe"
      data-swipe-active={showSwipeBg ? "true" : "false"}
      {...swipe.handlers}
      style={{
        borderBottom: "1px solid var(--row-divider)",
      }}
    >
      {showSwipeBg && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            paddingLeft: 16,
            color: "#3A8A5A",
            fontSize: 18,
            fontWeight: 700,
            pointerEvents: "none",
          }}
        >
          ✓
        </div>
      )}
      <div
        className="task-row task-row-inner"
        style={{
          display: "flex",
          alignItems: "flex-start",
          flexWrap: "wrap",
          columnGap: 10,
          rowGap: 6,
          padding: "14px 0",
          opacity: isDone ? 0.5 : 1,
          transform: dx ? `translateX(${dx}px)` : undefined,
          transition: swipe.state.active ? "none" : "transform 0.18s ease-out, opacity 0.2s",
          background: "transparent",
          position: "relative",
        }}
      >
        <button
          onClick={() => onToggleDone(task.id, !isDone)}
          aria-label={isDone ? "Mark as active" : "Mark as done"}
          className="task-checkbox"
          style={{
            flexShrink: 0,
            marginTop: -2,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            padding: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            aria-hidden="true"
            className="task-checkbox-visual"
            style={{
              width: 17,
              height: 17,
              borderRadius: "50%",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              border: isDone ? "none" : "1.5px solid var(--border-strong)",
              background: isDone ? "#3A8A5A" : "transparent",
              transition: "border-color 100ms ease, transform 100ms ease, background 0.12s",
            }}
          >
            {isDone && (
              <span style={{ color: "#fff", fontSize: 9, lineHeight: 1 }}>
                ✓
              </span>
            )}
          </span>
        </button>

        <div className="task-owner-wrap" style={{ marginTop: 1, flexShrink: 0 }}>
          <OwnerDotSelect
            owner={task.owner}
            onChange={(next) => onUpdateOwner(task.id, next)}
            disabled={isDone}
          />
        </div>

        <EditableTitle
          value={task.title}
          onCommit={(next) => onUpdateTitle(task.id, next)}
          muted={isDone}
        />

        <div
          className="task-meta"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexShrink: 0,
            marginTop: 2,
          }}
        >
          <span
            className="task-date"
            title={`Created ${new Date(task.created_at).toLocaleString()}`}
            style={{
              fontSize: "0.75rem", // 12px desktop
              fontWeight: 400,
              fontFamily: "'IBM Plex Mono', monospace",
              color: "var(--task-date)",
              letterSpacing: "0.08em",
              whiteSpace: "nowrap",
            }}
          >
            {formatCreatedAt(task.created_at)}
          </span>

          <span className="task-tag">
            <TagPillSelect
              tag={task.context}
              onChange={(next) => onUpdateContext(task.id, next)}
              disabled={isDone}
            />
          </span>
        </div>

        <div className="task-actions">
          <button
            className={`task-pin tap-target${isPinned ? " task-pin-active" : ""}`}
            onClick={() => onTogglePin(task.id, isPinned)}
            disabled={!isPinned && !canPin}
            aria-label={isPinned ? "Unpin from Top 3" : "Pin to Top 3"}
            title={
              isPinned
                ? "Unpin from Top 3"
                : canPin
                  ? "Pin to Top 3"
                  : "Top 3 is full"
            }
            style={{
              background: "none",
              border: "none",
              cursor: !isPinned && !canPin ? "default" : "pointer",
              fontSize: 13,
              lineHeight: 1,
              padding: "0 4px",
              flexShrink: 0,
              opacity: !isPinned && !canPin ? 0.35 : undefined,
            }}
          >
            {isPinned ? "★" : "☆"}
          </button>
          <button
            className="task-delete tap-target"
            onClick={() => onDelete(task.id)}
            aria-label="Delete task"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 15,
              lineHeight: 1,
              padding: "0 2px",
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
