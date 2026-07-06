import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { desc, eq, inArray } from "drizzle-orm";
import { getSession } from "@/lib/auth/dal";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();

  // Unauthenticated: return empty list — the homepage shows the demo CTA.
  if (!session) {
    return NextResponse.json({ projects: [] });
  }

  // Load all org IDs the user is a member of
  const memberships = await db
    .select({ organizationId: schema.member.organizationId })
    .from(schema.member)
    .where(eq(schema.member.userId, session.user.id))
    .all();

  if (memberships.length === 0) {
    return NextResponse.json({ projects: [] });
  }

  const orgIds = memberships.map((m) => m.organizationId);

  const rows = await db
    .select({
      id: schema.projects.id,
      name: schema.projects.name,
      status: schema.projects.status,
      metadata: schema.projects.metadata,
      createdAt: schema.projects.createdAt,
    })
    .from(schema.projects)
    .where(inArray(schema.projects.teamId, orgIds))
    .orderBy(desc(schema.projects.createdAt))
    .limit(12)
    .all();

  const projects = rows.map((r) => {
    const meta = r.metadata ? JSON.parse(r.metadata) : null;
    return {
      id: r.id,
      name: r.name,
      status: r.status,
      createdAt: r.createdAt,
      totalFiles: meta?.totalFiles ?? 0,
      libraries: meta?.libraries?.map((l: { name: string }) => l.name) ?? [],
    };
  });

  return NextResponse.json({ projects });
}
