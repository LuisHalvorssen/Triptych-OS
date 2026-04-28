"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { OWNER_COLORS, TAGS, TEAM, tagShortName, tagStyle } from "@/lib/constants";
import { toast } from "@/lib/toast";
import { useSwipe } from "@/lib/useSwipe";
import type { ContextTag, Task, TeamMember } from "@/lib/types";

// Total animation duration: 200ms checkbox + 200ms strikethrough +
// 200ms fade-slide. Slight buffer so the row is fully transparent
// before the underlying state flips it into Closed.
const COMPLETE_ANIMATION_MS = 600;

// Captured at module load so we can flag rows that arrive after the
// page mounted (i.e. were just created in this session) for the
// fade-down enter animation. Tasks loaded from history don't trip
// this since their created_at predates the mount.
const PAGE_MOUNT_TIME =
  typeof window === "undefined" ? 0 : Date.now();

interface Props {
  task: Task;
  isPinned: boolean;
  canPin: boolean; // false when 3 slots full and this task is not already pinned
  isDeleting: boolean; // true during the 200ms exit animation before the row is hidden
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
          padding: "2px 8px",
          borderRadius: 4,
          whiteSpace: "nowrap",
          pointerEvents: "none",
        }}
      >
        <span className="tag-full">{tag}</span>
        <span className="tag-short">{tagShortName(tag)}</span>
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

interface EditableTitleHandle {
  enterEdit: () => void;
}

const EditableTitle = forwardRef<
  EditableTitleHandle,
  {
    value: string;
    onCommit: (next: string) => void;
    muted: boolean;
  }
>(function EditableTitle({ value, onCommit, muted }, ref) {
  const [editing, setEditing] = useState(false);
  // Draft is seeded from `value` when edit mode opens (via setDraft in
  // the entry handlers), so we never need to sync it via an effect.
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleBtnRef = useRef<HTMLButtonElement>(null);
  // Set when the user is intentionally cancelling so the blur that
  // follows doesn't fire commit() with the original value.
  const cancellingRef = useRef(false);
  // Tracks the last known editing state so we can restore focus to
  // the row's title button after exit.
  const wasEditingRef = useRef(false);

  const enterEdit = useCallback(() => {
    setDraft(value);
    setEditing(true);
  }, [value]);

  useImperativeHandle(ref, () => ({ enterEdit }), [enterEdit]);

  useEffect(() => {
    if (editing) {
      const input = inputRef.current;
      if (input) {
        input.focus();
        // Caret at the start so long titles aren't visually clipped
        // from the left. Then select-all so type-to-replace works as
        // people expect; the visible scroll position remains at 0.
        input.setSelectionRange(0, input.value.length);
        input.scrollLeft = 0;
        if (
          typeof window !== "undefined" &&
          window.matchMedia("(max-width: 639px)").matches
        ) {
          // Wait one tick for the keyboard to start opening, then
          // pull the row into the safe area above the keyboard.
          setTimeout(() => {
            input.scrollIntoView({ block: "center", behavior: "smooth" });
          }, 120);
        }
      }
      wasEditingRef.current = true;
    } else if (wasEditingRef.current) {
      wasEditingRef.current = false;
      titleBtnRef.current?.focus();
    }
  }, [editing]);

  function commit() {
    if (cancellingRef.current) {
      cancellingRef.current = false;
      return;
    }
    const trimmed = draft.trim();
    setEditing(false);
    if (trimmed && trimmed !== value) onCommit(trimmed);
  }

  function cancel() {
    cancellingRef.current = true;
    setDraft(value);
    setEditing(false);
  }

  if (editing) {
    return (
      <span className="task-title-edit-wrap">
        <input
          ref={inputRef}
          className="task-title-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          enterKeyHint="done"
        />
        <button
          type="button"
          className="task-title-cancel"
          // preventDefault on mousedown stops the input's blur from
          // firing commit() before our cancel logic runs.
          onMouseDown={(e) => e.preventDefault()}
          onTouchStart={(e) => e.preventDefault()}
          onClick={cancel}
          aria-label="Cancel edit"
          title="Cancel"
        >
          ×
        </button>
      </span>
    );
  }

  return (
    <button
      ref={titleBtnRef}
      className="task-title-btn"
      onClick={() => {
        // On touch, single-tap on the title is just :active feedback —
        // don't open the editor. Editing on mobile happens via the
        // pencil button in the row actions group.
        if (
          typeof window !== "undefined" &&
          window.matchMedia("(hover: none)").matches
        ) {
          return;
        }
        enterEdit();
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
});

export function TaskRow({
  task,
  isPinned,
  canPin,
  isDeleting,
  onToggleDone,
  onUpdateTitle,
  onUpdateOwner,
  onUpdateContext,
  onDelete,
  onTogglePin,
}: Props) {
  const isDone = task.status === "Done";
  const [completing, setCompleting] = useState(false);
  const completeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Run the orange-pop / strikethrough / fade-slide animation, then
  // commit the state change and show an undo toast. Guarded so rapid
  // clicks or fast swipes don't double-fire.
  const triggerComplete = useCallback(() => {
    if (completing || isDone) return;
    setCompleting(true);
    completeTimerRef.current = setTimeout(() => {
      onToggleDone(task.id, true);
      toast.action(
        "Task completed",
        {
          label: "Undo",
          onClick: () => onToggleDone(task.id, false),
        },
        4000
      );
    }, COMPLETE_ANIMATION_MS);
  }, [completing, isDone, onToggleDone, task.id]);

  useEffect(() => {
    return () => {
      if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
    };
  }, []);

  // Swipe-right-to-complete + swipe-left-to-delete on touch devices.
  // Both disabled when the row is already animating out or done.
  // Direction becomes unambiguous once the user moves >0px in either axis.
  const swipe = useSwipe({
    onCompleteRight:
      isDone || completing || isDeleting ? undefined : triggerComplete,
    onCompleteLeft:
      completing || isDeleting ? undefined : () => onDelete(task.id),
    threshold: 100,
  });
  const rawDx = isDone || completing || isDeleting ? 0 : swipe.state.dx;
  const dx = Math.max(-120, Math.min(rawDx, 120));
  const swipeDirection: "left" | "right" | null =
    rawDx > 0 ? "right" : rawDx < 0 ? "left" : null;

  const isFreshlyCreated =
    Date.parse(task.created_at) > PAGE_MOUNT_TIME;
  const editableRef = useRef<{ enterEdit: () => void } | null>(null);

  return (
    <div
      className={`task-row-swipe${completing ? " completing" : ""}${isDeleting ? " deleting" : ""}${isFreshlyCreated ? " task-row-new" : ""}`}
      data-swipe-direction={swipeDirection ?? "none"}
      {...swipe.handlers}
      style={{
        borderBottom: "1px solid var(--row-divider)",
      }}
    >
      {swipeDirection === "right" && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            paddingLeft: 18,
            color: "#FFFFFF",
            fontSize: 20,
            fontWeight: 700,
            pointerEvents: "none",
          }}
        >
          ✓
        </div>
      )}
      {swipeDirection === "left" && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            paddingRight: 18,
            color: "#FFFFFF",
            pointerEvents: "none",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
          </svg>
        </div>
      )}
      <div
        className="task-row task-row-inner"
        style={{
          display: "flex",
          alignItems: "center",
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
          onClick={() => {
            if (isDone) {
              onToggleDone(task.id, false);
            } else {
              triggerComplete();
            }
          }}
          aria-label={isDone ? "Mark as active" : "Mark as done"}
          className="task-checkbox"
          style={{
            flexShrink: 0,
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

        <div className="task-owner-wrap" style={{ flexShrink: 0 }}>
          <OwnerDotSelect
            owner={task.owner}
            onChange={(next) => onUpdateOwner(task.id, next)}
            disabled={isDone}
          />
        </div>

        <EditableTitle
          ref={editableRef}
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
            className="task-edit tap-target"
            onClick={() => editableRef.current?.enterEdit()}
            aria-label="Edit task title"
            title="Edit"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              lineHeight: 1,
              padding: "0 4px",
              flexShrink: 0,
            }}
          >
            ✎
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
