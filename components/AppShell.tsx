"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Header } from "@/components/Header";
import { Toaster } from "@/components/Toaster";
import { UserSelector } from "@/components/UserSelector";
import { isValidScope, readUserCookie, writeLastTabCookie, writeUserCookie } from "@/lib/cookies";
import {
  applyTheme,
  readThemeCookie,
  writeThemeCookie,
  type Theme,
} from "@/lib/theme";
import type { Scope, TeamMember } from "@/lib/types";

interface AppContextValue {
  currentUser: TeamMember;
  theme: Theme;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error("useApp must be used inside <AppShell>");
  }
  return ctx;
}

export function AppShell({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<TeamMember | null>(null);
  const [theme, setTheme] = useState<Theme>("dark");
  const [hydrated, setHydrated] = useState(false);
  const pathname = usePathname();

  /* eslint-disable react-hooks/set-state-in-effect --
   * Hydrating from document.cookie, which only exists after mount. */
  useEffect(() => {
    const t = readThemeCookie();
    setTheme(t);
    applyTheme(t);
    setCurrentUser(readUserCookie());
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Persist last-visited tab so / can redirect back to it.
  useEffect(() => {
    if (!pathname) return;
    const segment = pathname.split("/")[1];
    if (isValidScope(segment)) writeLastTabCookie(segment);
  }, [pathname]);

  function handleSelectUser(member: TeamMember) {
    writeUserCookie(member);
    setCurrentUser(member);
  }

  function handleToggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    writeThemeCookie(next);
  }

  if (!hydrated) return null;

  if (!currentUser) {
    return (
      <>
        <UserSelector onSelect={handleSelectUser} />
        <Toaster />
      </>
    );
  }

  const activeScope: Scope | null = (() => {
    const segment = pathname?.split("/")[1];
    return isValidScope(segment) ? segment : null;
  })();

  return (
    <AppContext.Provider value={{ currentUser, theme }}>
      <div className="app-shell">
        <Header
          currentUser={currentUser}
          onSwitchUser={handleSelectUser}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          activeScope={activeScope}
        />
        {children}
        <Toaster />
      </div>
    </AppContext.Provider>
  );
}
