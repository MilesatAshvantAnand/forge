import { NextRequest, NextResponse } from "next/server";
import { githubAuthorizeUrl, githubOAuthConfigured } from "@/lib/integrations/github";

export const dynamic = "force-dynamic";

/** Kick off the GitHub integration OAuth flow. `projectId` rides along in `state`. */
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }
  if (!githubOAuthConfigured()) {
    return NextResponse.json(
      {
        error:
          "GitHub OAuth is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.",
      },
      { status: 501 }
    );
  }
  return NextResponse.redirect(githubAuthorizeUrl(projectId));
}
