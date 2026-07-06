import { NextRequest, NextResponse } from "next/server";
import {
  requireProjectAccess,
  UnauthorizedError,
  ForbiddenError,
} from "@/lib/auth/dal";
import { ensureDemoSeeded } from "@/lib/demo/seed";
import {
  getBotProfile,
  upsertBotProfile,
  PROS_KERNELS,
  VEXOS_VERSIONS,
  type BotComponent,
} from "@/lib/gateway";

export const dynamic = "force-dynamic";

function errorResponse(err: unknown): NextResponse | null {
  if (err instanceof UnauthorizedError) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
  if (err instanceof ForbiddenError) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
  return null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let readOnly = false;
  try {
    const grant = await requireProjectAccess(id, "viewer");
    readOnly = grant.isDemoGrant || grant.role === "viewer";
  } catch (err) {
    const res = errorResponse(err);
    if (res) return res;
    throw err;
  }

  await ensureDemoSeeded(id);
  const profile = await getBotProfile(id);

  return NextResponse.json({
    profile,
    readOnly,
    // Registry data so the UI dropdowns stay in sync with the rubric engine
    registry: {
      kernels: PROS_KERNELS,
      vexos: VEXOS_VERSIONS,
    },
  });
}

const VALID_SMART_PORT = (p: unknown) =>
  typeof p === "number" && Number.isInteger(p) && p >= 1 && p <= 21;
const VALID_ADI_PORT = (p: unknown) =>
  typeof p === "string" && /^[A-H]$/.test(p.trim().toUpperCase());

function sanitizeComponents(input: unknown): BotComponent[] | null {
  if (!Array.isArray(input)) return null;
  const out: BotComponent[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (typeof raw !== "object" || raw === null) return null;
    const c = raw as Record<string, unknown>;
    const portOk = VALID_SMART_PORT(c.port) || VALID_ADI_PORT(c.port);
    if (!portOk || typeof c.type !== "string" || !c.type.trim()) return null;
    const port = typeof c.port === "string" ? c.port.trim().toUpperCase() : (c.port as number);
    const key = String(port);
    if (seen.has(key)) return null; // duplicate port assignment
    seen.add(key);
    out.push({
      port,
      type: c.type.trim(),
      label: typeof c.label === "string" ? c.label.trim().slice(0, 80) : "",
      ...(typeof c.reversed === "boolean" ? { reversed: c.reversed } : {}),
      ...(typeof c.gearset === "string" && c.gearset.trim()
        ? { gearset: c.gearset.trim() }
        : {}),
    });
  }
  return out;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Editing the robot's identity requires member access; the demo project is
  // read-only and is rejected here (its grant is viewer-only).
  try {
    await requireProjectAccess(id, "member");
  } catch (err) {
    const res = errorResponse(err);
    if (res) return res;
    throw err;
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const components =
    body.components !== undefined ? sanitizeComponents(body.components) : undefined;
  if (body.components !== undefined && components === null) {
    return NextResponse.json(
      {
        error:
          "Invalid components: each entry needs a unique port (1–21 or A–H) and a type.",
      },
      { status: 400 }
    );
  }

  const profile = await upsertBotProfile(id, {
    name: typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 80) : undefined,
    firmwareVersion:
      typeof body.firmwareVersion === "string" || body.firmwareVersion === null
        ? body.firmwareVersion
        : undefined,
    prosKernelVersion:
      typeof body.prosKernelVersion === "string" || body.prosKernelVersion === null
        ? body.prosKernelVersion
        : undefined,
    brainType: typeof body.brainType === "string" ? body.brainType : undefined,
    components: components ?? undefined,
  });

  return NextResponse.json({ profile });
}
