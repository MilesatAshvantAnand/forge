import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const row = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.id, id))
    .get();

  if (!row) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: row.id,
    name: row.name,
    status: row.status,
    source: row.source,
    summary: row.summary,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
    indexProgress: row.indexProgress ? JSON.parse(row.indexProgress) : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
