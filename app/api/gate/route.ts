import { NextResponse } from "next/server";
import { GATE_COOKIE, GATE_COOKIE_MAX_AGE, gateToken } from "@/lib/gate";

export const runtime = "edge";

export async function POST(request: Request) {
  const expected = process.env.GATE_PASSWORD;
  if (!expected) {
    return NextResponse.json(
      { error: "Gate not configured" },
      { status: 500 }
    );
  }

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.password || body.password !== expected) {
    // Tiny delay mitigates trivial timing/brute-force attempts.
    await new Promise((r) => setTimeout(r, 300));
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const token = await gateToken(expected);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(GATE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: GATE_COOKIE_MAX_AGE,
    path: "/",
  });
  return res;
}
