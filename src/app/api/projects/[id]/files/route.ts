import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { embedTexts, hasLlmConfigured } from "@/lib/llm/provider";
import { defaultDataDir } from "@/lib/runtime-paths";

export const dynamic = "force-dynamic";

const DATA_DIR = defaultDataDir();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const path = req.nextUrl.searchParams.get("path");

  if (!path) {
    return NextResponse.json({ error: "path query param required" }, { status: 400 });
  }

  const row = await db
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

const CHUNK_LINES = 60;
const OVERLAP_LINES = 10;

/** Re-chunk a single file after an edit (incremental — leaves other files' chunks intact). */
async function rechunkFile(projectId: string, filePath: string, content: string) {
  await db
    .delete(schema.chunks)
    .where(
      and(
        eq(schema.chunks.projectId, projectId),
        eq(schema.chunks.filePath, filePath),
        eq(schema.chunks.sourceType, "code")
      )
    )
    .run();

  if (!/\.(cpp|hpp|c|h|java|py|md)$/.test(filePath)) return;

  const lines = content.split("\n");
  const rows: {
    id: string;
    projectId: string;
    filePath: string;
    startLine: number;
    endLine: number;
    content: string;
    embedding: string | null;
  }[] = [];
  for (let start = 0; start < lines.length; start += CHUNK_LINES - OVERLAP_LINES) {
    const end = Math.min(start + CHUNK_LINES, lines.length);
    const text = lines.slice(start, end).join("\n").trim();
    if (text.length >= 50) {
      rows.push({
        id: randomUUID(),
        projectId,
        filePath,
        startLine: start + 1,
        endLine: end,
        content: text,
        embedding: null,
      });
    }
    if (end >= lines.length) break;
  }

  if (hasLlmConfigured() && rows.length > 0) {
    try {
      const vectors = await embedTexts(
        rows.map((r) => `// ${r.filePath}\n${r.content}`.slice(0, 6000))
      );
      vectors.forEach((v, i) => {
        rows[i].embedding = JSON.stringify(v);
      });
    } catch (err) {
      console.error("Re-embed failed after edit (keyword search still works):", err);
    }
  }

  for (const row of rows) {
    await db.insert(schema.chunks).values({ ...row, sourceType: "code" }).run();
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);

  const path = typeof body?.path === "string" ? body.path : null;
  const content = typeof body?.content === "string" ? body.content : null;

  if (!path || content === null) {
    return NextResponse.json(
      { error: "path and content are required" },
      { status: 400 }
    );
  }

  const row = await db
    .select()
    .from(schema.files)
    .where(and(eq(schema.files.projectId, id), eq(schema.files.path, path)))
    .get();

  if (!row) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const size = Buffer.byteLength(content, "utf-8");
  await db
    .update(schema.files)
    .set({ content, size })
    .where(and(eq(schema.files.projectId, id), eq(schema.files.path, path)))
    .run();

  // Mirror to disk for consistency with the extracted repo (best effort —
  // the DB copy is the source of truth for the editor and RAG)
  try {
    const diskPath = join(DATA_DIR, "projects", id, path);
    if (existsSync(dirname(diskPath))) {
      writeFileSync(diskPath, content);
    } else {
      mkdirSync(dirname(diskPath), { recursive: true });
      writeFileSync(diskPath, content);
    }
  } catch (err) {
    console.error("Disk mirror failed for edited file:", err);
  }

  await rechunkFile(id, path, content);

  await db
    .update(schema.projects)
    .set({ updatedAt: Date.now() })
    .where(eq(schema.projects.id, id))
    .run();

  return NextResponse.json({ ok: true, path, size });
}
