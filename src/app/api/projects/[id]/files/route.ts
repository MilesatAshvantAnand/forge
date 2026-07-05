import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { and, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const path = req.nextUrl.searchParams.get("path");

  if (!path) {
    return NextResponse.json({ error: "path query param required" }, { status: 400 });
  }

  const row = db
    .select()
    .from(schema.files)
    .where(and(eq(schema.files.projectId, id), eq(schema.files.path, path)))
    .get();

  if (!row) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  return NextResponse.json({
    path: row.path,
    language: row.language,
    size: row.size,
    content: row.content,
  });
}
