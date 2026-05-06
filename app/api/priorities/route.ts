import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseScope, parseSlot } from "@/lib/api-helpers";
import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

// GET /api/priorities?scope=internal
export async function GET(req: NextRequest) {
  const scope = parseScope(req.nextUrl.searchParams.get("scope"));
  if (!scope) return jsonError("invalid or missing scope", 400);

  const { data, error } = await supabaseServer()
    .from("top_priorities")
    .select("*")
    .eq("scope", scope)
    .order("slot");

  if (error) {
    console.error("[api/priorities] GET error:", error);
    return jsonError(error.message, 500);
  }
  return NextResponse.json({ priorities: data ?? [] });
}

// POST /api/priorities
// Body: { scope, slot, task_id, pinned_by }
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("invalid JSON body", 400);
  }

  const scope = parseScope(typeof body.scope === "string" ? body.scope : null);
  const slot = parseSlot(body.slot);
  if (!scope) return jsonError("invalid or missing scope", 400);
  if (!slot) return jsonError("invalid or missing slot", 400);
  if (typeof body.task_id !== "string") return jsonError("task_id required", 400);
  if (typeof body.pinned_by !== "string") return jsonError("pinned_by required", 400);

  const { error } = await supabaseServer().from("top_priorities").insert({
    scope,
    slot,
    task_id: body.task_id,
    pinned_by: body.pinned_by,
  });

  if (error) {
    console.error("[api/priorities] POST error:", error);
    return jsonError(error.message, 500);
  }
  return NextResponse.json({ ok: true });
}

// DELETE /api/priorities?scope=internal&slot=2
export async function DELETE(req: NextRequest) {
  const scope = parseScope(req.nextUrl.searchParams.get("scope"));
  const slot = parseSlot(req.nextUrl.searchParams.get("slot"));
  if (!scope) return jsonError("invalid or missing scope", 400);
  if (!slot) return jsonError("invalid or missing slot", 400);

  const { error } = await supabaseServer()
    .from("top_priorities")
    .delete()
    .eq("scope", scope)
    .eq("slot", slot);

  if (error) {
    console.error("[api/priorities] DELETE error:", error);
    return jsonError(error.message, 500);
  }
  return NextResponse.json({ ok: true });
}
