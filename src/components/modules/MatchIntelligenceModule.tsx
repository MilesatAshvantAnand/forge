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
      <div className="flex flex-col px-5 py-6">
        <div className="flex aspect-video items-center justify-center rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--inset)]">
          {selectedId || showDemoTimeline ? (
            <div className="text-center">
              <Play className="mx-auto h-10 w-10 text-[var(--accent)] opacity-80" />
              <p className="mt-2 text-xs text-[var(--muted)]">
                {showDemoTimeline ? "Sample match timeline" : "Video preview"}
              </p>
            </div>
          ) : (
            <div className="text-center px-6">
              <Film className="mx-auto h-10 w-10 text-[var(--muted)] opacity-60" />
              <p className="mt-2 text-xs text-[var(--muted)]">Attach match footage to analyze</p>
            </div>
          )}
        </div>

        {videos.length > 0 ? (
          <div className="mt-4 flex flex-col gap-1">
            {videos.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelectedId(v.id)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors ${
                  selectedId === v.id
                    ? "bg-[var(--accent-dim)] text-[var(--accent)]"
                    : "text-[var(--muted)] hover:bg-[var(--hover)]"
                }`}
              >
                <Film className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{v.name}</span>
                <span className="ml-auto shrink-0 text-[10px] opacity-70">
                  {formatBytes(v.size)}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-4">
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
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--border)] py-2.5 text-xs font-medium transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-60"
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Paperclip className="h-3.5 w-3.5" />
              )}
              Upload match footage
            </button>
          </div>
        )}

        <div className="mt-6">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-[var(--muted)]" />
            <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--muted)]">
              Failure timeline
            </p>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {(showDemoTimeline ? DEMO_TIMELINE : []).map((event) => (
              <div
                key={event.t}
                className="glass flex items-start gap-3 rounded-lg px-3 py-2.5"
              >
                <span className="font-mono text-[10px] text-[var(--accent)]">{event.t}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs">{event.label}</p>
                </div>
                <AlertTriangle
                  className="h-3.5 w-3.5 shrink-0"
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
              <p className="text-xs text-[var(--muted)]">
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
