import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { mkdirSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import { embedTexts, hasLlmConfigured } from "@/lib/llm/provider";

const DATA_DIR = resolve(process.env.DATA_DIR ?? "./data");

export type ResourceType =
  | "repository"
  | "document"
  | "notebook"
  | "pdf"
  | "image"
  | "video"
  | "cad"
  | "other";

export function classifyResource(filename: string): ResourceType {
  const ext = filename.slice(filename.lastIndexOf(".") + 1).toLowerCase();
  if (ext === "zip") return "repository";
  if (ext === "pdf") return "pdf";
  if (["md", "txt", "rtf"].includes(ext)) return "notebook";
  if (["png", "jpg", "jpeg", "webp", "gif", "heic"].includes(ext)) return "image";
  if (["mp4", "mov", "avi", "webm", "mkv"].includes(ext)) return "video";
  if (["step", "stp", "stl", "iges", "igs", "obj", "3mf"].includes(ext)) return "cad";
  if (["doc", "docx", "csv", "json"].includes(ext)) return "document";
  if (ext === "pptx") return "document";
  return "other";
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  // Dynamic import keeps the heavy PDF engine out of route cold starts
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  return result.text;
}

function chunkText(text: string, resourceName: string) {
  const CHUNK_CHARS = 2400;
  const OVERLAP = 300;
  const chunks: { start: number; end: number; content: string }[] = [];
  const clean = text.replace(/\r\n/g, "\n").trim();
  for (let i = 0; i < clean.length && chunks.length < 60; i += CHUNK_CHARS - OVERLAP) {
    const content = clean.slice(i, i + CHUNK_CHARS).trim();
    if (content.length < 40) continue;
    chunks.push({ start: i, end: i + content.length, content });
  }
  return chunks.map((c, idx) => ({
    id: randomUUID(),
    filePath: `resources/${resourceName}`,
    startLine: idx + 1,
    endLine: idx + 1,
    content: c.content,
  }));
}

export interface IngestResult {
  resourceId: string;
  type: ResourceType;
  indexedChunks: number;
}

/**
 * Attach a non-repository asset to a project. Text-bearing formats
 * (markdown, txt, pdf) are chunked + embedded into the RAG index;
 * binary assets are stored and surfaced to the assistant as available context.
 */
export async function ingestResource(
  projectId: string,
  filename: string,
  buffer: Buffer
): Promise<IngestResult> {
  const type = classifyResource(filename);
  const resourceId = randomUUID();

  const storageDir = join(DATA_DIR, "projects", projectId, "resources");
  mkdirSync(storageDir, { recursive: true });
  const storagePath = join(storageDir, `${resourceId}-${filename}`);
  writeFileSync(storagePath, buffer);

  let indexedChunks = 0;
  let summary: string | null = null;

  if (type === "pdf" || type === "notebook" || type === "document") {
    let text = "";
    try {
      text =
        type === "pdf" ? await extractPdfText(buffer) : buffer.toString("utf-8");
    } catch (err) {
      console.error(`Text extraction failed for ${filename}:`, err);
    }

    if (text.trim().length > 40) {
      const rows = chunkText(text, filename);
      indexedChunks = rows.length;
      summary = text.trim().slice(0, 200);

      let embeddings: (string | null)[] = rows.map(() => null);
      if (hasLlmConfigured()) {
        try {
          const vectors = await embedTexts(
            rows.map((r) => r.content.slice(0, 6000))
          );
          embeddings = vectors.map((v) => JSON.stringify(v));
        } catch (err) {
          console.error("Resource embedding failed:", err);
        }
      }

      rows.forEach((row, i) => {
        db.insert(schema.chunks)
          .values({
            ...row,
            projectId,
            embedding: embeddings[i],
            sourceType: "resource",
          })
          .run();
      });
    }
  }

  db.insert(schema.resources)
    .values({
      id: resourceId,
      projectId,
      type,
      name: filename,
      status: "ready",
      size: buffer.length,
      storagePath,
      summary,
      createdAt: Date.now(),
    })
    .run();

  db.update(schema.projects)
    .set({ updatedAt: Date.now() })
    .where(eq(schema.projects.id, projectId))
    .run();

  return { resourceId, type, indexedChunks };
}

export function listResources(projectId: string) {
  return db
    .select({
      id: schema.resources.id,
      type: schema.resources.type,
      name: schema.resources.name,
      status: schema.resources.status,
      size: schema.resources.size,
      summary: schema.resources.summary,
      createdAt: schema.resources.createdAt,
    })
    .from(schema.resources)
    .where(eq(schema.resources.projectId, projectId))
    .all();
}
