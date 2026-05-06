import "server-only";
import { NextResponse } from "next/server";
import { SCOPES } from "@/lib/constants";
import type { Scope } from "@/lib/types";

// Tiny helpers used across API routes.

export function jsonError(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function parseScope(value: string | null): Scope | null {
  if (!value) return null;
  return (SCOPES as readonly string[]).includes(value) ? (value as Scope) : null;
}

export function parseSlot(value: unknown): 1 | 2 | 3 | null {
  const n = typeof value === "string" ? parseInt(value, 10) : (value as number);
  return n === 1 || n === 2 || n === 3 ? n : null;
}
