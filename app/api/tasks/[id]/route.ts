import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-helpers";
import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

const ALLOWED_FIELDS = new Set([
  "title",
  "owner",
  "context",
  "status",
  "artist",
  "client_id",
  "position",
]);

interface Params {
  params: Promise<{ id: string }>;
}

// PATCH /api/tasks/[id]
// Body is a partial Task. Only whitelisted fields are forwarded.
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
    if (ALLOWED_FIELDS.has(k)) patch[k] = v;
  }
  if (Object.keys(patch).length === 0) {
    return jsonError("no updatable fields in body", 400);
  }

  const { error } = await supabaseServer().from("tasks").update(patch).eq("id", id);
  if (error) {
    console.error("[api/tasks PATCH] error:", error);
    return jsonError(error.message, 500);
  }
  return NextResponse.json({ ok: true });
}

// DELETE /api/tasks/[id]
// Used by the soft-delete commit + the beforeunload keepalive path.
export async function DELETE(_req: NextRequest, ctx: Params) {
  const { id } = await ctx.params;
  if (!id) return jsonError("missing id", 400);

  const { error } = await supabaseServer().from("tasks").delete().eq("id", id);
  if (error) {
    console.error("[api/tasks DELETE] error:", error);
    return jsonError(error.message, 500);
  }
  return NextResponse.json({ ok: true });
}
