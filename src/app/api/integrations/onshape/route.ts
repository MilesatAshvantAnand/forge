import { NextRequest, NextResponse } from "next/server";
import { onshapeAuthorizeUrl, onshapeConfigured } from "@/lib/integrations/onshape";

export const dynamic = "force-dynamic";

/** Kick off the Onshape integration OAuth flow. `projectId` rides along in `state`. */
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }
  if (!onshapeConfigured()) {
    return NextResponse.json(
      {
        error:
          "Onshape OAuth is not configured. Set ONSHAPE_CLIENT_ID and ONSHAPE_CLIENT_SECRET.",
      },
      { status: 501 }
    );
  }
  return NextResponse.redirect(onshapeAuthorizeUrl(projectId));
}
