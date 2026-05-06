import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-helpers";
import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

// GET /api/clients
export async function GET() {
  const { data, error } = await supabaseServer()
    .from("digital_clients")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[api/clients] GET error:", error);
    return jsonError(error.message, 500);
  }
  return NextResponse.json({ clients: data ?? [] });
}

const CREATE_FIELDS = new Set([
  "name",
  "analyst",
  "status",
  "start_date",
  "end_date",
  "total_posts_target",
  "current_posts",
  "notes",
]);

// POST /api/clients
// Body: NewClientPayload-shaped (see components/NewClientForm.tsx).
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("invalid JSON body", 400);
  }

  if (typeof body.name !== "string" || !body.name.trim()) {
    return jsonError("name required", 400);
  }
  if (typeof body.analyst !== "string") {
    return jsonError("analyst required", 400);
  }

  const insert: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (CREATE_FIELDS.has(k)) insert[k] = v;
  }

  const { data, error } = await supabaseServer()
    .from("digital_clients")
    .insert(insert)
    .select()
    .single();

  if (error) {
    console.error("[api/clients] POST error:", error);
    return jsonError(error.message, 500);
  }
  return NextResponse.json({ client: data });
}
