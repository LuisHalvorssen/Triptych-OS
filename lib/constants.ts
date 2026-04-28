import type { ContextTag, Status, TeamMember } from "./types";

export const TEAM: TeamMember[] = ["Jon", "Luis", "Aidan", "Liam"];

export const OWNER_COLORS: Record<TeamMember, string> = {
  Jon: "#E85533",
  Luis: "#3333CC",
  Aidan: "#33AA77",
  Liam: "#CC33AA",
};

export const TAGS: ContextTag[] = [
  "MGMT: Wacomo",
  "MGMT: Baltazar",
  "MGMT: Cam Rao",
  "MGMT: Jev",
  "MGMT: Yami Club",
  "Digital",
  "Internal: Legal",
  "Internal: Finance",
  "Internal: Fundraising",
  "Internal: HR",
  "Internal: BD",
];

export const DEFAULT_TAG: ContextTag = "Internal: BD";

export interface TagStyle {
  color: string;
  bg: string;
}

interface TagColorPair {
  light: TagStyle;
  dark: TagStyle;
}

// Light: pastel fill + saturated text. Dark: low-alpha saturated fill +
// lifted text. Hand-tuned for AA on both card surfaces.
const TAG_COLORS: Record<ContextTag, TagColorPair> = {
  "MGMT: Wacomo": {
    light: { bg: "#E8F0FE", color: "#1A56DB" },
    dark: { bg: "rgba(26, 86, 219, 0.20)", color: "#7AB0FF" },
  },
  "MGMT: Baltazar": {
    light: { bg: "#E0E7FF", color: "#4338CA" },
    dark: { bg: "rgba(67, 56, 202, 0.20)", color: "#A5B4FC" },
  },
  "MGMT: Cam Rao": {
    light: { bg: "#DBEAFE", color: "#2563EB" },
    dark: { bg: "rgba(37, 99, 235, 0.20)", color: "#93C5FD" },
  },
  "MGMT: Jev": {
    light: { bg: "#EDE9FE", color: "#6D28D9" },
    dark: { bg: "rgba(109, 40, 217, 0.22)", color: "#C4B5FD" },
  },
  "MGMT: Yami Club": {
    light: { bg: "#E0F2FE", color: "#0369A1" },
    dark: { bg: "rgba(3, 105, 161, 0.22)", color: "#7DD3FC" },
  },
  Digital: {
    light: { bg: "#FFF3E0", color: "#E8530E" },
    dark: { bg: "rgba(232, 83, 14, 0.20)", color: "#FF8A50" },
  },
  "Internal: Legal": {
    light: { bg: "#E6F4EA", color: "#137333" },
    dark: { bg: "rgba(19, 115, 51, 0.22)", color: "#6EE7B7" },
  },
  "Internal: Finance": {
    light: { bg: "#E0F2F1", color: "#00796B" },
    dark: { bg: "rgba(0, 121, 107, 0.22)", color: "#5EEAD4" },
  },
  "Internal: Fundraising": {
    light: { bg: "#FFF8E1", color: "#F57F17" },
    dark: { bg: "rgba(245, 127, 23, 0.22)", color: "#FCD34D" },
  },
  "Internal: HR": {
    light: { bg: "#FCE4EC", color: "#C62828" },
    dark: { bg: "rgba(198, 40, 40, 0.20)", color: "#FCA5A5" },
  },
  "Internal: BD": {
    light: { bg: "#E8F5E9", color: "#2E7D32" },
    dark: { bg: "rgba(46, 125, 50, 0.22)", color: "#86EFAC" },
  },
};

const FALLBACK_TAG_STYLE: TagColorPair = {
  light: { bg: "#F0F0F0", color: "#666666" },
  dark: { bg: "rgba(255,255,255,0.06)", color: "#9CA3AF" },
};

function currentTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.getAttribute("data-theme") === "light"
    ? "light"
    : "dark";
}

export function tagStyle(tag: ContextTag): TagStyle {
  const pair = TAG_COLORS[tag] ?? FALLBACK_TAG_STYLE;
  return currentTheme() === "light" ? pair.light : pair.dark;
}

// Mobile-friendly short names. The color identifies the category, so the
// "INTERNAL:" / "MGMT:" prefix is redundant when space is tight.
const SHORT_NAMES: Record<ContextTag, string> = {
  "MGMT: Wacomo": "WACOMO",
  "MGMT: Baltazar": "BALTAZAR",
  "MGMT: Cam Rao": "CAM RAO",
  "MGMT: Jev": "JEV",
  "MGMT: Yami Club": "YAMI CLUB",
  Digital: "DIGITAL",
  "Internal: Legal": "LEGAL",
  "Internal: Finance": "FINANCE",
  "Internal: Fundraising": "FUNDRAISE",
  "Internal: HR": "HR",
  "Internal: BD": "BD",
};

export function tagShortName(tag: ContextTag): string {
  return SHORT_NAMES[tag] ?? tag;
}

export interface StatusStyle {
  color: string;
  bg?: string;
  border: string;
}

export const STATUS_CONFIG: Record<Status, StatusStyle> = {
  Todo: { color: "#555555", border: "#2A2A2A" },
  Done: {
    color: "#3A8A5A",
    bg: "rgba(58,138,90,0.08)",
    border: "#3A8A5A",
  },
};

export const USER_COOKIE = "triptych-user";
export const USER_COOKIE_DAYS = 30;
