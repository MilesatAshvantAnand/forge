import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { desc, eq } from "drizzle-orm";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rows = db
    .select()
    .from(schema.conversations)
    .where(eq(schema.conversations.projectId, id))
    .orderBy(desc(schema.conversations.updatedAt))
    .all();

  return NextResponse.json({ conversations: rows });
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const now = Date.now();
  const conversation = {
    id: randomUUID(),
    projectId: id,
    title: "New conversation",
    createdAt: now,
    updatedAt: now,
  };
  db.insert(schema.conversations).values(conversation).run();
  return NextResponse.json({ conversation });
}
