export type Theme = "dark" | "light";

const THEME_COOKIE = "triptych-theme";
const THEME_COOKIE_DAYS = 365;

export function readThemeCookie(): Theme {
  if (typeof document === "undefined") return "dark";
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${THEME_COOKIE}=`));
  if (!match) return "dark";
  const value = decodeURIComponent(match.split("=")[1] ?? "");
  return value === "light" ? "light" : "dark";
}

export function writeThemeCookie(theme: Theme): void {
  if (typeof document === "undefined") return;
  const expires = new Date();
  expires.setDate(expires.getDate() + THEME_COOKIE_DAYS);
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; expires=${expires.toUTCString()}; SameSite=Lax`;
}

export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
}
