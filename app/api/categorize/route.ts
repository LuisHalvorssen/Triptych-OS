import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { DEFAULT_TAG, TAGS } from "@/lib/constants";
import type { CategorizeResponse, ContextTag } from "@/lib/types";

export const runtime = "nodejs";

const SYSTEM_PROMPT =
  "You are a task router for Triptych Management, a music/media startup in NYC with three divisions: Management (artist management), Digital (TripFlow fan account automation), and Internal. Respond ONLY with valid JSON — no markdown, no explanation.";

function buildUserPrompt(owner: string, title: string): string {
  return `Owner: ${owner}
Task: "${title}"

Owner priors: Jon=all divisions, Luis=Internal/BD/fundraising, Aidan=Digital, Liam=Management/BD

Tag the task. Copy context_tag verbatim from the left side only.

Rules (apply in order):
1. On-roster artist + any work → use their MGMT tag, not Digital/Legal/HR.
2. Off-roster client + legal/contracts → Digital, not Internal: Legal.
3. Internal contracts (incorporation, MOUs, JVs, partner agreements) → Internal: Legal.
4. Investor conversations, SAFEs, cap table → Internal: Fundraising, not Internal: Finance.
5. Digital = off-roster clients (Mt. Joy, Claire Brooks, Lila Drew, flipturn, Empire Records, etc.) and TripFlow platform work only.

Tags:
"MGMT: Wacomo"          — Wacomo, Lucas Wiseman
"MGMT: Baltazar"        — Baltazar Lora, Balt
"MGMT: Cam Rao"         — Cam Rao, Cameron Rao
"MGMT: Jev"             — Jev, Jack Evershed, Marcus Dergosits
"MGMT: Yami Club"       — Yami Club, Tito, Berlin
"Digital"               — TripFlow, fan accounts, off-roster digital clients
"Internal: Legal"       — entity formation, C-Corp, MOUs, JVs, partner agreements
"Internal: Finance"     — accounting, taxes, banking, payroll, CFO
"Internal: Fundraising" — investors, SAFEs, Carta, cap table
"Internal: HR"          — hiring, offer letters, onboarding, employment agreements
"Internal: BD"          — new clients, partnerships, pipeline, marketing, website

Examples:
{"task":"JEV to sign Haverford contract","owner":"Jon"} → {"context_tag":"MGMT: Jev"}
{"task":"Finish conversion to C Corp","owner":"Luis"} → {"context_tag":"Internal: Legal"}
{"task":"Issue SAFEs to new investors","owner":"Jon"} → {"context_tag":"Internal: Fundraising"}
{"task":"Review TripFlow analytics for Mt. Joy","owner":"Aidan"} → {"context_tag":"Digital"}
{"task":"Send offer letter to Liam","owner":"Luis"} → {"context_tag":"Internal: HR"}
{"task":"Get Mt. Joy to sign digital services agreement","owner":"Liam"} → {"context_tag":"Digital"}

Respond ONLY with JSON, no code fences:
{"context_tag":"<exact tag>"}`;
}

function extractText(content: Anthropic.ContentBlock[]): string {
  for (const block of content) {
    if (block.type === "text") return block.text;
  }
  return "";
}

function safeParse(raw: string): { context_tag?: string } {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return {};
      }
    }
    return {};
  }
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    );
  }

  let body: { owner?: string; title?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const owner = body.owner?.trim();
  const title = body.title?.trim();
  if (!owner || !title) {
    return NextResponse.json(
      { error: "owner and title are required" },
      { status: 400 }
    );
  }

  const client = new Anthropic({ apiKey });

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 60,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(owner, title) }],
    });

    const text = extractText(message.content);
    const parsed = safeParse(text);

    const tag = (TAGS as string[]).includes(parsed.context_tag ?? "")
      ? (parsed.context_tag as ContextTag)
      : DEFAULT_TAG;

    const response: CategorizeResponse = { context_tag: tag };
    return NextResponse.json(response);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[categorize] Anthropic error:", err);
    const fallback: CategorizeResponse = { context_tag: DEFAULT_TAG };
    return NextResponse.json(fallback);
  }
}
