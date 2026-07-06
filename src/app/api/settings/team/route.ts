import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth/dal";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireSession().catch(() => null);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get first team membership
  const membership = await db
    .select({
      organizationId: schema.member.organizationId,
      role: schema.member.role,
    })
    .from(schema.member)
    .where(eq(schema.member.userId, session.user.id))
    .get();

  if (!membership) {
    return NextResponse.json({ error: "No team found" }, { status: 404 });
  }

  const org = await db
    .select()
    .from(schema.organization)
    .where(eq(schema.organization.id, membership.organizationId))
    .get();

  if (!org) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  // Get all members of this org
  const members = await db
    .select({
      id: schema.member.id,
      userId: schema.member.userId,
      role: schema.member.role,
      createdAt: schema.member.createdAt,
    })
    .from(schema.member)
    .where(eq(schema.member.organizationId, org.id))
    .all();

  // Enrich members with user info
  const enrichedMembers = await Promise.all(
    members.map(async (m) => {
      const u = await db
        .select({ name: schema.user.name, email: schema.user.email })
        .from(schema.user)
        .where(eq(schema.user.id, m.userId))
        .get();
      return { ...m, createdAt: m.createdAt?.toISOString() ?? null, user: u ?? undefined };
    })
  );

  // Get pending invitations
  const invitations = await db
    .select()
    .from(schema.invitation)
    .where(eq(schema.invitation.organizationId, org.id))
    .all();

  const pendingInvitations = invitations
    .filter((inv) => inv.status === "pending")
    .map((inv) => ({
      ...inv,
      expiresAt: inv.expiresAt?.toISOString() ?? null,
    }));

  return NextResponse.json({
    team: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      members: enrichedMembers,
      invitations: pendingInvitations,
    },
  });
}
