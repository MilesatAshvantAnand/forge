import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { runIndexingPipeline } from "@/lib/indexer/pipeline";
import { ingestResource } from "@/lib/resources/ingest";
import { DEMO_PROJECT_NAME } from "@/lib/demo/constants";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SAMPLES_DIR = resolve(process.cwd(), "samples");
const SAMPLE_ZIP = resolve(SAMPLES_DIR, "sample-robot.zip");

const DEMO_ASSETS: { file: string }[] = [
  { file: "design-notebook.md" },
  { file: "project-scope.md" },
  { file: "build-log.md" },
  { file: "v5rc-override-1.0-2.pdf" },
  { file: "vex-engineering-book-25-26.pptx" },
];

function findDemoProject() {
  return db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.name, DEMO_PROJECT_NAME))
    .limit(1)
    .all()[0];
}

async function ingestDemoAssets(projectId: string) {
  for (const asset of DEMO_ASSETS) {
    const path = resolve(SAMPLES_DIR, asset.file);
    if (!existsSync(path)) continue;
    const buffer = readFileSync(path);
    try {
      await ingestResource(projectId, asset.file, buffer);
    } catch (err) {
      console.error(`Demo asset ingest failed (${asset.file}):`, err);
    }
  }
}

/** Find or create the pre-indexed demo project */
export async function POST() {
  const existing = findDemoProject();

  if (existing?.status === "ready") {
    return NextResponse.json({ projectId: existing.id, ready: true });
  }

  if (existing?.status === "indexing") {
    return NextResponse.json({ projectId: existing.id, ready: false });
  }

  if (!existsSync(SAMPLE_ZIP)) {
    return NextResponse.json(
      { error: "Demo sample not found. Run locally with samples/sample-robot.zip." },
      { status: 500 }
    );
  }

  const projectId = existing?.id ?? randomUUID();
  const now = Date.now();

  if (!existing) {
    db.insert(schema.projects)
      .values({
        id: projectId,
        name: DEMO_PROJECT_NAME,
        source: "demo",
        status: "indexing",
        indexProgress: JSON.stringify({
          stage: "extract",
          progress: 5,
          message: "Building project knowledge…",
        }),
        createdAt: now,
        updatedAt: now,
      })
      .run();
  } else {
    db.update(schema.projects)
      .set({
        status: "indexing",
        indexProgress: JSON.stringify({
          stage: "extract",
          progress: 5,
          message: "Building project knowledge…",
        }),
        updatedAt: now,
      })
      .where(eq(schema.projects.id, projectId))
      .run();
  }

  const zipBuffer = readFileSync(SAMPLE_ZIP);

  runIndexingPipeline(projectId, DEMO_PROJECT_NAME, zipBuffer).then(async () => {
    await ingestDemoAssets(projectId);
  });

  return NextResponse.json({ projectId, ready: false });
}

export async function GET() {
  const existing = findDemoProject();

  if (!existing) {
    return NextResponse.json({ exists: false });
  }
  return NextResponse.json({
    exists: true,
    projectId: existing.id,
    ready: existing.status === "ready",
  });
}
