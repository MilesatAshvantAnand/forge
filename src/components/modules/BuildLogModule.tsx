"use client";

import { useEffect, useState } from "react";
import { Mic, MicOff, Loader2, ScrollText, Radio } from "lucide-react";
import { ModulePanelShell } from "./ModulePanelShell";

interface BuildLogModuleProps {
  projectId: string;
  recording: boolean;
  onRecordingChange: (recording: boolean) => void;
  onClose: () => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

export function BuildLogModule({
  projectId,
  recording,
  onRecordingChange,
  onClose,
  expanded,
  onToggleExpand,
}: BuildLogModuleProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLog = () => {
    setLoading(true);
    fetch(`/api/projects/${projectId}/build-log`)
      .then((r) => r.json())
      .then((d) => setContent(d.content ?? ""))
      .catch(() => setContent(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLog();
  }, [projectId]);

  useEffect(() => {
    if (!recording) fetchLog();
  }, [recording, projectId]);

  return (
    <ModulePanelShell
      eyebrow="Build Log"
      title="Hands-free session recording"
      onClose={onClose}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
    >
      <div className="flex flex-col gap-4 px-5 py-6">
        <div className="card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">
                Session recording
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
                Leave the laptop at the build table. Every chat message is appended to{" "}
                <code className="text-[var(--accent)]">log.md</code>.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onRecordingChange(!recording)}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                recording
                  ? "bg-[var(--red-dim)] text-[var(--red)] ring-1 ring-[var(--red)]/30"
                  : "bg-[var(--green-dim)] text-[var(--green)] ring-1 ring-[var(--green)]/30"
              }`}
            >
              {recording ? (
                <>
                  <span className="record-dot h-2 w-2 rounded-full bg-[var(--red)]" />
                  <MicOff className="h-4 w-4" />
                  Stop
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4" />
                  Record
                </>
              )}
            </button>
          </div>
          {recording && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-[var(--red-dim)] px-3 py-2 text-xs text-[var(--red)]">
              <Radio className="h-3.5 w-3.5" />
              Recording — conversations are being saved to your build log
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2">
            <ScrollText className="h-3.5 w-3.5 text-[var(--muted)]" />
            <p className="section-label">log.md</p>
          </div>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--muted)]" />
            </div>
          ) : (
            <article className="card max-h-96 overflow-y-auto p-4 font-mono text-xs leading-relaxed text-[var(--foreground-secondary)] whitespace-pre-wrap">
              {content ?? "No build log yet. Start recording and chat while you build."}
            </article>
          )}
        </div>

        <p className="text-xs leading-relaxed text-[var(--muted)]">
          Build log entries feed the engineering notebook and help Forge generate aligned
          code sections from your project scope.
        </p>
      </div>
    </ModulePanelShell>
  );
}
