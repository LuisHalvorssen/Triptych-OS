import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseScope, parseSlot } from "@/lib/api-helpers";
import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

// POST /api/priorities/swap
// Body: { scope, from, to } — calls the swap_priority_slots RPC.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("invalid JSON body", 400);
  }

  const scope = parseScope(typeof body.scope === "string" ? body.scope : null);
  const from = parseSlot(body.from);
  const to = parseSlot(body.to);
  if (!scope) return jsonError("invalid or missing scope", 400);
  if (!from || !to) return jsonError("invalid from/to slot", 400);

  const { error } = await supabaseServer().rpc("swap_priority_slots", {
    p_scope: scope,
    slot_a: from,
    slot_b: to,
  });

  if (error) {
    console.error("[api/priorities/swap] error:", error);
    return jsonError(error.message, 500);
  }
  return NextResponse.json({ ok: true });
}
