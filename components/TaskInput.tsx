"use client";

import { useEffect, useRef, useState } from "react";
import { OWNER_COLORS, TEAM } from "@/lib/constants";
import type { TeamMember } from "@/lib/types";

interface Props {
  currentUser: TeamMember;
  onCreate: (owner: TeamMember, title: string) => Promise<boolean>;
}

const LOADING_LABELS = [
  "reading context...",
  "assigning tag...",
  "almost done...",
];

export function TaskInput({ currentUser, onCreate }: Props) {
  const [owner, setOwner] = useState<TeamMember>(currentUser);
  const [taskInput, setTaskInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!loading) return;
    intervalRef.current = setInterval(() => {
      setLoadingStep((s) => (s + 1) % LOADING_LABELS.length);
    }, 650);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loading]);

  async function handleSubmit() {
    if (!taskInput.trim() || loading) return;
    setLoading(true);
    const trimmed = taskInput.trim();
    try {
      const ok = await onCreate(owner, trimmed);
      if (ok) {
        setTaskInput("");
        inputRef.current?.focus();
      }
    } catch (err) {
      console.error("Categorization failed:", err);
    } finally {
      setLoading(false);
      setLoadingStep(0);
    }
  }

  const canSubmit = !!taskInput.trim() && !loading;

  return (
    <div
      className="task-input-outer"
      style={{
        padding: "44px 32px 32px",
        borderBottom: "1px solid var(--divider)",
        background: "var(--bg)",
      }}
    >
      <form
        className="container-responsive"
        style={{ padding: 0 }}
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
          <div className="task-input-select-wrap">
            <select
              className="task-input-select"
              value={owner}
              onChange={(e) => setOwner(e.target.value as TeamMember)}
              aria-label="Task owner"
              style={{ color: OWNER_COLORS[owner] ?? "var(--text-primary)" }}
            >
              {TEAM.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <span className="task-input-select-chevron" aria-hidden="true">
              ▾
            </span>
          </div>

          <div style={{ flex: 1, position: "relative" }}>
            <input
              ref={inputRef}
              className="task-input-field"
              value={loading ? "" : taskInput}
              onChange={(e) => setTaskInput(e.target.value)}
              placeholder={
                loading ? LOADING_LABELS[loadingStep] : "what needs to get done?"
              }
              disabled={loading}
              autoCapitalize="sentences"
              autoCorrect="on"
              enterKeyHint="send"
            />
            {loading && (
              <div
                style={{
                  position: "absolute",
                  right: 14,
                  top: "50%",
                  transform: "translateY(-50%)",
                  display: "flex",
                  gap: 4,
                }}
              >
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: "50%",
                      background: "var(--accent-blue)",
                      animation: `tp-pulse 1.1s ease-in-out ${i * 0.18}s infinite`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            aria-label="Add task"
            className="task-input-submit"
          >
            <span className="task-input-submit-label">ADD</span>
            <span
              className="task-input-submit-icon"
              aria-hidden="true"
              style={{ fontSize: 20, lineHeight: 1 }}
            >
              +
            </span>
          </button>
        </div>

        <div
          className="task-input-helper"
          style={{
            marginTop: 10,
            fontSize: 9.5,
            color: "var(--text-subtle)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            fontFamily: "'Syne', sans-serif",
            textAlign: "center",
          }}
        >
          AI assigns the context tag automatically
        </div>
      </form>
    </div>
  );
}
