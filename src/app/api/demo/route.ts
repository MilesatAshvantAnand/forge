import { NextResponse } from "next/server";
import { DEMO_PROJECT_ID } from "@/lib/demo/constants";
import { ensureDemoSeeded } from "@/lib/demo/seed";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * The demo project is deterministic and identical for everyone, so instead of
 * indexing at runtime (which wrote to an ephemeral, per-instance filesystem
 * and caused "project not found" on the next request), we seed a committed
 * snapshot into whatever DB this instance has. Fixed id → stable URL that any
 * instance can serve. See src/lib/demo/seed.ts.
 */
export async function POST() {
  await ensureDemoSeeded(DEMO_PROJECT_ID);
  return NextResponse.json({ projectId: DEMO_PROJECT_ID, ready: true });
}

export async function GET() {
  await ensureDemoSeeded(DEMO_PROJECT_ID);
  return NextResponse.json({
    exists: true,
    projectId: DEMO_PROJECT_ID,
    ready: true,
  });
}
