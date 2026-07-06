import { db, schema } from "@/lib/db";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "crypto";

/**
 * Onshape OAuth 2.0 + REST API client.
 *
 * Setup: create an OAuth app at https://dev-portal.onshape.com/oauthApps with
 * redirect URI `{APP_URL}/api/integrations/onshape/callback`, then set:
 *   ONSHAPE_CLIENT_ID, ONSHAPE_CLIENT_SECRET
 * and NEXT_PUBLIC_APP_URL (used to build the redirect URI).
 */

const OAUTH_BASE = "https://oauth.onshape.com";
const API_BASE = "https://cad.onshape.com/api/v6";

export function onshapeConfigured(): boolean {
  return Boolean(process.env.ONSHAPE_CLIENT_ID && process.env.ONSHAPE_CLIENT_SECRET);
}

export function onshapeRedirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/integrations/onshape/callback`;
}

export function onshapeAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.ONSHAPE_CLIENT_ID!,
    redirect_uri: onshapeRedirectUri(),
    state,
  });
  return `${OAUTH_BASE}/oauth/authorize?${params}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

async function requestToken(body: URLSearchParams): Promise<TokenResponse> {
  const res = await fetch(`${OAUTH_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Onshape token request failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

export async function exchangeOnshapeCode(code: string): Promise<TokenResponse> {
  return requestToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: process.env.ONSHAPE_CLIENT_ID!,
      client_secret: process.env.ONSHAPE_CLIENT_SECRET!,
      redirect_uri: onshapeRedirectUri(),
    })
  );
}

export async function saveOnshapeIntegration(
  projectId: string,
  tokens: TokenResponse
) {
  const now = Date.now();
  const existing = await db
    .select()
    .from(schema.integrations)
    .where(
      and(
        eq(schema.integrations.projectId, projectId),
        eq(schema.integrations.provider, "onshape")
      )
    )
    .get();

  const values = {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: now + tokens.expires_in * 1000,
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
        provider: "onshape",
        ...values,
        createdAt: now,
      })
      .run();
  }
}

/** Get a valid access token for the project, refreshing if expired. */
export async function getOnshapeToken(projectId: string): Promise<string | null> {
  const row = await db
    .select()
    .from(schema.integrations)
    .where(
      and(
        eq(schema.integrations.projectId, projectId),
        eq(schema.integrations.provider, "onshape")
      )
    )
    .get();
  if (!row?.accessToken) return null;

  // Refresh 60s before expiry
  if (row.expiresAt && row.expiresAt - 60_000 > Date.now()) {
    return row.accessToken;
  }
  if (!row.refreshToken) return row.accessToken;

  try {
    const tokens = await requestToken(
      new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: row.refreshToken,
        client_id: process.env.ONSHAPE_CLIENT_ID!,
        client_secret: process.env.ONSHAPE_CLIENT_SECRET!,
      })
    );
    await saveOnshapeIntegration(projectId, tokens);
    return tokens.access_token;
  } catch (err) {
    console.error("Onshape token refresh failed:", err);
    return null;
  }
}

async function onshapeGet<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json;charset=UTF-8; qs=0.09",
    },
  });
  if (!res.ok) {
    throw new Error(`Onshape API ${path} failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

export interface OnshapeDocumentSummary {
  id: string;
  name: string;
  href: string;
  defaultWorkspaceId: string | null;
  modifiedAt: string | null;
  thumbnailHref: string | null;
}

/** List documents the connected account can access (most recently modified first). */
export async function listOnshapeDocuments(
  token: string
): Promise<OnshapeDocumentSummary[]> {
  const data = await onshapeGet<{
    items: {
      id: string;
      name: string;
      href: string;
      modifiedAt?: string;
      defaultWorkspace?: { id: string };
      thumbnail?: { href?: string };
    }[];
  }>(token, "/documents?sortColumn=modifiedAt&sortOrder=desc&limit=20");

  return (data.items ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    href: `https://cad.onshape.com/documents/${d.id}`,
    defaultWorkspaceId: d.defaultWorkspace?.id ?? null,
    modifiedAt: d.modifiedAt ?? null,
    thumbnailHref: d.thumbnail?.href ?? null,
  }));
}

export interface OnshapeElementInfo {
  id: string;
  name: string;
  type: string;
}

export interface OnshapeDocumentMetadata {
  documentId: string;
  workspaceId: string;
  name: string;
  url: string;
  elements: OnshapeElementInfo[];
  assemblies: string[];
  partStudios: string[];
  fetchedAt: number;
}

/** Fetch the element list (part studios, assemblies) for a document. */
export async function fetchOnshapeDocumentMetadata(
  token: string,
  documentId: string,
  workspaceId?: string | null
): Promise<OnshapeDocumentMetadata> {
  let wid = workspaceId ?? null;
  const doc = await onshapeGet<{
    name: string;
    defaultWorkspace?: { id: string };
  }>(token, `/documents/${documentId}`);
  if (!wid) wid = doc.defaultWorkspace?.id ?? null;
  if (!wid) throw new Error("Could not resolve Onshape workspace");

  const elements = await onshapeGet<
    { id: string; name: string; elementType: string }[]
  >(token, `/documents/d/${documentId}/w/${wid}/elements`);

  const infos: OnshapeElementInfo[] = elements.map((e) => ({
    id: e.id,
    name: e.name,
    type: e.elementType,
  }));

  return {
    documentId,
    workspaceId: wid,
    name: doc.name,
    url: `https://cad.onshape.com/documents/${documentId}/w/${wid}`,
    elements: infos,
    assemblies: infos.filter((e) => e.type === "ASSEMBLY").map((e) => e.name),
    partStudios: infos.filter((e) => e.type === "PARTSTUDIO").map((e) => e.name),
    fetchedAt: Date.now(),
  };
}
