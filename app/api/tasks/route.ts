import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseScope } from "@/lib/api-helpers";
import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

// GET /api/tasks?scope=internal
// Returns all tasks for the given scope, sorted newest-first.
export async function GET(req: NextRequest) {
  const scope = parseScope(req.nextUrl.searchParams.get("scope"));
  if (!scope) return jsonError("invalid or missing scope", 400);

  const { data, error } = await supabaseServer()
    .from("tasks")
    .select("*")
    .eq("scope", scope)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[api/tasks] GET error:", error);
    return jsonError(error.message, 500);
  }
  return NextResponse.json({ tasks: data ?? [] });
}

// POST /api/tasks
// Body: { title, owner, context?, status?, scope, artist?, client_id?, position? }
// The scope_bucket_match DB constraint enforces that the right bucket fields
// are set for the scope.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("invalid JSON body", 400);
  }

  const scope = parseScope(typeof body.scope === "string" ? body.scope : null);
  if (!scope) return jsonError("invalid or missing scope", 400);
  if (typeof body.title !== "string" || !body.title.trim()) {
    return jsonError("title required", 400);
  }
  if (typeof body.owner !== "string") {
    return jsonError("owner required", 400);
  }

  const insert = {
    title: body.title,
    owner: body.owner,
    context: body.context ?? null,
    status: body.status ?? "Todo",
    scope,
    artist: body.artist ?? null,
    client_id: body.client_id ?? null,
    position: body.position ?? null,
  };

  const { data, error } = await supabaseServer()
    .from("tasks")
    .insert(insert)
    .select()
    .single();

  if (error) {
    console.error("[api/tasks] POST error:", error);
    return jsonError(error.message, 500);
  }
  return NextResponse.json({ task: data });
}
