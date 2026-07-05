import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { eq, and } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export const dynamic = "force-dynamic";

function parseOnshapeName(url: string): string {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const docIdx = parts.indexOf("documents");
    if (docIdx >= 0 && parts[docIdx + 1]) {
      return `Onshape · ${parts[docIdx + 1].slice(0, 8)}…`;
    }
  } catch {
    /* ignore */
  }
  return "Onshape document";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const rows = await db
    .select()
    .from(schema.resources)
    .where(and(eq(schema.resources.projectId, id), eq(schema.resources.type, "cad")))
    .all();
  const links = rows.map((r) => ({
      id: r.id,
      name: r.name,
      url: r.summary?.startsWith("http") ? r.summary : null,
      size: r.size,
      createdAt: r.createdAt,
    }));

  return NextResponse.json({ links });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);

  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!url) {
    return NextResponse.json({ error: "Onshape URL is required" }, { status: 400 });
  }

  if (!url.includes("onshape.com")) {
    return NextResponse.json(
      { error: "Paste a valid Onshape document URL (cad.onshape.com)" },
      { status: 400 }
    );
  }

  const name =
    typeof body?.name === "string" && body.name.trim()
      ? body.name.trim()
      : parseOnshapeName(url);

  const resourceId = randomUUID();
  const now = Date.now();

  await db
    .insert(schema.resources)
    .values({
      id: resourceId,
      projectId: id,
      type: "cad",
      name,
      status: "ready",
      size: 0,
      storagePath: null,
      summary: url,
      createdAt: now,
    })
    .run();

  await db
    .update(schema.projects)
    .set({ updatedAt: now })
    .where(eq(schema.projects.id, id))
    .run();

  return NextResponse.json({
    id: resourceId,
    name,
    url,
  });
}
