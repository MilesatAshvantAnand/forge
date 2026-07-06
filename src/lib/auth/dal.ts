/**
 * Data Access Layer (DAL) — per Next.js 16 authentication.md guidance.
 * All session and authorization checks go through here; never do raw cookie
 * reads or DB membership queries in route handlers directly.
 *
 * Key invariant: the demo project is public read-only and bypasses the
 * session requirement entirely, so the 5-minute judge demo always works.
 */
import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { DEMO_PROJECT_ID } from "@/lib/demo/constants";

// ─── Errors ──────────────────────────────────────────────────────────────────

export class UnauthorizedError extends Error {
  readonly status = 401;
  constructor(msg = "Authentication required") {
    super(msg);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(msg = "Insufficient permissions") {
    super(msg);
    this.name = "ForbiddenError";
  }
}

// ─── Role ordering ───────────────────────────────────────────────────────────

type Role = "owner" | "admin" | "member" | "viewer";

const ROLE_RANK: Record<string, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
};

function roleAtLeast(actual: string, required: Role): boolean {
  return (ROLE_RANK[actual] ?? 0) >= (ROLE_RANK[required] ?? 0);
}

// ─── Demo grant ──────────────────────────────────────────────────────────────

/** Sentinel returned for the demo project: public, read-only, no session. */
export const DEMO_GRANT = {
  isDemoGrant: true as const,
  role: "viewer" as const,
};

/**
 * True when the project id belongs to the read-only demo project.
 * The demo project intentionally has team_id = NULL.
 */
export function isDemoProjectId(projectId: string): boolean {
  return projectId === DEMO_PROJECT_ID;
}

// ─── Core session getter ─────────────────────────────────────────────────────

/**
 * Cached per-request session lookup.
 * Returns the Better Auth session or null if unauthenticated.
 * Throws UnauthorizedError when called with `throwIfMissing: true`.
 */
export const getSession = cache(async () => {
  const h = await headers();
  return auth.api.getSession({ headers: h });
});

/** Returns the session or throws 401. */
export async function requireSession() {
  const session = await getSession();
  if (!session) throw new UnauthorizedError();
  return session;
}

/**
 * Returns the session or throws — additionally rejecting anonymous (guest)
 * sessions with 403. Use for account-level surfaces (team settings, invites)
 * that only make sense for a real, upgradeable account.
 */
export async function requireRealSession() {
  const session = await requireSession();
  if ((session.user as { isAnonymous?: boolean | null }).isAnonymous) {
    throw new ForbiddenError(
      "Create an account to use this feature — sign up to save your work."
    );
  }
  return session;
}

// ─── Project access ──────────────────────────────────────────────────────────

/**
 * Verifies the caller has at least `minRole` on the given project.
 *
 * - Demo project (`DEMO_PROJECT_ID`) always returns DEMO_GRANT (read-only,
 *   no session required) — so the 5-minute judge demo is never broken.
 * - For real projects: requires an authenticated session whose user is a
 *   member of the project's team with at least `minRole`.
 *
 * Throws UnauthorizedError (401) or ForbiddenError (403) on failure.
 */
export async function requireProjectAccess(
  projectId: string,
  minRole: Role = "viewer"
) {
  // Short-circuit for the public demo project
  if (isDemoProjectId(projectId)) {
    if (minRole !== "viewer") {
      throw new ForbiddenError("The demo project is read-only.");
    }
    return DEMO_GRANT;
  }

  const session = await requireSession();

  // Load the project to get its teamId
  const project = await db
    .select({ teamId: schema.projects.teamId })
    .from(schema.projects)
    .where(eq(schema.projects.id, projectId))
    .get();

  if (!project) {
    // 404-like — treated as forbidden to avoid leaking project existence
    throw new ForbiddenError("Project not found or access denied.");
  }

  // Projects without a teamId are legacy/unowned — only accessible to their
  // creator (we can't enforce that without createdByUserId, so deny for now).
  if (!project.teamId) {
    throw new ForbiddenError("Project has no team — access denied.");
  }

  // Check team membership
  const membership = await db
    .select({ role: schema.member.role })
    .from(schema.member)
    .where(
      and(
        eq(schema.member.organizationId, project.teamId),
        eq(schema.member.userId, session.user.id)
      )
    )
    .get();

  if (!membership) {
    throw new ForbiddenError("You are not a member of this project's team.");
  }

  if (!roleAtLeast(membership.role, minRole)) {
    throw new ForbiddenError(
      `This action requires the '${minRole}' role; you have '${membership.role}'.`
    );
  }

  return { isDemoGrant: false as const, role: membership.role as Role, session };
}
