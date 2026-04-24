"use client";

import { OWNER_COLORS, TEAM } from "@/lib/constants";
import type { Theme } from "@/lib/theme";
import type { TeamMember } from "@/lib/types";

interface Props {
  currentUser: TeamMember;
  onSwitchUser: (member: TeamMember) => void;
  theme: Theme;
  onToggleTheme: () => void;
}

export function Header({
  currentUser,
  onSwitchUser,
  theme,
  onToggleTheme,
}: Props) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "18px 32px",
        borderBottom: "1px solid var(--divider)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.22em",
            color: "var(--accent-blue)",
            fontFamily: "'Syne', sans-serif",
          }}
        >
          TRIPTYCH
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.22em",
            color: "var(--text-subtle)",
            fontFamily: "'Syne', sans-serif",
          }}
        >
          OS
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {TEAM.map((m) => {
          const active = currentUser === m;
          const color = OWNER_COLORS[m];
          return (
            <button
              key={m}
              onClick={() => onSwitchUser(m)}
              title={`View as ${m}`}
              style={{
                width: 26,
                height: 26,
                borderRadius: "50%",
                background: active ? color : "var(--surface)",
                border: `1.5px solid ${active ? color : "var(--border)"}`,
                color: active ? "#fff" : "var(--text-muted)",
                fontSize: 9,
                fontWeight: 800,
                cursor: "pointer",
                fontFamily: "'Syne', sans-serif",
                transition: "all 0.15s",
              }}
            >
              {m[0]}
            </button>
          );
        })}
        <span
          style={{
            fontSize: 9,
            color: "var(--text-subtle)",
            letterSpacing: "0.1em",
            marginLeft: 2,
            marginRight: 8,
            fontFamily: "'Syne', sans-serif",
          }}
        >
          {currentUser.toUpperCase()}
        </span>

        <button
          onClick={onToggleTheme}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          aria-label="Toggle theme"
          style={{
            width: 26,
            height: 26,
            borderRadius: "50%",
            background: "var(--surface)",
            border: "1.5px solid var(--border)",
            color: "var(--text-secondary)",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            lineHeight: 1,
            transition: "all 0.15s",
          }}
        >
          {theme === "dark" ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
