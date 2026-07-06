/**
 * Team helpers — resolves the active team for a given authenticated session.
 */
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

/**
 * Returns the first organization the user owns (their default personal team),
 * or null if they have no teams yet.
 */
export async function getDefaultTeamId(userId: string): Promise<string | null> {
  const membership = await db
    .select({ organizationId: schema.member.organizationId })
    .from(schema.member)
    .where(eq(schema.member.userId, userId))
    .get();

  return membership?.organizationId ?? null;
}
