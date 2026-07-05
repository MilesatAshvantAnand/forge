import { NextRequest, NextResponse } from "next/server";
import {
  getOnshapeToken,
  listOnshapeDocuments,
  onshapeConfigured,
} from "@/lib/integrations/onshape";

export const dynamic = "force-dynamic";

/** List Onshape documents for the connected account (used by the document picker). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!onshapeConfigured()) {
    return NextResponse.json({ connected: false, configured: false, documents: [] });
  }

  const token = await getOnshapeToken(id);
  if (!token) {
    return NextResponse.json({ connected: false, configured: true, documents: [] });
  }

  try {
    const documents = await listOnshapeDocuments(token);
    return NextResponse.json({ connected: true, configured: true, documents });
  } catch (err) {
    console.error("Onshape document list failed:", err);
    return NextResponse.json(
      { connected: true, configured: true, documents: [], error: "Failed to list documents" },
      { status: 502 }
    );
  }
}
