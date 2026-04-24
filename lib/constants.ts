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

export function tagStyle(tag: ContextTag): TagStyle {
  if (tag.startsWith("MGMT")) {
    return { color: "#6688EE", bg: "rgba(51,51,204,0.1)" };
  }
  if (tag === "Digital") {
    return { color: "#EE7744", bg: "rgba(204,85,51,0.1)" };
  }
  return { color: "#888", bg: "rgba(120,120,120,0.08)" };
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
