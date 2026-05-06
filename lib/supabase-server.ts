import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database";

// Server-only Supabase client using the service_role key. NEVER import
// from a "use client" file. The service_role key bypasses RLS by design;
// the only thing protecting the data is the gate middleware in front of
// every API route that touches this client.
//
// Required env vars (all server-only, no NEXT_PUBLIC_):
//   NEXT_PUBLIC_SUPABASE_URL — actually fine to be public; just the project URL
//   SUPABASE_SERVICE_ROLE_KEY — must NOT be exposed
//
// We still read the URL from NEXT_PUBLIC_SUPABASE_URL to keep one source
// of truth; making it private wouldn't add security (the URL is in DNS).

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const missingServerSupabaseEnvVars: string[] = [
  !url && "NEXT_PUBLIC_SUPABASE_URL",
  !serviceRoleKey && "SUPABASE_SERVICE_ROLE_KEY",
].filter((v): v is string => Boolean(v));

export const isServerSupabaseConfigured =
  missingServerSupabaseEnvVars.length === 0;

// Module singleton. Created lazily so importing this file in test contexts
// without env vars doesn't blow up at module load.
let cached: ReturnType<typeof createClient<Database>> | null = null;

export function supabaseServer() {
  if (!url || !serviceRoleKey) {
    throw new Error(
      `Supabase server client unavailable. Missing: ${missingServerSupabaseEnvVars.join(", ")}`
    );
  }
  if (!cached) {
    cached = createClient<Database>(url, serviceRoleKey, {
      auth: {
        // Service role doesn't need session persistence or auto-refresh.
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return cached;
}
