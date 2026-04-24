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
    if (loading) {
      intervalRef.current = setInterval(() => {
        setLoadingStep((s) => (s + 1) % LOADING_LABELS.length);
      }, 650);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setLoadingStep(0);
    }
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
      // eslint-disable-next-line no-console
      console.error("Categorization failed:", err);
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = !!taskInput.trim() && !loading;

  return (
    <div
      style={{
        padding: "44px 32px 32px",
        borderBottom: "1px solid var(--divider)",
        background: "var(--bg)",
      }}
    >
      <div style={{ maxWidth: 740, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
          <select
            value={owner}
            onChange={(e) => setOwner(e.target.value as TeamMember)}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 2,
              color: OWNER_COLORS[owner] ?? "var(--text-primary)",
              padding: "13px 14px",
              fontSize: 12,
              fontFamily: "'Syne', sans-serif",
              fontWeight: 800,
              cursor: "pointer",
              flexShrink: 0,
              outline: "none",
              letterSpacing: "0.05em",
              appearance: "none",
              WebkitAppearance: "none",
              minWidth: 72,
            }}
          >
            {TEAM.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <div style={{ flex: 1, position: "relative" }}>
            <input
              ref={inputRef}
              value={loading ? "" : taskInput}
              onChange={(e) => setTaskInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder={
                loading ? LOADING_LABELS[loadingStep] : "what needs to get done?"
              }
              disabled={loading}
              style={{
                width: "100%",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 2,
                color: "var(--text-primary)",
                padding: "13px 44px 13px 16px",
                fontSize: 13,
                fontFamily: "'IBM Plex Mono', monospace",
                outline: "none",
                boxSizing: "border-box",
                transition: "border-color 0.15s",
                letterSpacing: "-0.01em",
              }}
              onFocus={(e) =>
                (e.currentTarget.style.borderColor = "var(--accent-blue)")
              }
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
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
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              background: canSubmit ? "var(--accent-blue)" : "var(--surface)",
              border: `1px solid ${canSubmit ? "var(--accent-blue)" : "var(--border)"}`,
              color: canSubmit ? "#fff" : "var(--text-subtle)",
              padding: "13px 22px",
              borderRadius: 2,
              cursor: canSubmit ? "pointer" : "not-allowed",
              fontSize: 11,
              fontFamily: "'Syne', sans-serif",
              fontWeight: 800,
              letterSpacing: "0.1em",
              flexShrink: 0,
              transition: "all 0.15s",
            }}
          >
            ADD
          </button>
        </div>

        <div
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
      </div>
    </div>
  );
}
