import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { saveResourceFile } from "@/lib/storage";
import { embedTexts, hasLlmConfigured } from "@/lib/llm/provider";
import {
  parseJerryioFile,
  describeAutonPlan,
} from "@/lib/auton/jerryio-parser";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Upload a path.jerryio export as an "auton-plan" resource.
 *
 * Dedicated route (rather than extending classifyResource in ingest.ts)
 * because path.jerryio saves plain .txt files — which extension-based
 * classification would misfile as "notebook" — and because the parsed plan
 * summary + strategy notes need to land in the resource's metadata JSON.
 *
 * Follows the same access model as POST /resources (no session requirement)
 * so the anonymous demo flow keeps working; auth hardening is centralized
 * in the DAL by the auth workstream.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const formData = await req.formData();
  const file = formData.get("file");
  const notes = formData.get("notes");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 5 MB)" }, { status: 400 });
  }

  const project = await db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(eq(schema.projects.id, id))
    .get();
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const text = buffer.toString("utf-8");

  const plan = parseJerryioFile(text);
  if (!plan) {
    return NextResponse.json(
      {
        error:
          "Couldn't find path data in this file. Export it from path.jerryio via File → Save / Download (.txt), without changing the contents.",
      },
      { status: 422 }
    );
  }

  const description = describeAutonPlan(plan);
  const strategyNotes = typeof notes === "string" ? notes.trim() : "";

  const resourceId = randomUUID();
  const storagePath = await saveResourceFile(
    id,
    `${resourceId}-${file.name}`,
    buffer
  );

  await db
    .insert(schema.resources)
    .values({
      id: resourceId,
      projectId: id,
      type: "auton-plan",
      name: file.name,
      status: "ready",
      size: buffer.length,
      storagePath,
      summary: description.slice(0, 300),
      metadata: JSON.stringify({ plan, strategyNotes: strategyNotes || undefined }),
      createdAt: Date.now(),
    })
    .run();

  // Index the summary (+ notes) so chat retrieval can ground strategy talk
  const chunkContent = [
    `Autonomous plan "${file.name}" (from path.jerryio): ${description}`,
    strategyNotes ? `Team strategy notes: ${strategyNotes}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  let embedding: string | null = null;
  if (hasLlmConfigured()) {
    try {
      const [vector] = await embedTexts([chunkContent]);
      embedding = JSON.stringify(vector);
    } catch (err) {
      console.error("Auton plan embedding failed:", err);
    }
  }
  await db
    .insert(schema.chunks)
    .values({
      id: randomUUID(),
      projectId: id,
      filePath: `resources/${file.name}`,
      startLine: 1,
      endLine: 1,
      content: chunkContent,
      embedding,
      sourceType: "resource",
    })
    .run();

  await db
    .update(schema.projects)
    .set({ updatedAt: Date.now() })
    .where(eq(schema.projects.id, id))
    .run();

  return NextResponse.json({ resourceId, plan, description });
}
