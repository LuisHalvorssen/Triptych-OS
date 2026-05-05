import {
  LAST_TAB_COOKIE,
  LAST_TAB_COOKIE_DAYS,
  SCOPES,
  TEAM,
  USER_COOKIE,
  USER_COOKIE_DAYS,
} from "./constants";
import type { Scope, TeamMember } from "./types";

export function readUserCookie(): TeamMember | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${USER_COOKIE}=`));
  if (!match) return null;
  const value = decodeURIComponent(match.split("=")[1] ?? "");
  return (TEAM as string[]).includes(value) ? (value as TeamMember) : null;
}

export function writeUserCookie(member: TeamMember): void {
  if (typeof document === "undefined") return;
  const expires = new Date();
  expires.setDate(expires.getDate() + USER_COOKIE_DAYS);
  document.cookie = `${USER_COOKIE}=${encodeURIComponent(
    member
  )}; path=/; expires=${expires.toUTCString()}; SameSite=Lax`;
}

export function writeLastTabCookie(scope: Scope): void {
  if (typeof document === "undefined") return;
  const expires = new Date();
  expires.setDate(expires.getDate() + LAST_TAB_COOKIE_DAYS);
  document.cookie = `${LAST_TAB_COOKIE}=${encodeURIComponent(
    scope
  )}; path=/; expires=${expires.toUTCString()}; SameSite=Lax`;
}

// Server-side reader counterpart lives inline in app/page.tsx via next/headers.
// Validates the value here so callers don't have to.
export function isValidScope(value: string | undefined | null): value is Scope {
  return typeof value === "string" && (SCOPES as string[]).includes(value);
}
