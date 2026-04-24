// Shared-password gate.
// Cookie stores an opaque SHA-256(password + SALT) — the password itself
// never leaves the server. SALT is versioned so bumping it invalidates
// every existing session if we ever need to force re-auth.

export const GATE_COOKIE = "triptych-gate";
export const GATE_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const SALT = "triptych-os-gate-v1";

export async function gateToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(password + SALT);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
