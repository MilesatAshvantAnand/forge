import { NextRequest, NextResponse } from "next/server";
import {
  requireProjectAccess,
  UnauthorizedError,
  ForbiddenError,
} from "@/lib/auth/dal";
import { ensureDemoSeeded } from "@/lib/demo/seed";
import { getBotProfile, runGateway } from "@/lib/gateway";

export const dynamic = "force-dynamic";

/**
 * Bot Gateway check: POST { code, filePath? } → { report }.
 *
 * Read-only analysis (no mutation), so viewer access suffices — this keeps
 * the gateway working in the public demo project.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await requireProjectAccess(id, "viewer");
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    throw err;
  }

  const body = await req.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code : null;
  if (code === null) {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }
  if (code.length > 500_000) {
    return NextResponse.json({ error: "code too large" }, { status: 400 });
  }

  await ensureDemoSeeded(id);
  const profile = await getBotProfile(id);
  if (!profile) {
    // No profile — nothing to validate against. The client treats this as
    // "gateway not configured" and applies without a chip.
    return NextResponse.json({ report: null, hasProfile: false });
  }

  const report = runGateway(code, profile);
  return NextResponse.json({
    report,
    hasProfile: true,
    filePath: typeof body?.filePath === "string" ? body.filePath : null,
  });
}
