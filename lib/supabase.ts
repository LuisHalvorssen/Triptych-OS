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

/**
 * Fire-and-forget DELETE that survives page unload via fetch's `keepalive`
 * flag. Used by the soft-delete-with-undo path: when a tab is closing and
 * we still hold pending deletes from the 4-second undo window, we commit
 * them right now so they don't silently linger in the DB. Returns
 * immediately — caller doesn't await.
 */
export function syncDeleteTaskOnUnload(id: string): void {
  if (!url || !anonKey) return;
  try {
    fetch(`${url}/rest/v1/tasks?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
      keepalive: true,
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    });
  } catch {
    // Best-effort. The user is already navigating away.
  }
}
