export type Status = "Todo" | "Done";

export type ContextTag =
  | "MGMT: Wacomo"
  | "MGMT: Baltazar"
  | "MGMT: Cam Rao"
  | "MGMT: Jev"
  | "MGMT: Yami Club"
  | "Digital"
  | "Internal: Legal"
  | "Internal: Finance"
  | "Internal: Fundraising"
  | "Internal: HR"
  | "Internal: BD";

export type TeamMember = "Jon" | "Luis" | "Aidan" | "Liam";

export type Scope = "internal" | "management" | "digital" | "media";

export type Artist =
  | "Wacomo"
  | "Cam Rao"
  | "Baltazar Lora"
  | "JEV"
  | "Yami Club"
  | "Joshua Bassett";

export type DigitalAnalyst = "Halle" | "Jett" | "Zoe" | "Aurora" | "Annie";

export type DigitalClientStatus = "upcoming" | "active" | "archived";

export interface Task {
  id: string;
  title: string;
  owner: TeamMember;
  context: ContextTag | null;
  status: Status;
  created_at: string;
  scope: Scope;
  artist: Artist | null;
  client_id: string | null;
  // Smaller = higher in list. Used by /management for explicit ordering;
  // null on /internal (which orders by created_at).
  position: number | null;
}

export interface DigitalClient {
  id: string;
  name: string;
  analyst: DigitalAnalyst;
  status: DigitalClientStatus;
  start_date: string | null;
  end_date: string | null;
  total_posts_target: number | null;
  current_posts: number;
  notes: string | null;
  created_at: string;
  archived_at: string | null;
}

export interface CategorizeRequest {
  owner: TeamMember;
  title: string;
}

export interface CategorizeResponse {
  context_tag: ContextTag;
}

export type SlotNumber = 1 | 2 | 3;

export interface TopPriority {
  scope: Scope;
  slot: SlotNumber;
  task_id: string;
  pinned_at: string;
  pinned_by: string;
}
