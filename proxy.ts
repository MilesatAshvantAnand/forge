/**
 * Next.js 16 Proxy (formerly Middleware) — optimistic redirects only.
 *
 * Per the Next.js 16 authentication guide: Proxy is NOT the security boundary.
 * It performs fast optimistic checks (e.g. "is there a session cookie?") and
 * redirects to /login when clearly unauthenticated. The real authorization
 * is enforced in each route handler via the DAL (`src/lib/auth/dal.ts`).
 *
 * IMPORTANT: This file runs in the Edge Runtime. Do NOT import any Node.js-only
 * modules here (no better-sqlite3, no fs, etc.). Use cookie checks only.
 *
 * Rules:
 *  - /demo and /api/* are always public (no redirect)
 *  - /projects/* is public: visitors get an anonymous session automatically
 *    (see AnonymousSessionBootstrap) and real authorization happens in the
 *    DAL, so redirecting to /login would break the no-sign-in flow
 *  - /settings/* requires a session cookie → redirect to /login if missing.
 *    (Anonymous sessions pass this cookie check; the settings APIs reject
 *    anonymous users server-side via requireRealSession.)
 *  - Everything else (/, /login, /signup, static assets) is public
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Better Auth sets a cookie named "better-auth.session_token" (default)
// We check for the presence of this cookie only — the actual session
// validation (cryptographic verification + DB lookup) happens in the DAL.
const SESSION_COOKIE = "better-auth.session_token";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public paths — never redirect
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/demo") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname === "/"
  ) {
    return NextResponse.next();
  }

  // Protected paths — require a session cookie
  const isProtected = pathname.startsWith("/settings/");

  if (!isProtected) {
    return NextResponse.next();
  }

  // Optimistic session check — cookie presence only
  const sessionCookie = request.cookies.get(SESSION_COOKIE);

  if (!sessionCookie?.value) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except static files and Next internals
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
