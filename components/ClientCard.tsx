"use client";

import { useState, type FormEvent } from "react";
import { TaskListDnD } from "@/components/TaskListDnD";
import { DIGITAL_ANALYSTS } from "@/lib/constants";
import type {
  DigitalAnalyst,
  DigitalClient,
  DigitalClientStatus,
  Task,
  TeamMember,
} from "@/lib/types";

interface Props {
  client: DigitalClient;
  tasks: Task[]; // pre-filtered to this client + sorted by position
  pinnedTaskIds: Set<string>;
  prioritiesFull: boolean;
  recentlyDeletingIds: Set<string>;
  onUpdateClient: (id: string, patch: Partial<DigitalClient>) => void | Promise<void>;
  onArchiveClient: (id: string) => void | Promise<void>;
  onCreateTask: (clientId: string, title: string) => void | Promise<void>;
  onReorderTask: (taskId: string, newPosition: number) => void | Promise<void>;
  onToggleDone: (id: string, nextDone: boolean) => Promise<void>;
  onUpdateTitle: (id: string, title: string) => Promise<void>;
  onUpdateOwner: (id: string, owner: TeamMember) => Promise<void>;
  onDeleteTask: (id: string) => void;
  onTogglePin: (id: string, isCurrentlyPinned: boolean) => void;
}

export function ClientCard({
  client,
  tasks,
  pinnedTaskIds,
  prioritiesFull,
  recentlyDeletingIds,
  onUpdateClient,
  onArchiveClient,
  onCreateTask,
  onReorderTask,
  onToggleDone,
  onUpdateTitle,
  onUpdateOwner,
  onDeleteTask,
  onTogglePin,
}: Props) {
  const [metaOpen, setMetaOpen] = useState(false);
  const [taskInput, setTaskInput] = useState("");

  const activeTaskCount = tasks.filter((t) => t.status === "Todo").length;
  const daysRemaining = computeDaysRemaining(client.end_date);

  function handleTaskSubmit(e: FormEvent) {
    e.preventDefault();
    const title = taskInput.trim();
    if (!title) return;
    onCreateTask(client.id, title);
    setTaskInput("");
  }

  function toggleMeta() {
    setMetaOpen((v) => !v);
  }

  return (
    <section className={`client-card${metaOpen ? " is-meta-open" : ""}`}>
      <header className="client-card-summary">
        <div className="client-card-summary-main">
          <h3 className="client-card-name">{client.name}</h3>
          <div className="client-card-meta">
            <span className="client-card-analyst">{client.analyst}</span>
            {client.status === "upcoming" && (
              <span className="client-card-status-pill">Upcoming</span>
            )}
            {client.status === "active" && client.start_date && client.end_date && (
              <span className="client-card-dates">
                {formatDateShort(client.start_date)} – {formatDateShort(client.end_date)}
              </span>
            )}
          </div>
        </div>
        <div className="client-card-summary-stats">
          {client.status === "active" && client.total_posts_target != null && (
            <span className="client-card-progress">
              {client.current_posts} / {client.total_posts_target} posts
            </span>
          )}
          {daysRemaining != null && (
            <span className="client-card-days">
              {daysRemaining > 0
                ? `${daysRemaining}d left`
                : daysRemaining === 0
                  ? "ends today"
                  : `${-daysRemaining}d overdue`}
            </span>
          )}
          <span className="client-card-task-count">
            {activeTaskCount} {activeTaskCount === 1 ? "task" : "tasks"}
          </span>
          <button
            type="button"
            className="client-card-meta-toggle"
            onClick={toggleMeta}
            aria-expanded={metaOpen}
            aria-label={metaOpen ? "Hide details" : "Edit details"}
          >
            {metaOpen ? "✕" : "Details"}
          </button>
        </div>
      </header>

      {metaOpen && (
        <div className="client-card-meta-panel">
          <ClientMetaEditor client={client} onUpdate={onUpdateClient} />
          <button
            type="button"
            className="client-card-archive"
            onClick={() => {
              if (
                confirm(
                  `Archive ${client.name}? Their tasks will be hidden but kept in the database.`
                )
              ) {
                onArchiveClient(client.id);
              }
            }}
          >
            Archive client
          </button>
        </div>
      )}

      <div className="client-card-tasks">
        <form className="client-card-task-input" onSubmit={handleTaskSubmit}>
          <input
            type="text"
            placeholder={`Add task for ${client.name}…`}
            value={taskInput}
            onChange={(e) => setTaskInput(e.target.value)}
            aria-label={`Add task for ${client.name}`}
          />
        </form>

        <TaskListDnD
          tasks={tasks}
          pinnedTaskIds={pinnedTaskIds}
          prioritiesFull={prioritiesFull}
          recentlyDeletingIds={recentlyDeletingIds}
          onReorder={onReorderTask}
          onToggleDone={onToggleDone}
          onUpdateTitle={onUpdateTitle}
          onUpdateOwner={onUpdateOwner}
          onDelete={onDeleteTask}
          onTogglePin={onTogglePin}
        />
      </div>
    </section>
  );
}

function ClientMetaEditor({
  client,
  onUpdate,
}: {
  client: DigitalClient;
  onUpdate: (id: string, patch: Partial<DigitalClient>) => void | Promise<void>;
}) {
  // Inline editing — fields commit on blur so users can fluidly edit and tab away.
  // V3: current_posts will be sourced from an external API; the input remains
  // here as a manual override and as the display surface.
  return (
    <div className="client-meta-grid">
      <label className="client-meta-field">
        <span>Name</span>
        <input
          type="text"
          defaultValue={client.name}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== client.name) onUpdate(client.id, { name: v });
          }}
        />
      </label>

      <label className="client-meta-field">
        <span>Analyst</span>
        <select
          defaultValue={client.analyst}
          onChange={(e) =>
            onUpdate(client.id, { analyst: e.target.value as DigitalAnalyst })
          }
        >
          {DIGITAL_ANALYSTS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </label>

      <label className="client-meta-field">
        <span>Status</span>
        <select
          defaultValue={client.status}
          onChange={(e) =>
            onUpdate(client.id, {
              status: e.target.value as DigitalClientStatus,
            })
          }
        >
          <option value="active">Active</option>
          <option value="upcoming">Upcoming</option>
        </select>
      </label>

      <label className="client-meta-field">
        <span>Start</span>
        <input
          type="date"
          defaultValue={client.start_date ?? ""}
          onBlur={(e) => onUpdate(client.id, { start_date: e.target.value || null })}
        />
      </label>

      <label className="client-meta-field">
        <span>End</span>
        <input
          type="date"
          defaultValue={client.end_date ?? ""}
          onBlur={(e) => onUpdate(client.id, { end_date: e.target.value || null })}
        />
      </label>

      <label className="client-meta-field">
        <span>Target posts</span>
        <input
          type="number"
          min={0}
          defaultValue={client.total_posts_target ?? ""}
          onBlur={(e) =>
            onUpdate(client.id, {
              total_posts_target: e.target.value ? Number(e.target.value) : null,
            })
          }
        />
      </label>

      <label className="client-meta-field">
        <span>Current posts</span>
        <input
          type="number"
          min={0}
          defaultValue={client.current_posts ?? 0}
          onBlur={(e) =>
            onUpdate(client.id, {
              current_posts: e.target.value ? Number(e.target.value) : 0,
            })
          }
        />
      </label>

      <label className="client-meta-field client-meta-notes">
        <span>Notes</span>
        <textarea
          defaultValue={client.notes ?? ""}
          rows={3}
          onBlur={(e) => onUpdate(client.id, { notes: e.target.value || null })}
        />
      </label>
    </div>
  );
}

function formatDateShort(iso: string): string {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function computeDaysRemaining(endIso: string | null): number | null {
  if (!endIso) return null;
  const end = new Date(endIso + "T00:00:00").getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = end - today.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}
