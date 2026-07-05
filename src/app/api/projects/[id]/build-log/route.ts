import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, resolve } from "path";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

const DATA_DIR = resolve(process.env.DATA_DIR ?? "./data");
const SAMPLES_DIR = resolve(process.cwd(), "samples");
const LOG_FILENAME = "log.md";

function logPath(projectId: string) {
  return join(DATA_DIR, "projects", projectId, "resources", LOG_FILENAME);
}

function ensureLog(projectId: string): string {
  const dir = join(DATA_DIR, "projects", projectId, "resources");
  mkdirSync(dir, { recursive: true });
  const path = logPath(projectId);
  if (!existsSync(path)) {
    const samplePath = join(SAMPLES_DIR, "build-log.md");
    const header = existsSync(samplePath)
      ? readFileSync(samplePath, "utf-8")
      : `# Build Log\n\n> Recorded by Forge while you build.\n\n`;
    writeFileSync(path, header, "utf-8");
  }
  return path;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const path = ensureLog(id);
  const content = readFileSync(path, "utf-8");
  return NextResponse.json({ content, filename: LOG_FILENAME });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const entry = typeof body?.entry === "string" ? body.entry.trim() : "";
  if (!entry) {
    return NextResponse.json({ error: "entry required" }, { status: 400 });
  }

  const path = ensureLog(id);
  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  const block = `\n## ${stamp}\n\n${entry}\n`;
  writeFileSync(path, readFileSync(path, "utf-8") + block, "utf-8");

  const existing = db
    .select()
    .from(schema.resources)
    .where(eq(schema.resources.projectId, id))
    .all()
    .find((r) => r.name === LOG_FILENAME);

  if (!existing) {
    db.insert(schema.resources)
      .values({
        id: randomUUID(),
        projectId: id,
        type: "notebook",
        name: LOG_FILENAME,
        status: "ready",
        size: Buffer.byteLength(block),
        storagePath: path,
        summary: entry.slice(0, 200),
        createdAt: Date.now(),
      })
      .run();
  } else {
    db.update(schema.resources)
      .set({
        size: readFileSync(path).length,
        summary: entry.slice(0, 200),
      })
      .where(eq(schema.resources.id, existing.id))
      .run();
  }

  return NextResponse.json({ ok: true });
}
