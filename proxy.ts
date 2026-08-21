import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Cheap first gate only: redirects visitors without a session cookie before
// rendering starts. The authoritative session + permission checks remain in
// requireAdmin()/requirePermission() — this file must never be the only guard.
// Kept self-contained (no shared imports) per the proxy runtime contract.
const SESSION_COOKIE = "cafe_session";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  if (!hasSessionCookie) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
