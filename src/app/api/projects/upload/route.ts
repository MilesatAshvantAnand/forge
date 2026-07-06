import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { randomUUID } from "crypto";
import { runIndexingPipeline } from "@/lib/indexer/pipeline";
import { getSession } from "@/lib/auth/dal";
import { getDefaultTeamId } from "@/lib/auth/team";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!file.name.endsWith(".zip")) {
    return NextResponse.json({ error: "Only .zip files are supported" }, { status: 400 });
  }
  if (file.size > 50 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 50 MB)" }, { status: 400 });
  }

  const projectId = randomUUID();
  const projectName = file.name.replace(/\.zip$/i, "");
  const now = Date.now();

  // Attribute to the calling user's team if authenticated
  const session = await getSession();
  const teamId = session ? await getDefaultTeamId(session.user.id) : null;
  const createdByUserId = session?.user.id ?? null;

  await db
    .insert(schema.projects)
    .values({
      id: projectId,
      name: projectName,
      source: "zip",
      status: "indexing",
      indexProgress: JSON.stringify({
        stage: "upload",
        progress: 2,
        message: "Upload received",
      }),
      createdAt: now,
      updatedAt: now,
      teamId,
      createdByUserId,
    })
    .run();

  const buffer = Buffer.from(await file.arrayBuffer());

  // Fire-and-forget: client polls /status for progress
  runIndexingPipeline(projectId, projectName, buffer);

  return NextResponse.json({ projectId });
}
