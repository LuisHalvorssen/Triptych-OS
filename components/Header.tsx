"use client";

import { useEffect, useState } from "react";
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
  // Drives the .app-header-scrolled bottom shadow on mobile when the
  // page has scrolled past the header. Cheap passive listener.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 0);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`app-header${scrolled ? " app-header-scrolled" : ""}`}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div className="app-header-brand-wrap">
        <span className="app-header-brand">TRIPTYCH</span>
        <span className="app-header-brand-os">OS</span>
      </div>

      <div className="app-header-avatars">
        {TEAM.map((m) => {
          const active = currentUser === m;
          const color = OWNER_COLORS[m];
          return (
            <button
              key={m}
              onClick={() => onSwitchUser(m)}
              title={m}
              aria-label={`View as ${m}`}
              className={`app-header-avatar${active ? " is-active" : ""}`}
              style={{ ["--owner-color" as string]: color }}
            >
              <span
                className="app-header-avatar-circle"
                style={{
                  background: active ? color : "var(--surface)",
                  color: active ? "#fff" : "var(--text-muted)",
                }}
                aria-hidden="true"
              >
                {m[0]}
              </span>
            </button>
          );
        })}
        <span className="app-header-current">
          {currentUser.toUpperCase()}
        </span>

        <button
          onClick={onToggleTheme}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          aria-label="Toggle theme"
          className="app-header-toggle"
        >
          {theme === "dark" ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
      </div>
    </header>
  );
}
