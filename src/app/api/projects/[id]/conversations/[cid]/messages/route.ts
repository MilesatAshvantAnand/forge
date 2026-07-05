import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, asc, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { retrieveChunks } from "@/lib/rag/retriever";
import { classifyQuery, shouldSearchWeb } from "@/lib/rag/query-router";
import { searchWeb } from "@/lib/knowledge/exa";
import { streamChat, hasLlmConfigured, type LlmMessage } from "@/lib/llm/provider";
import { buildSystemPrompt, buildContextMessage } from "@/lib/llm/system-prompt";
import { listResources } from "@/lib/resources/ingest";
import type { ChatCitation, ProjectMetadata } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; cid: string }> }
) {
  const { id, cid } = await params;
  const rows = db
    .select()
    .from(schema.chatMessages)
    .where(
      and(
        eq(schema.chatMessages.projectId, id),
        eq(schema.chatMessages.conversationId, cid)
      )
    )
    .orderBy(asc(schema.chatMessages.createdAt))
    .all();

  return NextResponse.json({
    messages: rows.map((r) => ({
      id: r.id,
      role: r.role,
      content: r.content,
      citations: r.citations ? JSON.parse(r.citations) : [],
      createdAt: r.createdAt,
    })),
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; cid: string }> }
) {
  const { id, cid } = await params;
  const { message } = (await req.json()) as { message: string };

  if (!message?.trim()) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }
  if (!hasLlmConfigured()) {
    return NextResponse.json(
      { error: "No LLM configured. Set DASHSCOPE_API_KEY in .env.local" },
      { status: 503 }
    );
  }

  const project = db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.id, id))
    .get();
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const conversation = db
    .select()
    .from(schema.conversations)
    .where(eq(schema.conversations.id, cid))
    .get();
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const metadata: ProjectMetadata | null = project.metadata
    ? JSON.parse(project.metadata)
    : null;

  // First user message becomes the conversation title
  const isFirstMessage =
    db
      .select({ id: schema.chatMessages.id })
      .from(schema.chatMessages)
      .where(eq(schema.chatMessages.conversationId, cid))
      .all().length === 0;

  db.insert(schema.chatMessages)
    .values({
      id: randomUUID(),
      projectId: id,
      conversationId: cid,
      role: "user",
      content: message,
      createdAt: Date.now(),
    })
    .run();

  db.update(schema.conversations)
    .set({
      updatedAt: Date.now(),
      ...(isFirstMessage
        ? { title: message.slice(0, 60) + (message.length > 60 ? "…" : "") }
        : {}),
    })
    .where(eq(schema.conversations.id, cid))
    .run();

  const intent = classifyQuery(message);
  const resourceList = listResources(id);

  const [chunks, webSources] = await Promise.all([
    retrieveChunks(id, message, 8),
    shouldSearchWeb(intent) && metadata
      ? searchWeb(message, metadata.libraries)
      : Promise.resolve([]),
  ]);

  const citations: ChatCitation[] = [
    ...chunks.slice(0, 6).map((c) => ({
      file: c.filePath,
      startLine: c.startLine,
      endLine: c.endLine,
      source: "project" as const,
    })),
    ...webSources.map((w) => ({
      file: w.title,
      source: "web" as const,
      url: w.url,
      title: w.title,
    })),
  ];

  // Conversation history (this conversation only, last 10 turns)
  const history = db
    .select()
    .from(schema.chatMessages)
    .where(eq(schema.chatMessages.conversationId, cid))
    .orderBy(asc(schema.chatMessages.createdAt))
    .all()
    .slice(-11, -1);

  const messages: LlmMessage[] = [
    {
      role: "system",
      content: buildSystemPrompt(project.name, project.summary, metadata, resourceList),
    },
    ...history.map((h) => ({
      role: h.role as "user" | "assistant",
      content: h.content,
    })),
    {
      role: "user",
      content: `${buildContextMessage(chunks, webSources, intent)}\n\n## Question\n${message}`,
    },
  ];

  const encoder = new TextEncoder();
  let fullResponse = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "citations", citations })}\n\n`
          )
        );
        for await (const token of streamChat(messages)) {
          fullResponse += token;
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "token", token })}\n\n`)
          );
        }
        db.insert(schema.chatMessages)
          .values({
            id: randomUUID(),
            projectId: id,
            conversationId: cid,
            role: "assistant",
            content: fullResponse,
            citations: JSON.stringify(citations),
            createdAt: Date.now(),
          })
          .run();
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Chat failed";
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "error", error: msg })}\n\n`)
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
