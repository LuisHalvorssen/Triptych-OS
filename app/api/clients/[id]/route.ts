import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-helpers";
import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

const PATCH_FIELDS = new Set([
  "name",
  "analyst",
  "status",
  "start_date",
  "end_date",
  "total_posts_target",
  "current_posts",
  "notes",
  "archived_at",
]);

interface Params {
  params: Promise<{ id: string }>;
}

// PATCH /api/clients/[id]
export async function PATCH(req: NextRequest, ctx: Params) {
  const { id } = await ctx.params;
  if (!id) return jsonError("missing id", 400);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("invalid JSON body", 400);
  }

  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (PATCH_FIELDS.has(k)) patch[k] = v;
  }
  if (Object.keys(patch).length === 0) {
    return jsonError("no updatable fields in body", 400);
  }

  const { error } = await supabaseServer()
    .from("digital_clients")
    .update(patch)
    .eq("id", id);

  if (error) {
    console.error("[api/clients PATCH] error:", error);
    return jsonError(error.message, 500);
  }
  return NextResponse.json({ ok: true });
}
