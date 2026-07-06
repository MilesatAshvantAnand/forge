import { NextRequest, NextResponse } from "next/server";
import {
  exchangeOnshapeCode,
  saveOnshapeIntegration,
} from "@/lib/integrations/onshape";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const projectId = req.nextUrl.searchParams.get("state");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (!code || !projectId) {
    return NextResponse.redirect(`${appUrl}/projects?onshape=error`);
  }

  try {
    const tokens = await exchangeOnshapeCode(code);
    await saveOnshapeIntegration(projectId, tokens);
    return NextResponse.redirect(
      `${appUrl}/projects/${projectId}?onshape=connected`
    );
  } catch (err) {
    console.error("Onshape OAuth callback failed:", err);
    return NextResponse.redirect(
      `${appUrl}/projects/${projectId}?onshape=error`
    );
  }
}
