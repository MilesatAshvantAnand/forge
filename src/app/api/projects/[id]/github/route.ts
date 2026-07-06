import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { and, eq } from "drizzle-orm";
import {
  commitFileToGitHub,
  getGitHubConnection,
  getGitHubToken,
  githubOAuthConfigured,
} from "@/lib/integrations/github";
import type { ProjectMetadata } from "@/lib/types";
import { requireProjectAccess, UnauthorizedError, ForbiddenError } from "@/lib/auth/dal";

export const dynamic = "force-dynamic";

async function getProjectRepo(projectId: string): Promise<{
  repo: string | null;
  ref: string;
}> {
  const project = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.id, projectId))
    .get();
  const meta: ProjectMetadata | null = project?.metadata
    ? JSON.parse(project.metadata)
    : null;
  return {
    repo: meta?.githubRepo ?? null,
    ref: meta?.githubRef ?? "main",
  };
}

/** Connection + repo status for the GitHub panel in the UI. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const [connection, { repo, ref }] = await Promise.all([
    getGitHubConnection(id),
    getProjectRepo(id),
  ]);

  return NextResponse.json({
    oauthConfigured: githubOAuthConfigured(),
    connected: connection.connected,
    login: connection.login,
    // Server-wide token lets commits work even without per-project OAuth
    fallbackToken: Boolean(process.env.GITHUB_TOKEN),
    repo,
    ref,
  });
}

/** Commit a file (its current saved content in Forge) back to the repo. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Guard: must be at least a "member" to commit code back to GitHub
  try {
    await requireProjectAccess(id, "member");
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

  const path = typeof body?.path === "string" ? body.path : null;
  const message =
    typeof body?.message === "string" && body.message.trim()
      ? body.message.trim()
      : null;

  if (!path) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  const { repo, ref } = await getProjectRepo(id);
  if (!repo) {
    return NextResponse.json(
      { error: "This project is not linked to a GitHub repository" },
      { status: 400 }
    );
  }

  const token = await getGitHubToken(id);
  if (!token) {
    return NextResponse.json(
      {
        error:
          "No GitHub credentials. Connect GitHub for this project or set GITHUB_TOKEN.",
      },
      { status: 401 }
    );
  }

  const file = await db
    .select()
    .from(schema.files)
    .where(and(eq(schema.files.projectId, id), eq(schema.files.path, path)))
    .get();

  if (!file || file.content === null) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  try {
    const result = await commitFileToGitHub(
      token,
      repo,
      ref,
      path,
      file.content,
      message ?? `Update ${path} via Forge`
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("GitHub commit failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "GitHub commit failed" },
      { status: 502 }
    );
  }
}
