import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const missingSupabaseEnvVars: string[] = [
  !url && "NEXT_PUBLIC_SUPABASE_URL",
  !anonKey && "NEXT_PUBLIC_SUPABASE_ANON_KEY",
].filter((v): v is string => Boolean(v));

export const isSupabaseConfigured = missingSupabaseEnvVars.length === 0;

// When env vars are missing we still export a client so imports don't throw
// at module load. The app renders <ConfigMissing /> before any call reaches
// this client. If a call somehow does go through, the placeholder URL
// fails at DNS — loud error beats silent stub.
export const supabase = createClient(
  url || "https://placeholder.invalid.supabase.co",
  anonKey || "placeholder-anon-key"
);
