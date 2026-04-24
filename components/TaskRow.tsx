"use client";

import { useEffect, useRef, useState } from "react";
import { OWNER_COLORS, TAGS, TEAM, tagStyle } from "@/lib/constants";
import type { ContextTag, Task, TeamMember } from "@/lib/types";

interface Props {
  task: Task;
  onToggleDone: (id: string, nextDone: boolean) => void;
  onUpdateTitle: (id: string, title: string) => void;
  onUpdateOwner: (id: string, owner: TeamMember) => void;
  onUpdateContext: (id: string, context: ContextTag) => void;
  onDelete: (id: string) => void;
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
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.1em",
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
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

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
    else setDraft(value);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
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
          fontSize: 12.5,
          color: "var(--text-primary)",
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
      onClick={() => setEditing(true)}
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
        fontSize: 12.5,
        color: muted ? "var(--text-muted)" : "var(--text-primary)",
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
  onToggleDone,
  onUpdateTitle,
  onUpdateOwner,
  onUpdateContext,
  onDelete,
}: Props) {
  const [hovered, setHovered] = useState(false);
  const isDone = task.status === "Done";

  return (
    <div
      className="task-row"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "flex-start",
        flexWrap: "wrap",
        columnGap: 10,
        rowGap: 6,
        padding: "11px 0",
        borderBottom: "1px solid var(--divider)",
        opacity: isDone ? 0.5 : 1,
        transition: "opacity 0.2s",
      }}
    >
      <button
        onClick={() => onToggleDone(task.id, !isDone)}
        aria-label={isDone ? "Mark as active" : "Mark as done"}
        style={{
          width: 17,
          height: 17,
          marginTop: 3,
          borderRadius: "50%",
          flexShrink: 0,
          border: isDone ? "none" : "1.5px solid var(--border-strong)",
          background: isDone
            ? "#3A8A5A"
            : hovered
              ? "var(--surface-hover)"
              : "transparent",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          transition: "all 0.12s",
        }}
      >
        {isDone && (
          <span style={{ color: "#fff", fontSize: 9, lineHeight: 1 }}>✓</span>
        )}
      </button>

      <div style={{ marginTop: 1, flexShrink: 0 }}>
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
          title={`Created ${new Date(task.created_at).toLocaleString()}`}
          style={{
            fontSize: 9,
            fontFamily: "'IBM Plex Mono', monospace",
            color: "var(--text-subtle)",
            letterSpacing: "0.08em",
            whiteSpace: "nowrap",
            opacity: 0.7,
          }}
        >
          {formatCreatedAt(task.created_at)}
        </span>

        <TagPillSelect
          tag={task.context}
          onChange={(next) => onUpdateContext(task.id, next)}
          disabled={isDone}
        />
      </div>

      <button
        className="task-delete"
        onClick={() => onDelete(task.id)}
        aria-label="Delete task"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: hovered ? "var(--text-muted)" : "transparent",
          fontSize: 15,
          lineHeight: 1,
          padding: "0 2px",
          transition: "color 0.12s",
          flexShrink: 0,
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.color = "var(--accent-red)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.color = hovered
            ? "var(--text-muted)"
            : "transparent")
        }
      >
        ×
      </button>
    </div>
  );
}
