import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { randomUUID } from "crypto";
import { runIndexingPipeline } from "@/lib/indexer/pipeline";
import { getSession } from "@/lib/auth/dal";
import { getDefaultTeamId } from "@/lib/auth/team";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_ZIP_BYTES = 50 * 1024 * 1024;

/** Accepts "owner/repo", full github.com URLs, or URLs with /tree/<branch>. */
function parseRepoInput(input: string): { repo: string; ref: string | null } | null {
  const trimmed = input.trim();

  const urlMatch = trimmed.match(
    /github\.com\/([\w.-]+\/[\w.-]+?)(?:\.git)?(?:\/tree\/([^/\s]+))?(?:[/?#]|$)/
  );
  if (urlMatch) {
    return { repo: urlMatch[1], ref: urlMatch[2] ?? null };
  }

  if (/^[\w.-]+\/[\w.-]+$/.test(trimmed)) {
    return { repo: trimmed, ref: null };
  }
  return null;
}

/**
 * Import a GitHub repository as a new Forge project. Works unauthenticated
 * for public repos via the zipball API; set GITHUB_TOKEN for private repos
 * and higher rate limits.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const input = typeof body?.repo === "string" ? body.repo : "";

  const parsed = parseRepoInput(input);
  if (!parsed) {
    return NextResponse.json(
      { error: "Enter a GitHub repository as owner/repo or a github.com URL" },
      { status: 400 }
    );
  }

  const ref =
    typeof body?.ref === "string" && body.ref.trim()
      ? body.ref.trim()
      : parsed.ref;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "forge-app",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  // The zipball endpoint redirects to codeload; fetch follows automatically.
  const zipUrl = `https://api.github.com/repos/${parsed.repo}/zipball${ref ? `/${ref}` : ""}`;
  const res = await fetch(zipUrl, { headers, redirect: "follow" });

  if (res.status === 404) {
    return NextResponse.json(
      {
        error:
          "Repository not found. For private repos, set GITHUB_TOKEN on the server.",
      },
      { status: 404 }
    );
  }
  if (!res.ok) {
    return NextResponse.json(
      { error: `GitHub download failed (${res.status})` },
      { status: 502 }
    );
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > MAX_ZIP_BYTES) {
    return NextResponse.json(
      { error: "Repository too large (max 50 MB zipped)" },
      { status: 400 }
    );
  }

  const projectId = randomUUID();
  const projectName = parsed.repo.split("/")[1];
  const now = Date.now();

  // Attribute to the calling user's team if authenticated
  const session = await getSession();
  const teamId = session ? await getDefaultTeamId(session.user.id) : null;
  const createdByUserId = session?.user.id ?? null;

  await db
    .insert(schema.projects)
    .values({
      id: projectId,
      name: projectName,
      source: "github",
      status: "indexing",
      indexProgress: JSON.stringify({
        stage: "download",
        progress: 2,
        message: `Downloaded ${parsed.repo} from GitHub`,
      }),
      createdAt: now,
      updatedAt: now,
      teamId,
      createdByUserId,
    })
    .run();

  // Fire-and-forget: client polls /status for progress
  runIndexingPipeline(projectId, projectName, buffer, {
    githubRepo: parsed.repo,
    githubRef: ref ?? "main",
  });

  return NextResponse.json({ projectId, repo: parsed.repo });
}
