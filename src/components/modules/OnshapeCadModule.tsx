"use client";

import { useRef, useState } from "react";
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

  const cadResources = resources.filter((r) => r.type === "cad");
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

  return (
    <ModulePanelShell
      eyebrow="Onshape CAD"
      title="Mechanical ↔ Code"
      onClose={onClose}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
    >
      <div className="mx-auto flex max-w-3xl flex-col px-8 py-8">
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
                const isUrl = r.summary?.startsWith("http");
                return (
                  <div
                    key={r.id}
                    className="glass flex items-center gap-2 rounded-lg px-3 py-2.5 transition-transform duration-200 ease-out will-change-transform hover:scale-[1.03] hover:shadow-lg"
                  >
                    <Box className="h-4 w-4 shrink-0 text-[var(--blue)]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{r.name}</p>
                      {r.size > 0 && (
                        <p className="text-xs text-[var(--muted)]">
                          {formatBytes(r.size)}
                        </p>
                      )}
                    </div>
                    {isUrl && (
                      <a
                        href={r.summary!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 rounded p-1 text-[var(--muted)] hover:text-[var(--blue)]"
                        title="Open in Onshape"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-5 flex h-32 items-center justify-center rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--inset)]">
          <div className="text-center">
            <Box className="mx-auto h-9 w-9 text-[var(--blue)] opacity-70" />
            <p className="mt-2 text-xs text-[var(--muted)]">
              {cadResources.length > 0
                ? "3D preview · coming with live Onshape sync"
                : "Connect or upload to preview assembly"}
            </p>
          </div>
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
