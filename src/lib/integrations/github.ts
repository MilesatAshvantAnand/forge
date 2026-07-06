import { db, schema } from "@/lib/db";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "crypto";

/**
 * GitHub OAuth + commit-back support.
 *
 * Setup: create an OAuth app at https://github.com/settings/developers with
 * callback `{APP_URL}/api/integrations/github/callback`, then set:
 *   GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
 * and NEXT_PUBLIC_APP_URL. A server-wide GITHUB_TOKEN still works as a
 * fallback for import + commit when no per-project OAuth connection exists.
 */

const API_BASE = "https://api.github.com";

export function githubOAuthConfigured(): boolean {
  return Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
}

export function githubRedirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/integrations/github/callback`;
}

export function githubAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID!,
    redirect_uri: githubRedirectUri(),
    scope: "repo",
    state,
  });
  return `https://github.com/login/oauth/authorize?${params}`;
}

export async function exchangeGitHubCode(code: string): Promise<string> {
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID!,
      client_secret: process.env.GITHUB_CLIENT_SECRET!,
      code,
      redirect_uri: githubRedirectUri(),
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`GitHub token exchange failed: ${JSON.stringify(data)}`);
  }
  return data.access_token as string;
}

export async function saveGitHubIntegration(projectId: string, accessToken: string) {
  const now = Date.now();

  // Record who connected, for display in the UI
  let login: string | null = null;
  try {
    const user = await githubGet<{ login: string }>(accessToken, "/user");
    login = user.login;
  } catch {
    /* non-fatal */
  }

  const existing = await db
    .select()
    .from(schema.integrations)
    .where(
      and(
        eq(schema.integrations.projectId, projectId),
        eq(schema.integrations.provider, "github")
      )
    )
    .get();

  const values = {
    accessToken,
    metadata: login ? JSON.stringify({ login }) : null,
    updatedAt: now,
  };

  if (existing) {
    await db
      .update(schema.integrations)
      .set(values)
      .where(eq(schema.integrations.id, existing.id))
      .run();
  } else {
    await db
      .insert(schema.integrations)
      .values({
        id: randomUUID(),
        projectId,
        provider: "github",
        ...values,
        createdAt: now,
      })
      .run();
  }
}

/** Per-project OAuth token, falling back to the server-wide GITHUB_TOKEN. */
export async function getGitHubToken(projectId: string): Promise<string | null> {
  const row = await db
    .select()
    .from(schema.integrations)
    .where(
      and(
        eq(schema.integrations.projectId, projectId),
        eq(schema.integrations.provider, "github")
      )
    )
    .get();
  return row?.accessToken ?? process.env.GITHUB_TOKEN ?? null;
}

export async function getGitHubConnection(projectId: string): Promise<{
  connected: boolean;
  login: string | null;
}> {
  const row = await db
    .select()
    .from(schema.integrations)
    .where(
      and(
        eq(schema.integrations.projectId, projectId),
        eq(schema.integrations.provider, "github")
      )
    )
    .get();
  if (!row?.accessToken) return { connected: false, login: null };
  const meta = row.metadata ? (JSON.parse(row.metadata) as { login?: string }) : {};
  return { connected: true, login: meta.login ?? null };
}

async function githubGet<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "forge-app",
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub API ${path} failed (${res.status})`);
  }
  return res.json();
}

export interface CommitResult {
  commitSha: string;
  htmlUrl: string;
}

/**
 * Commit a single file to the repo via the Contents API.
 * Creates the file if it doesn't exist; updates it (using its current SHA)
 * if it does.
 */
export async function commitFileToGitHub(
  token: string,
  repo: string,
  ref: string,
  filePath: string,
  content: string,
  message: string
): Promise<CommitResult> {
  // Fetch the existing file SHA (required by the Contents API for updates)
  let sha: string | null = null;
  const getRes = await fetch(
    `${API_BASE}/repos/${repo}/contents/${encodeURIComponent(filePath).replace(/%2F/g, "/")}?ref=${encodeURIComponent(ref)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "forge-app",
      },
    }
  );
  if (getRes.ok) {
    const existing = await getRes.json();
    sha = existing.sha ?? null;
  } else if (getRes.status !== 404) {
    throw new Error(`GitHub contents lookup failed (${getRes.status})`);
  }

  const putRes = await fetch(
    `${API_BASE}/repos/${repo}/contents/${encodeURIComponent(filePath).replace(/%2F/g, "/")}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "forge-app",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        content: Buffer.from(content, "utf-8").toString("base64"),
        branch: ref,
        ...(sha ? { sha } : {}),
      }),
    }
  );

  const data = await putRes.json();
  if (!putRes.ok) {
    throw new Error(
      `GitHub commit failed (${putRes.status}): ${data.message ?? "unknown error"}`
    );
  }
  return {
    commitSha: data.commit?.sha ?? "",
    htmlUrl: data.commit?.html_url ?? "",
  };
}
