// Minimal Database type for the Supabase client. supabase-js 2.100+ infers
// `never` for from()/insert() unless a Database generic is provided.
//
// Each table has a Row (full shape returned by SELECT), Insert (allowed
// shape for INSERT — most fields optional since DB has defaults), and
// Update (partial Row).

import type {
  DigitalClient,
  Scope,
  SlotNumber,
  Task,
  TopPriority,
} from "./types";

type DbTable<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  __InternalSupabase: { PostgrestVersion: "12" };
  public: {
    Tables: {
      tasks: DbTable<Task>;
      top_priorities: DbTable<TopPriority>;
      digital_clients: DbTable<DigitalClient>;
    };
    Views: Record<string, never>;
    Functions: {
      swap_priority_slots: {
        Args: { p_scope: Scope; slot_a: SlotNumber; slot_b: SlotNumber };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
