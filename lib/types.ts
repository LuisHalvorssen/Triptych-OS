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

export interface Task {
  id: string;
  title: string;
  owner: TeamMember;
  context: ContextTag;
  status: Status;
  created_at: string;
}

export interface CategorizeRequest {
  owner: TeamMember;
  title: string;
}

export interface CategorizeResponse {
  context_tag: ContextTag;
}
