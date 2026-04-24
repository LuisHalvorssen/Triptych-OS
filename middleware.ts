import { NextResponse, type NextRequest } from "next/server";
import { GATE_COOKIE, gateToken } from "@/lib/gate";

export async function middleware(req: NextRequest) {
  const password = process.env.GATE_PASSWORD;

  // Fail open if not configured (local dev without the env var).
  if (!password) return NextResponse.next();

  const expected = await gateToken(password);
  const cookie = req.cookies.get(GATE_COOKIE)?.value;
  if (cookie === expected) return NextResponse.next();

  // Not authed — send to gate. Rewrite (not redirect) so the URL stays the
  // same and we don't bounce between /gate and /.
  const url = req.nextUrl.clone();
  url.pathname = "/gate";
  return NextResponse.rewrite(url);
}

export const config = {
  // Run on everything except the gate itself, its API, Next internals, and
  // static files (anything with a "." in the final path segment).
  matcher: ["/((?!gate|api/gate|_next/static|_next/image|favicon.ico|.*\\.[^/]+$).*)"],
};
