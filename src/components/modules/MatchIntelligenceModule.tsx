"use client";

import { useRef, useState } from "react";
import { Film, AlertTriangle, Clock, Paperclip, Play, Loader2 } from "lucide-react";
import { formatBytes } from "@/lib/utils";
import { ModulePanelShell } from "./ModulePanelShell";

interface VideoResource {
  id: string;
  type: string;
  name: string;
  size: number;
}

interface MatchIntelligenceModuleProps {
  projectId: string;
  resources: VideoResource[];
  onClose: () => void;
  onResourceUploaded?: () => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

const DEMO_TIMELINE = [
  { t: "0:42", label: "Intake jam under ring stack", severity: "high" as const },
  { t: "1:18", label: "Auton turn overshoots tile", severity: "medium" as const },
  { t: "2:05", label: "Endgame arm tip — counterweight", severity: "low" as const },
];

export function MatchIntelligenceModule({
  projectId,
  resources,
  onClose,
  onResourceUploaded,
  expanded,
  onToggleExpand,
}: MatchIntelligenceModuleProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const videos = resources.filter((r) => r.type === "video");
  const [selectedId, setSelectedId] = useState<string | null>(videos[0]?.id ?? null);
  const showDemoTimeline = videos.length === 0;

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/projects/${projectId}/resources`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      onResourceUploaded?.();
    } finally {
      setUploading(false);
    }
  };

  return (
    <ModulePanelShell
      eyebrow="Match Intelligence"
      title="Match analysis"
      onClose={onClose}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
    >
      <div className="mx-auto flex max-w-3xl flex-col px-8 py-8">
        <div className="flex aspect-video items-center justify-center rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--inset)]">
          {selectedId || showDemoTimeline ? (
            <div className="text-center">
              <Play className="mx-auto h-12 w-12 text-[var(--accent)] opacity-80" />
              <p className="mt-3 text-sm text-[var(--muted)]">
                {showDemoTimeline ? "Sample match timeline" : "Video preview"}
              </p>
            </div>
          ) : (
            <div className="text-center px-6">
              <Film className="mx-auto h-12 w-12 text-[var(--muted)] opacity-60" />
              <p className="mt-3 text-sm text-[var(--muted)]">Attach match footage to analyze</p>
            </div>
          )}
        </div>

        {videos.length > 0 ? (
          <div className="mt-5 flex flex-col gap-1">
            {videos.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelectedId(v.id)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                  selectedId === v.id
                    ? "bg-[var(--accent-dim)] text-[var(--accent)]"
                    : "text-[var(--muted)] hover:bg-[var(--hover)]"
                }`}
              >
                <Film className="h-4 w-4 shrink-0" />
                <span className="truncate">{v.name}</span>
                <span className="ml-auto shrink-0 text-xs opacity-70">
                  {formatBytes(v.size)}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-5">
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".mp4,.mov,.webm,.avi,.mkv"
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
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--border)] py-3 text-sm font-semibold transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-60"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Paperclip className="h-4 w-4" />
              )}
              Upload match footage
            </button>
          </div>
        )}

        <div className="mt-7">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[var(--muted)]" />
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
              Failure timeline
            </p>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {(showDemoTimeline ? DEMO_TIMELINE : []).map((event) => (
              <div
                key={event.t}
                className="glass flex items-start gap-3 rounded-lg px-3 py-3"
              >
                <span className="font-mono text-xs text-[var(--accent)]">{event.t}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{event.label}</p>
                </div>
                <AlertTriangle
                  className="h-4 w-4 shrink-0"
                  style={{
                    color:
                      event.severity === "high"
                        ? "var(--red)"
                        : event.severity === "medium"
                          ? "var(--accent)"
                          : "var(--muted)",
                  }}
                />
              </div>
            ))}
            {!showDemoTimeline && videos.length > 0 && (
              <p className="text-sm text-[var(--muted)]">
                Forge will surface timestamps and failure hypotheses once video indexing is
                enabled for this project.
              </p>
            )}
          </div>
        </div>
      </div>
    </ModulePanelShell>
  );
}
