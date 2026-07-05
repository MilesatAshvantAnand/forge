import { readFileSync, existsSync } from "fs";
import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db, schema } from "@/lib/db";

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
    existsSync(resource.storagePath) &&
    ["notebook", "document", "pdf"].includes(resource.type)
  ) {
    try {
      if (resource.type === "pdf") {
        const { PDFParse } = await import("pdf-parse");
        const buffer = readFileSync(resource.storagePath);
        const parser = new PDFParse({ data: new Uint8Array(buffer) });
        const result = await parser.getText();
        content = result.text;
      } else {
        content = readFileSync(resource.storagePath, "utf-8");
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
