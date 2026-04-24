import { TEAM, USER_COOKIE, USER_COOKIE_DAYS } from "./constants";
import type { TeamMember } from "./types";

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
