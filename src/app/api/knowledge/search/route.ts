import { NextRequest, NextResponse } from "next/server";
import { searchWeb, searchVexParts } from "@/lib/knowledge/exa";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const query = typeof body?.query === "string" ? body.query.trim() : "";
  const type = body?.type === "vex-parts" ? "vex-parts" : "general";

  if (!query) {
    return NextResponse.json({ error: "query required" }, { status: 400 });
  }

  if (type === "vex-parts") {
    const results = await searchVexParts(query);
    return NextResponse.json({ results, source: "exa" });
  }

  const results = await searchWeb(query, []);
  return NextResponse.json({ results, source: "exa" });
}
