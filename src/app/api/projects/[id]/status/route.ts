import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const row = db
    .select({
      status: schema.projects.status,
      indexProgress: schema.projects.indexProgress,
    })
    .from(schema.projects)
    .where(eq(schema.projects.id, id))
    .get();

  if (!row) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json({
    status: row.status,
    progress: row.indexProgress ? JSON.parse(row.indexProgress) : null,
  });
}
