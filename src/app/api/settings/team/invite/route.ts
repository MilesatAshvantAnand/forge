import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireRealSession, ForbiddenError } from "@/lib/auth/dal";
import { z } from "zod";

export const dynamic = "force-dynamic";

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["member", "admin", "viewer"]).default("member"),
});

export async function POST(req: NextRequest) {
  // Team invites require a real (non-anonymous) account
  const session = await requireRealSession().catch((err) => {
    return err instanceof ForbiddenError ? { forbidden: err.message } : null;
  });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if ("forbidden" in session) {
    return NextResponse.json({ error: session.forbidden }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { email, role } = parsed.data;

  // Get user's primary team
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

  // Only owners and admins can invite
  if (membership.role !== "owner" && membership.role !== "admin") {
    return NextResponse.json(
      { error: "Only team owners and admins can invite members." },
      { status: 403 }
    );
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await db
    .insert(schema.invitation)
    .values({
      id: randomUUID(),
      organizationId: membership.organizationId,
      email,
      role,
      status: "pending",
      expiresAt,
      inviterId: session.user.id,
    })
    .run();

  return NextResponse.json({ ok: true });
}
