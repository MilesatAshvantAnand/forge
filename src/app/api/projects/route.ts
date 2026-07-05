import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = db
    .select({
      id: schema.projects.id,
      name: schema.projects.name,
      status: schema.projects.status,
      metadata: schema.projects.metadata,
      createdAt: schema.projects.createdAt,
    })
    .from(schema.projects)
    .orderBy(desc(schema.projects.createdAt))
    .limit(12)
    .all();

  const projects = rows.map((r) => {
    const meta = r.metadata ? JSON.parse(r.metadata) : null;
    return {
      id: r.id,
      name: r.name,
      status: r.status,
      createdAt: r.createdAt,
      totalFiles: meta?.totalFiles ?? 0,
      libraries: meta?.libraries?.map((l: { name: string }) => l.name) ?? [],
    };
  });

  return NextResponse.json({ projects });
}
