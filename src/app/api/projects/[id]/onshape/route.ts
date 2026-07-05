import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { eq, and } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import {
  fetchOnshapeDocumentMetadata,
  getOnshapeToken,
} from "@/lib/integrations/onshape";

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

function parseDocumentIdFromUrl(url: string): string | null {
  const match = url.match(/documents\/([a-f0-9]{24})/i);
  return match?.[1] ?? null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);

  const url = typeof body?.url === "string" ? body.url.trim() : "";
  const documentId =
    typeof body?.documentId === "string"
      ? body.documentId
      : url
        ? parseDocumentIdFromUrl(url)
        : null;

  if (!url && !documentId) {
    return NextResponse.json({ error: "Onshape URL is required" }, { status: 400 });
  }

  if (url && !url.includes("onshape.com")) {
    return NextResponse.json(
      { error: "Paste a valid Onshape document URL (cad.onshape.com)" },
      { status: 400 }
    );
  }

  // If the account is connected via OAuth, pull real document metadata
  // (element list, assemblies, part studios) into the project scope.
  let name =
    typeof body?.name === "string" && body.name.trim()
      ? body.name.trim()
      : url
        ? parseOnshapeName(url)
        : "Onshape document";
  let externalUrl = url || null;
  let metadataJson: string | null = null;
  let summary = url || "Onshape document";

  if (documentId) {
    const token = await getOnshapeToken(id);
    if (token) {
      try {
        const meta = await fetchOnshapeDocumentMetadata(token, documentId);
        name = meta.name;
        externalUrl = meta.url;
        metadataJson = JSON.stringify(meta);
        summary =
          [
            meta.assemblies.length > 0
              ? `Assemblies: ${meta.assemblies.join(", ")}`
              : null,
            meta.partStudios.length > 0
              ? `Part studios: ${meta.partStudios.join(", ")}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ") || meta.url;
      } catch (err) {
        console.error("Onshape metadata fetch failed, storing link only:", err);
      }
    }
  }

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
      summary,
      externalUrl,
      externalProvider: "onshape",
      metadata: metadataJson,
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
    url: externalUrl,
    metadata: metadataJson ? JSON.parse(metadataJson) : null,
  });
}
