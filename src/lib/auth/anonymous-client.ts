/**
 * Client-side anonymous session bootstrap.
 *
 * Forge never requires sign-in: the first time a browser has no session, we
 * silently create an anonymous Better Auth user (with its own personal team,
 * created by the server-side user-create hook). The session cookie is
 * long-lived with rolling refresh, so the guest workspace survives reloads.
 *
 * All callers share one in-flight promise so concurrent mounts (layout
 * bootstrap + homepage) never trigger a duplicate anonymous sign-in.
 */

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  isAnonymous?: boolean | null;
}

let inFlight: Promise<SessionUser | null> | null = null;

async function fetchSessionUser(): Promise<SessionUser | null> {
  try {
    const res = await fetch("/api/auth/get-session");
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return (data?.user as SessionUser | undefined) ?? null;
  } catch {
    return null;
  }
}

async function bootstrap(): Promise<SessionUser | null> {
  const existing = await fetchSessionUser();
  if (existing) return existing;

  try {
    const res = await fetch("/api/auth/sign-in/anonymous", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return (data?.user as SessionUser | undefined) ?? (await fetchSessionUser());
  } catch {
    return null;
  }
}

/**
 * Returns the current session user, creating an anonymous one if the browser
 * has no session yet. Never throws; returns null only if sign-in failed
 * (e.g. offline) — the app then behaves like the old logged-out state.
 */
export function ensureAnonymousSession(): Promise<SessionUser | null> {
  if (!inFlight) {
    inFlight = bootstrap().then((user) => {
      // Allow a retry on the next call if bootstrap failed entirely
      if (!user) inFlight = null;
      return user;
    });
  }
  return inFlight;
}
