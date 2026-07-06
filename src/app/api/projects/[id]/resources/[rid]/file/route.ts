import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { readResourceFile } from "@/lib/storage";
import { ensureDemoSeeded } from "@/lib/demo/seed";

export const dynamic = "force-dynamic";

const MIME_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  md: "text/markdown",
  txt: "text/plain",
  csv: "text/csv",
  json: "application/json",
  step: "application/step",
  stp: "application/step",
  stl: "model/stl",
};

/** Serve the raw stored file for a resource (used for PDF embedding and downloads). */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; rid: string }> }
) {
  const { id, rid } = await params;
  await ensureDemoSeeded(id);

  const rows = await db
    .select()
    .from(schema.resources)
    .where(and(eq(schema.resources.projectId, id), eq(schema.resources.id, rid)))
    .limit(1)
    .all();
  const resource = rows[0];

  if (!resource || !resource.storagePath) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const buffer = await readResourceFile(resource.storagePath);
  if (!buffer) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
  const ext = resource.name.slice(resource.name.lastIndexOf(".") + 1).toLowerCase();
  const mime = MIME_TYPES[ext] ?? "application/octet-stream";
  const download = req.nextUrl.searchParams.get("download") === "1";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(buffer.length),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${encodeURIComponent(resource.name)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
