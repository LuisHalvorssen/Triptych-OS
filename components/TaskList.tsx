"use client";

import { useMemo, useState } from "react";
import { TAGS, tagStyle } from "@/lib/constants";
import type { ContextTag, Task, TeamMember } from "@/lib/types";
import { TaskRow } from "./TaskRow";

type OwnerFilter = "all" | "mine";
type ContextFilter = "all" | ContextTag;
type Tab = "active" | "closed";

interface Props {
  tasks: Task[];
  currentUser: TeamMember;
  onToggleDone: (id: string, nextDone: boolean) => Promise<void>;
  onUpdateTitle: (id: string, title: string) => Promise<void>;
  onUpdateOwner: (id: string, owner: TeamMember) => Promise<void>;
  onUpdateContext: (id: string, context: ContextTag) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const TABS: { id: Tab; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "closed", label: "Closed" },
];

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="tap-target"
      style={{
        background: active ? "var(--surface-hover)" : "transparent",
        border: `1px solid ${active ? "var(--border-strong)" : "transparent"}`,
        color: active ? "var(--text-primary)" : "var(--text-muted)",
        padding: "6px 12px",
        borderRadius: 2,
        cursor: "pointer",
        fontSize: 10,
        fontFamily: "'Syne', sans-serif",
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        transition: "all 0.12s",
      }}
    >
      {children}
    </button>
  );
}

function ContextFilterSelect({
  value,
  onChange,
  className,
}: {
  value: ContextFilter;
  onChange: (next: ContextFilter) => void;
  className?: string;
}) {
  const isAll = value === "all";
  const style = isAll
    ? { color: "var(--text-muted)", bg: "transparent" }
    : tagStyle(value as ContextTag);

  return (
    <label
      title="Filter by context tag"
      className={className}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        cursor: "pointer",
        minHeight: 32,
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontFamily: "'Syne', sans-serif",
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: style.color,
          background: isAll ? "transparent" : (style as { bg: string }).bg,
          border: `1px solid ${isAll ? "transparent" : "var(--border-strong)"}`,
          padding: "5px 11px",
          borderRadius: 2,
          whiteSpace: "nowrap",
          pointerEvents: "none",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {isAll ? "All Contexts" : value}
        <span style={{ fontSize: 8, opacity: 0.7 }}>▾</span>
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ContextFilter)}
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0,
          cursor: "pointer",
          border: "none",
          background: "transparent",
        }}
      >
        <option value="all">All Contexts</option>
        {TAGS.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TaskList({
  tasks,
  currentUser,
  onToggleDone,
  onUpdateTitle,
  onUpdateOwner,
  onUpdateContext,
  onDelete,
}: Props) {
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>("all");
  const [contextFilter, setContextFilter] = useState<ContextFilter>("all");
  const [tab, setTab] = useState<Tab>("active");

  const scoped = useMemo(() => {
    return tasks.filter((t) => {
      if (ownerFilter === "mine" && t.owner !== currentUser) return false;
      if (contextFilter !== "all" && t.context !== contextFilter) return false;
      return true;
    });
  }, [tasks, ownerFilter, contextFilter, currentUser]);

  const activeTasks = useMemo(
    () => scoped.filter((t) => t.status !== "Done"),
    [scoped]
  );
  const closedTasks = useMemo(
    () => scoped.filter((t) => t.status === "Done"),
    [scoped]
  );

  const visible = tab === "active" ? activeTasks : closedTasks;
  const openCount = useMemo(
    () => tasks.filter((t) => t.status !== "Done").length,
    [tasks]
  );

  return (
    <div className="container-responsive" style={{ paddingBottom: 64 }}>
      {/* Row 1 (desktop + mobile): counts (+ ctx on desktop) ··· All/Mine */}
      <div
        className="filter-row-1"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 0 8px",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <span
            className="open-counter"
            style={{
              fontSize: "1.125rem", // 18px desktop
              color: "var(--text-muted)",
              letterSpacing: "0.08em",
              fontFamily: "'Syne', sans-serif",
              display: "inline-flex",
              alignItems: "baseline",
              gap: 6,
            }}
          >
            <span
              style={{
                color: "var(--text-primary)",
                fontWeight: 600,
                fontSize: "1.125rem",
              }}
            >
              {openCount}
            </span>
            <span style={{ fontSize: "0.8125rem", fontWeight: 400 }}>OPEN</span>
          </span>
        </div>

        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <ContextFilterSelect
            className="filter-ctx-desktop"
            value={contextFilter}
            onChange={setContextFilter}
          />
          <div
            className="filter-ctx-divider"
            style={{ width: 1, height: 14, background: "var(--border)" }}
          />
          <FilterPill
            active={ownerFilter === "all"}
            onClick={() => setOwnerFilter("all")}
          >
            All
          </FilterPill>
          <FilterPill
            active={ownerFilter === "mine"}
            onClick={() => setOwnerFilter("mine")}
          >
            Mine
          </FilterPill>
        </div>
      </div>

      {/* Row 2: tabs (+ ctx on mobile) */}
      <div
        className="filter-tabs-row"
        style={{
          display: "flex",
          borderBottom: "1px solid var(--divider)",
          marginBottom: 2,
          justifyContent: "space-between",
          alignItems: "flex-end",
        }}
      >
        <div style={{ display: "flex" }}>
          {TABS.map((t) => {
            const active = tab === t.id;
            const count =
              t.id === "active" ? activeTasks.length : closedTasks.length;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="tap-target"
                style={{
                  background: "none",
                  border: "none",
                  color: active ? "var(--text-primary)" : "var(--text-muted)",
                  padding: "10px 14px 9px",
                  fontSize: "0.8125rem", // 13px
                  fontFamily: "'Syne', sans-serif",
                  fontWeight: 500,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  borderBottom: `1.5px solid ${active ? "var(--accent-blue)" : "transparent"}`,
                  marginBottom: -1,
                  transition: "all 0.12s",
                  display: "inline-flex",
                  alignItems: "baseline",
                  gap: 6,
                }}
              >
                {t.label}
                <span
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 400,
                    opacity: 0.6,
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ padding: "0 0 4px" }}>
          <ContextFilterSelect
            className="filter-ctx-mobile"
            value={contextFilter}
            onChange={setContextFilter}
          />
        </div>
      </div>

      <div style={{ minHeight: 120 }}>
        {visible.length === 0 ? (
          <div
            style={{
              padding: "52px 0",
              textAlign: "center",
              fontSize: 10,
              color: "var(--text-subtle)",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              fontFamily: "'Syne', sans-serif",
            }}
          >
            {tab === "active" ? "no active tasks" : "no closed tasks"}
          </div>
        ) : (
          visible.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onToggleDone={onToggleDone}
              onUpdateTitle={onUpdateTitle}
              onUpdateOwner={onUpdateOwner}
              onUpdateContext={onUpdateContext}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}
