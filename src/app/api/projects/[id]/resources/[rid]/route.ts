import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { extractResourceText, type ResourceType } from "@/lib/resources/ingest";
import { readResourceFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; rid: string }> }
) {
  const { id, rid } = await params;

  const resourceRows = await db
    .select()
    .from(schema.resources)
    .where(and(eq(schema.resources.projectId, id), eq(schema.resources.id, rid)))
    .limit(1)
    .all();
  const resource = resourceRows[0];

  if (!resource) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  }

  let content: string | null = null;
  if (
    resource.storagePath &&
    ["notebook", "document", "pdf"].includes(resource.type)
  ) {
    try {
      const buffer = await readResourceFile(resource.storagePath);
      if (buffer) {
        content = await extractResourceText(
          resource.name,
          resource.type as ResourceType,
          buffer
        );
      } else {
        content = resource.summary;
      }
    } catch {
      content = resource.summary;
    }
  }

  return NextResponse.json({
    id: resource.id,
    type: resource.type,
    name: resource.name,
    summary: resource.summary,
    content,
  });
}
