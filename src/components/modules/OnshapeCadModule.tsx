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
      <div className="flex flex-col px-5 py-6">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--inset)] p-4">
          <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--muted)]">
            Connect Onshape
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-[var(--muted)]">
            Paste your Onshape document URL or upload an exported assembly (.STEP, .STL).
          </p>

          <div className="mt-3 flex gap-2">
            <input
              type="url"
              value={onshapeUrl}
              onChange={(e) => {
                setOnshapeUrl(e.target.value);
                setConnectError(null);
              }}
              placeholder="https://cad.onshape.com/documents/…"
              className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-xs outline-none placeholder:text-[var(--muted)]/60 focus:border-[var(--blue)]"
            />
            <button
              type="button"
              onClick={handleConnect}
              disabled={connecting || !onshapeUrl.trim()}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--blue)] px-3 py-2 text-xs font-medium text-black transition-opacity disabled:opacity-40"
            >
              {connecting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : connectSuccess ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Link2 className="h-3.5 w-3.5" />
              )}
              Link
            </button>
          </div>
          {connectError && (
            <p className="mt-2 text-[10px] text-red-400">{connectError}</p>
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
            className="mt-3 flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border-strong)] py-6 transition-colors hover:border-[var(--blue)] hover:bg-[var(--inset)] disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 className="h-6 w-6 animate-spin text-[var(--blue)]" />
            ) : (
              <Upload className="h-6 w-6 text-[var(--blue)] opacity-80" />
            )}
            <span className="text-xs font-medium">
              {uploading ? "Uploading…" : "Upload CAD export"}
            </span>
            <span className="text-[10px] text-[var(--muted)]">STEP · STL · IGES · OBJ</span>
          </button>
        </div>

        {cadResources.length > 0 && (
          <div className="mt-4">
            <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--muted)]">
              Linked CAD
            </p>
            <div className="mt-2 flex flex-col gap-1">
              {cadResources.map((r) => {
                const isUrl = r.summary?.startsWith("http");
                return (
                  <div
                    key={r.id}
                    className="glass flex items-center gap-2 rounded-lg px-3 py-2"
                  >
                    <Box className="h-3.5 w-3.5 shrink-0 text-[var(--blue)]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs">{r.name}</p>
                      {r.size > 0 && (
                        <p className="text-[10px] text-[var(--muted)]">
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
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-4 flex h-28 items-center justify-center rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--inset)]">
          <div className="text-center">
            <Box className="mx-auto h-8 w-8 text-[var(--blue)] opacity-70" />
            <p className="mt-2 text-[10px] text-[var(--muted)]">
              {cadResources.length > 0
                ? "3D preview · coming with live Onshape sync"
                : "Connect or upload to preview assembly"}
            </p>
          </div>
        </div>

        {showDemoChain ? (
          <div className="mt-6 flex flex-col items-center">
            <p className="mb-3 text-center text-xs text-[var(--muted)]">
              Forge links mechanical design to code and documentation
            </p>
            {DEMO_CHAIN.map((item, i) => (
              <div key={item.label} className="flex w-full flex-col items-center">
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.12 }}
                  className="glass w-full rounded-xl px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-lg"
                      style={{
                        background: `color-mix(in srgb, ${item.color} 15%, transparent)`,
                      }}
                    >
                      <item.icon className="h-4 w-4" style={{ color: item.color }} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-[var(--muted)]">{item.sub}</p>
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
          <div className="mt-6">
            <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--muted)]">
              Detected subsystems
            </p>
            {subsystems.length === 0 ? (
              <p className="mt-3 text-xs text-[var(--muted)]">
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
                    className="glass flex items-center justify-between rounded-lg px-3 py-2 text-left transition-colors hover:border-[var(--border-strong)]"
                  >
                    <span className="text-xs capitalize">{s.name}</span>
                    <span className="text-[10px] text-[var(--muted)]">
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
