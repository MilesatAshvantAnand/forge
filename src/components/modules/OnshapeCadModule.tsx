"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Box,
  FileCode,
  BookOpen,
  Cog,
  Link2,
  Upload,
  Loader2,
  ExternalLink,
  Check,
  Plug,
  Layers,
  RefreshCw,
  Boxes,
  Sparkles,
} from "lucide-react";
import type { ProjectMetadata } from "@/lib/types";
import { formatBytes } from "@/lib/utils";
import { ModulePanelShell } from "./ModulePanelShell";

const DEMO_CHAIN = [
  { icon: Box, label: "Roller Assembly", sub: "Onshape CAD", color: "var(--blue)" },
  { icon: Cog, label: "Intake Motor", sub: "Port 7 · 200 RPM", color: "var(--accent)" },
  { icon: FileCode, label: "intake.cpp", sub: "Anti-jam logic", color: "var(--green)" },
  {
    icon: BookOpen,
    label: "Engineering Notebook",
    sub: "Compression notes",
    color: "var(--muted)",
  },
];

interface CadResource {
  id: string;
  type: string;
  name: string;
  size: number;
  summary?: string | null;
  externalUrl?: string | null;
  externalProvider?: string | null;
}

interface OnshapeDocument {
  id: string;
  name: string;
  href: string;
  modifiedAt: string | null;
}

interface OnshapeAccountState {
  configured: boolean;
  connected: boolean;
  documents: OnshapeDocument[];
}

/** Shape of the metadata JSON stored at link time (OnshapeDocumentMetadata). */
interface OnshapeLinkMetadata {
  documentId: string;
  workspaceId: string;
  name: string;
  url: string;
  elements: { id: string; name: string; type: string }[];
  assemblies: string[];
  partStudios: string[];
  fetchedAt: number;
}

interface OnshapeLink {
  id: string;
  name: string;
  url: string | null;
  metadata: OnshapeLinkMetadata | null;
}

interface OnshapeCadModuleProps {
  projectId: string;
  metadata: ProjectMetadata | null;
  resources: CadResource[];
  isDemoProject: boolean;
  onClose: () => void;
  onSelectFile?: (path: string) => void;
  onResourceUploaded?: () => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

export function OnshapeCadModule({
  projectId,
  metadata,
  resources,
  isDemoProject,
  onClose,
  onSelectFile,
  onResourceUploaded,
  expanded,
  onToggleExpand,
}: OnshapeCadModuleProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [onshapeUrl, setOnshapeUrl] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connectSuccess, setConnectSuccess] = useState(false);
  const [account, setAccount] = useState<OnshapeAccountState | null>(null);
  const [linkingDocId, setLinkingDocId] = useState<string | null>(null);

  // Structural inventory: linked-resource metadata keyed by resource id
  const [links, setLinks] = useState<Record<string, OnshapeLink>>({});
  const [selectedCadId, setSelectedCadId] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const loadLinks = () => {
    fetch(`/api/projects/${projectId}/onshape`)
      .then((r) => r.json())
      .then((d) => {
        const byId: Record<string, OnshapeLink> = {};
        for (const link of d.links ?? []) byId[link.id] = link;
        setLinks(byId);
      })
      .catch(() => {
        /* inventory is progressive enhancement — ignore load failures */
      });
  };

  useEffect(() => {
    fetch(`/api/projects/${projectId}/onshape/documents`)
      .then((r) => r.json())
      .then((d) =>
        setAccount({
          configured: d.configured ?? false,
          connected: d.connected ?? false,
          documents: d.documents ?? [],
        })
      )
      .catch(() => setAccount(null));
    loadLinks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const cadResources = resources.filter((r) => r.type === "cad");
  const onshapeCadResources = cadResources.filter(
    (r) => r.externalProvider === "onshape" || links[r.id]?.metadata
  );

  // Keep the selected document valid; default to the first Onshape link
  useEffect(() => {
    if (selectedCadId && cadResources.some((r) => r.id === selectedCadId)) return;
    setSelectedCadId(onshapeCadResources[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resources, links]);

  const linkDocument = async (doc: OnshapeDocument) => {
    setLinkingDocId(doc.id);
    try {
      const res = await fetch(`/api/projects/${projectId}/onshape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: doc.id, url: doc.href, name: doc.name }),
      });
      if (res.ok) {
        onResourceUploaded?.();
        loadLinks();
      }
    } finally {
      setLinkingDocId(null);
    }
  };

  const refreshMetadata = async (resourceId: string) => {
    setRefreshingId(resourceId);
    setRefreshError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/onshape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRefreshError(
          data.error === "onshape-not-connected"
            ? "Connect the project's Onshape account to refresh metadata."
            : (data.message ?? data.error ?? "Metadata refresh failed")
        );
        return;
      }
      setLinks((prev) => ({
        ...prev,
        [resourceId]: {
          id: resourceId,
          name: data.name,
          url: data.url,
          metadata: data.metadata,
        },
      }));
      onResourceUploaded?.();
    } catch {
      setRefreshError("Metadata refresh failed");
    } finally {
      setRefreshingId(null);
    }
  };

  const subsystems = metadata?.subsystems ?? [];
  const showDemoChain =
    isDemoProject || subsystems.some((s) => s.name.includes("intake"));

  const handleConnect = async () => {
    setConnecting(true);
    setConnectError(null);
    setConnectSuccess(false);
    try {
      const res = await fetch(`/api/projects/${projectId}/onshape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: onshapeUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to connect");
      setOnshapeUrl("");
      setConnectSuccess(true);
      onResourceUploaded?.();
      loadLinks();
      setTimeout(() => setConnectSuccess(false), 2500);
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : "Failed to connect");
    } finally {
      setConnecting(false);
    }
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/projects/${projectId}/resources`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Upload failed");
      }
      onResourceUploaded?.();
    } finally {
      setUploading(false);
    }
  };

  const selectedResource =
    cadResources.find((r) => r.id === selectedCadId) ?? null;
  const selectedLink = selectedResource ? (links[selectedResource.id] ?? null) : null;

  return (
    <ModulePanelShell
      eyebrow="Onshape CAD"
      title="Mechanical ↔ Code"
      onClose={onClose}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
    >
      <div className="mx-auto flex max-w-3xl flex-col px-8 py-8">
        {account?.configured && !account.connected && (
          <a
            href={`/api/integrations/onshape?projectId=${projectId}`}
            className="mb-5 flex items-center justify-center gap-2 rounded-xl bg-[var(--blue)] py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90"
          >
            <Plug className="h-4 w-4" />
            Connect Onshape account
          </a>
        )}

        {account?.connected && account.documents.length > 0 && (
          <div className="mb-5 rounded-xl border border-[var(--border)] bg-[var(--inset)] p-5">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
              <Check className="h-3.5 w-3.5 text-[var(--green)]" />
              Onshape connected · Your documents
            </p>
            <div className="mt-3 flex flex-col gap-1.5">
              {account.documents.slice(0, 6).map((doc) => (
                <div
                  key={doc.id}
                  className="glass flex items-center gap-2 rounded-lg px-3 py-2.5"
                >
                  <Box className="h-4 w-4 shrink-0 text-[var(--blue)]" />
                  <span className="min-w-0 flex-1 truncate text-sm">{doc.name}</span>
                  <button
                    type="button"
                    onClick={() => linkDocument(doc)}
                    disabled={linkingDocId === doc.id}
                    className="flex shrink-0 items-center gap-1 rounded-lg bg-[var(--blue-dim)] px-2.5 py-1 text-xs font-semibold text-[var(--blue)] ring-1 ring-[var(--blue)]/25 disabled:opacity-50"
                  >
                    {linkingDocId === doc.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Link2 className="h-3 w-3" />
                    )}
                    Link
                  </button>
                  <a
                    href={doc.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 rounded p-1 text-[var(--muted)] hover:text-[var(--blue)]"
                    title="Open in Onshape"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-xl border border-[var(--border)] bg-[var(--inset)] p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
            Connect Onshape
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
            Paste your Onshape document URL or upload an exported assembly (.STEP, .STL).
          </p>

          <div className="mt-4 flex gap-2">
            <input
              type="url"
              value={onshapeUrl}
              onChange={(e) => {
                setOnshapeUrl(e.target.value);
                setConnectError(null);
              }}
              placeholder="https://cad.onshape.com/documents/…"
              className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-[var(--muted)]/60 focus:border-[var(--blue)]"
            />
            <button
              type="button"
              onClick={handleConnect}
              disabled={connecting || !onshapeUrl.trim()}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--blue)] px-4 py-2.5 text-sm font-semibold text-black transition-opacity disabled:opacity-40"
            >
              {connecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : connectSuccess ? (
                <Check className="h-4 w-4" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              Link
            </button>
          </div>
          {connectError && (
            <p className="mt-2 text-xs text-red-400">{connectError}</p>
          )}

          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".step,.stp,.stl,.iges,.igs,.obj,.3mf"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="mt-4 flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border-strong)] py-7 transition-colors hover:border-[var(--blue)] hover:bg-[var(--inset)] disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 className="h-7 w-7 animate-spin text-[var(--blue)]" />
            ) : (
              <Upload className="h-7 w-7 text-[var(--blue)] opacity-80" />
            )}
            <span className="text-sm font-semibold">
              {uploading ? "Uploading…" : "Upload CAD export"}
            </span>
            <span className="text-xs text-[var(--muted)]">STEP · STL · IGES · OBJ</span>
          </button>
        </div>

        {cadResources.length > 0 && (
          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
              Linked CAD
            </p>
            <div className="mt-2 flex flex-col gap-1.5">
              {cadResources.map((r) => {
                const openUrl =
                  links[r.id]?.url ??
                  r.externalUrl ??
                  (r.summary?.startsWith("http") ? r.summary : null);
                const hasScopeSummary = r.summary && !r.summary.startsWith("http");
                const isSelected = selectedCadId === r.id;
                return (
                  <div
                    key={r.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedCadId(r.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") setSelectedCadId(r.id);
                    }}
                    className={`glass flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 transition-transform duration-200 ease-out will-change-transform hover:scale-[1.02] hover:shadow-lg ${
                      isSelected ? "ring-1 ring-[var(--blue)]/50" : ""
                    }`}
                  >
                    <Box className="h-4 w-4 shrink-0 text-[var(--blue)]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{r.name}</p>
                      {hasScopeSummary ? (
                        <p className="flex items-center gap-1 truncate text-xs text-[var(--muted)]">
                          <Layers className="h-3 w-3 shrink-0" />
                          {r.summary}
                        </p>
                      ) : r.size > 0 ? (
                        <p className="text-xs text-[var(--muted)]">
                          {formatBytes(r.size)}
                        </p>
                      ) : null}
                    </div>
                    {openUrl && (
                      <a
                        href={openUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex shrink-0 items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-1 text-xs font-medium text-[var(--muted)] transition-colors hover:border-[var(--blue)] hover:text-[var(--blue)]"
                        title="Edit in Onshape (opens new tab)"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Edit in Onshape
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {selectedResource ? (
          <CadInventoryPanel
            resource={selectedResource}
            link={selectedLink}
            refreshing={refreshingId === selectedResource.id}
            refreshError={refreshError}
            onRefresh={() => refreshMetadata(selectedResource.id)}
          />
        ) : (
          <div className="mt-5 flex h-32 items-center justify-center rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--inset)]">
            <div className="text-center">
              <Box className="mx-auto h-9 w-9 text-[var(--blue)] opacity-70" />
              <p className="mt-2 text-xs text-[var(--muted)]">
                {cadResources.length > 0
                  ? "Select a linked document to see its structure"
                  : "Connect or upload to preview assembly"}
              </p>
            </div>
          </div>
        )}

        <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--inset)] px-4 py-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
            <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
            Phase 2 · coming soon
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-[var(--muted)]">
            Part-by-part understanding, VEX catalog matching, code cross-reference, and a
            System Map graph linking CAD ↔ motors ↔ code ↔ notebook.
          </p>
        </div>

        {showDemoChain ? (
          <div className="mt-7 flex flex-col items-center">
            <p className="mb-3 text-center text-sm text-[var(--muted)]">
              Forge links mechanical design to code and documentation
            </p>
            {DEMO_CHAIN.map((item, i) => (
              <div key={item.label} className="flex w-full flex-col items-center">
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.12 }}
                  whileHover={{ scale: 1.03, transition: { duration: 0.2, ease: "easeOut" } }}
                  className="glass w-full rounded-xl px-4 py-3.5 transition-shadow duration-200 ease-out will-change-transform hover:shadow-lg"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-lg"
                      style={{
                        background: `color-mix(in srgb, ${item.color} 15%, transparent)`,
                      }}
                    >
                      <item.icon className="h-5 w-5" style={{ color: item.color }} />
                    </div>
                    <div>
                      <p className="text-base font-semibold">{item.label}</p>
                      <p className="text-sm text-[var(--muted)]">{item.sub}</p>
                    </div>
                  </div>
                </motion.div>
                {i < DEMO_CHAIN.length - 1 && (
                  <div className="my-1 h-5 w-px bg-gradient-to-b from-[var(--accent)] to-transparent opacity-50" />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-7">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
              Detected subsystems
            </p>
            {subsystems.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--muted)]">
                Index your repository first — Forge will suggest CAD assembly mappings from
                subsystem names.
              </p>
            ) : (
              <div className="mt-3 flex flex-col gap-1.5">
                {subsystems.slice(0, 8).map((s) => (
                  <button
                    key={s.name}
                    type="button"
                    onClick={() => s.files[0] && onSelectFile?.(s.files[0])}
                    className="glass flex items-center justify-between rounded-lg px-3 py-2.5 text-left transition-all duration-200 ease-out will-change-transform hover:scale-[1.03] hover:border-[var(--border-strong)] hover:shadow-lg"
                  >
                    <span className="text-sm capitalize">{s.name}</span>
                    <span className="text-xs text-[var(--muted)]">
                      {s.files.length} files
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </ModulePanelShell>
  );
}

/**
 * Structural inventory for a linked Onshape document.
 *
 * Note on embedding: Onshape serves X-Frame-Options: SAMEORIGIN and a
 * frame-ancestors CSP limited to *.onshape.com, so documents cannot be
 * iframed by third-party apps. This preview card + "Open in Onshape" is
 * the supported path.
 */
function CadInventoryPanel({
  resource,
  link,
  refreshing,
  refreshError,
  onRefresh,
}: {
  resource: CadResource;
  link: OnshapeLink | null;
  refreshing: boolean;
  refreshError: string | null;
  onRefresh: () => void;
}) {
  const meta = link?.metadata ?? null;
  const openUrl =
    link?.url ??
    resource.externalUrl ??
    (resource.summary?.startsWith("http") ? resource.summary : null);
  const isOnshape = resource.externalProvider === "onshape" || Boolean(meta);

  if (!isOnshape) {
    return (
      <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--inset)] p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
          CAD export
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {resource.name}
          {resource.size > 0 ? ` · ${formatBytes(resource.size)}` : ""} — uploaded
          export. 3D preview for exported files arrives with the Phase 2 viewer.
        </p>
      </div>
    );
  }

  const assemblies = meta?.assemblies ?? [];
  const partStudios = meta?.partStudios ?? [];
  const otherElements = (meta?.elements ?? []).filter(
    (e) => e.type !== "ASSEMBLY" && e.type !== "PARTSTUDIO"
  );

  return (
    <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--inset)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
            Document structure
          </p>
          <p className="mt-1 truncate text-base font-semibold">{meta?.name ?? resource.name}</p>
          {meta && (
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              {assemblies.length} assembl{assemblies.length === 1 ? "y" : "ies"} ·{" "}
              {partStudios.length} part studio{partStudios.length === 1 ? "" : "s"}
              {otherElements.length > 0 ? ` · ${otherElements.length} other tabs` : ""}
              {meta.fetchedAt
                ? ` · synced ${new Date(meta.fetchedAt).toLocaleDateString()}`
                : ""}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-[var(--muted)] transition-colors hover:border-[var(--blue)] hover:text-[var(--blue)] disabled:opacity-50"
          title="Re-fetch assemblies and part studios from Onshape"
        >
          {refreshing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Refresh metadata
        </button>
      </div>

      {refreshError && <p className="mt-2 text-xs text-red-400">{refreshError}</p>}

      {meta ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--blue)]">
              <Boxes className="h-3.5 w-3.5" />
              Assemblies ({assemblies.length})
            </p>
            {assemblies.length === 0 ? (
              <p className="mt-2 text-xs text-[var(--muted)]">None in this document</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {assemblies.slice(0, 8).map((name) => (
                  <li key={name} className="truncate text-sm">
                    {name}
                  </li>
                ))}
                {assemblies.length > 8 && (
                  <li className="text-xs text-[var(--muted)]">
                    +{assemblies.length - 8} more
                  </li>
                )}
              </ul>
            )}
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)]">
              <Layers className="h-3.5 w-3.5" />
              Part studios ({partStudios.length})
            </p>
            {partStudios.length === 0 ? (
              <p className="mt-2 text-xs text-[var(--muted)]">None in this document</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {partStudios.slice(0, 8).map((name) => (
                  <li key={name} className="truncate text-sm">
                    {name}
                  </li>
                ))}
                {partStudios.length > 8 && (
                  <li className="text-xs text-[var(--muted)]">
                    +{partStudios.length - 8} more
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-[var(--muted)]">
          No structural metadata yet. Refresh metadata (requires the project&apos;s Onshape
          connection) to pull the assembly and part-studio inventory.
        </p>
      )}

      {openUrl && (
        <a
          href={openUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-[var(--blue)] py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
        >
          <ExternalLink className="h-4 w-4" />
          Open in Onshape
        </a>
      )}
      <p className="mt-2 text-center text-[11px] text-[var(--muted)]">
        Onshape blocks embedding its editor in other sites, so the 3D view opens in a new
        tab.
      </p>
    </div>
  );
}
