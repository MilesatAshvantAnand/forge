import { NextRequest, NextResponse } from "next/server";
import {
  exchangeGitHubCode,
  saveGitHubIntegration,
} from "@/lib/integrations/github";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const projectId = req.nextUrl.searchParams.get("state");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (!code || !projectId) {
    return NextResponse.redirect(`${appUrl}/projects?github=error`);
  }

  try {
    const token = await exchangeGitHubCode(code);
    await saveGitHubIntegration(projectId, token);
    return NextResponse.redirect(
      `${appUrl}/projects/${projectId}?github=connected`
    );
  } catch (err) {
    console.error("GitHub OAuth callback failed:", err);
    return NextResponse.redirect(
      `${appUrl}/projects/${projectId}?github=error`
    );
  }
}
