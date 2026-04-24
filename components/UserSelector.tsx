"use client";

import { OWNER_COLORS, TEAM } from "@/lib/constants";
import type { TeamMember } from "@/lib/types";

interface Props {
  onSelect: (member: TeamMember) => void;
}

export function UserSelector({ onSelect }: Props) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
      }}
    >
      <div
        style={{
          fontFamily: "'Syne', sans-serif",
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.3em",
          fontSize: 11,
          marginBottom: 40,
        }}
      >
        <span style={{ color: "var(--accent-blue)" }}>TRIPTYCH</span>{" "}
        <span style={{ color: "var(--text-subtle)" }}>OS</span>
      </div>
      <div
        style={{
          fontFamily: "'Syne', sans-serif",
          color: "var(--text-secondary)",
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.22em",
          marginBottom: 36,
        }}
      >
        who are you?
      </div>
      <div style={{ display: "flex", gap: 20 }}>
        {TEAM.map((member) => {
          const color = OWNER_COLORS[member];
          return (
            <button
              key={member}
              onClick={() => onSelect(member)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
                background: "none",
                border: "none",
                cursor: "pointer",
                transition: "transform 0.15s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.transform = "scale(1.05)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.transform = "scale(1)")
              }
            >
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: "50%",
                  background: color,
                  border: `2px solid ${color}`,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "'Syne', sans-serif",
                  fontWeight: 800,
                  fontSize: 24,
                }}
              >
                {member[0]}
              </div>
              <span
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.2em",
                  color: "var(--text-secondary)",
                }}
              >
                {member}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
