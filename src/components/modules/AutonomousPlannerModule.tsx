"use client";

import { useRef, useState } from "react";
import type { ProjectMetadata } from "@/lib/types";
import type { JerryioPlanSummary } from "@/lib/auton/jerryio-parser";
import {
  Route,
  ChevronRight,
  Upload,
  Search,
  Loader2,
  ExternalLink,
  MessageSquare,
  CheckCircle2,
  Sparkles,
  MapPin,
} from "lucide-react";
import { VoiceButton } from "@/components/copilot/VoiceButton";
import { ModulePanelShell } from "./ModulePanelShell";

const JERRYIO_URL = "https://path.jerryio.com";

interface AutonomousPlannerModuleProps {
  projectId: string;
  metadata: ProjectMetadata | null;
  onClose: () => void;
  onSelectFile?: (path: string) => void;
  onResourceUploaded?: () => void;
  onSendChatPrompt?: (prompt: string) => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

interface PartResult {
  title: string;
  url: string;
  highlights: string[];
}

interface UploadedPlan {
  fileName: string;
  plan: JerryioPlanSummary;
  description: string;
  notes: string;
}

const DEMO_ROUTINES: { name: string; color: string; points: string }[] = [
  { name: "redLeft", color: "var(--red)", points: "6-ring rush → match load" },
  { name: "blueRight", color: "var(--blue)", points: "Mirror path, wider turn" },
  { name: "skills", color: "var(--green)", points: "Odometry reset at start tile" },
];

export function AutonomousPlannerModule({
  projectId,
  metadata,
  onClose,
  onSelectFile,
  onResourceUploaded,
  onSendChatPrompt,
  expanded,
  onToggleExpand,
}: AutonomousPlannerModuleProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<UploadedPlan | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [partsQuery, setPartsQuery] = useState("");
  const [partsResults, setPartsResults] = useState<PartResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const routines = metadata?.autonRoutines ?? [];
  const displayRoutines =
    routines.length > 0
      ? routines.slice(0, 8).map((r) => ({
          name: r.name,
          file: r.file,
          color: "var(--accent)",
          points: `Defined in ${r.file}`,
        }))
      : DEMO_ROUTINES.map((r) => ({ ...r, file: "src/autons.cpp" }));

  const uploadPlan = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (notes.trim()) formData.append("notes", notes.trim());
      const res = await fetch(`/api/projects/${projectId}/auton-plan`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setUploaded({
        fileName: file.name,
        plan: data.plan,
        description: data.description,
        notes: notes.trim(),
      });
      onResourceUploaded?.();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const discussInChat = () => {
    if (!uploaded || !onSendChatPrompt) return;
    const { plan, description, notes: savedNotes } = uploaded;
    const first = plan.paths[0];
    const prompt = [
      `I just uploaded my autonomous plan "${uploaded.fileName}" from path.jerryio. Forge parsed it as: ${description}`,
      savedNotes ? `My strategy notes: ${savedNotes}` : "",
      first
        ? `So my strategy is: start around (${first.start?.x ?? "?"}, ${first.start?.y ?? "?"}) inches, drive ${plan.paths.reduce((s, p) => s + p.segments, 0)} segments covering roughly ${plan.totalDistanceInches} inches total, ending near (${plan.paths[plan.paths.length - 1].end?.x ?? "?"}, ${plan.paths[plan.paths.length - 1].end?.y ?? "?"}). Is that right?`
        : "",
      `Help me reflect on this plan's strengths and weaknesses for MY robot only — based on this project's subsystems and capabilities. Ask me guiding questions instead of rewriting the plan, and don't simulate or judge other teams.`,
    ]
      .filter(Boolean)
      .join("\n\n");
    onSendChatPrompt(prompt);
  };

  const searchParts = async () => {
    if (!partsQuery.trim()) return;
    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch("/api/knowledge/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: partsQuery, type: "vex-parts" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Search failed");
      setPartsResults(data.results ?? []);
      if ((data.results ?? []).length === 0 && !process.env.NEXT_PUBLIC_EXA_CONFIGURED) {
        setSearchError("Add EXA_API_KEY to enable VEX parts search");
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  };

  return (
    <ModulePanelShell
      eyebrow="Autonomous Planner"
      title="Plan visually, reason it out yourself"
      onClose={onClose}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-8 py-8">
        {/* Step-by-step instructions */}
        <div className="card p-5">
          <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:gap-0">
            <StepLabel n={1} text="Plan your autonomous path here" />
            <ChevronRight className="mx-2 hidden h-4 w-4 shrink-0 text-[var(--muted)] sm:block" />
            <StepLabel n={2} text="Save / download your .txt path file" />
            <ChevronRight className="mx-2 hidden h-4 w-4 shrink-0 text-[var(--muted)] sm:block" />
            <StepLabel n={3} text="Upload it back into Forge below" />
          </div>
        </div>

        {/* Embedded path.jerryio editor */}
        <div className="card overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
              path.jerryio — visual path editor
            </p>
            <a
              href={JERRYIO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-[var(--accent)] hover:underline"
            >
              Open in new tab
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <iframe
            src={JERRYIO_URL}
            title="path.jerryio autonomous path editor"
            className="h-[520px] w-full border-0 bg-[var(--inset)]"
            allow="clipboard-write"
          />
        </div>

        {/* Strategy notes + upload */}
        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
            Upload your exported path file
          </p>
          <p className="mt-1.5 text-sm text-[var(--muted)]">
            Export from path.jerryio (File → Save / Download, .txt) and drop it here.
            Forge reads the plan so you can talk strategy — it won&apos;t write your
            auton for you.
          </p>

          <label className="mt-4 block text-xs font-medium text-[var(--muted)]">
            Strategy notes (optional — saved with the plan)
          </label>
          <div className="mt-1.5 flex items-end gap-2">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Rush the center rings first, then back off for match loads…"
              className="min-h-[56px] flex-1 resize-y rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
            <VoiceButton
              title="Dictate strategy notes"
              onTranscript={(t) => setNotes((prev) => (prev ? `${prev} ${t}` : t))}
            />
          </div>

          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".txt,.json,.jerryio"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadPlan(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) uploadPlan(f);
            }}
            disabled={uploading}
            className={`mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed py-5 text-base font-medium transition-colors disabled:opacity-60 ${
              dragOver
                ? "border-[var(--accent)] bg-[var(--accent-dim)]"
                : "border-[var(--border-strong)] hover:border-[var(--accent)] hover:bg-[var(--inset)]"
            }`}
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
            ) : (
              <Upload className="h-5 w-5 text-[var(--accent)]" />
            )}
            {uploading ? "Reading path file…" : "Drop or choose your .txt / .json path file"}
          </button>
          {uploadError && <p className="mt-2 text-sm text-[var(--red)]">{uploadError}</p>}

          <p className="mt-3 flex items-center gap-1.5 text-xs text-[var(--muted)]">
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
            Auto-generated auton code: coming soon. For now, you write the code — that&apos;s
            the point.
          </p>
        </div>

        {/* Parsed plan summary + reflection */}
        {uploaded && (
          <div className="card border-[var(--accent)]/30 p-5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[var(--green)]" />
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
                Plan parsed — {uploaded.fileName}
              </p>
            </div>
            {uploaded.plan.format && (
              <p className="mt-1.5 text-xs text-[var(--muted)]">
                Format: {uploaded.plan.format}
                {uploaded.plan.parsedFrom === "point-lines" &&
                  " (read from sampled points — editor data not found)"}
              </p>
            )}
            <div className="mt-3 flex flex-col gap-2">
              {uploaded.plan.paths.map((p) => (
                <div key={p.name} className="glass rounded-lg px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                    <p className="font-mono text-sm font-semibold">{p.name}</p>
                    <span className="ml-auto shrink-0 text-xs text-[var(--muted)]">
                      ~{p.distanceInches} in
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {p.segments} segment{p.segments === 1 ? "" : "s"} ·{" "}
                    {p.waypoints} waypoints
                    {p.maxSpeed !== undefined && ` · max speed ${p.maxSpeed}`}
                    {p.start &&
                      ` · (${p.start.x}, ${p.start.y}) → (${p.end?.x ?? "?"}, ${p.end?.y ?? "?"}) in`}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm text-[var(--muted)]">
              ~{uploaded.plan.totalDistanceInches} inches of driving across{" "}
              {uploaded.plan.paths.length} path{uploaded.plan.paths.length === 1 ? "" : "s"}.
              Saved to project context{uploaded.notes ? " with your strategy notes" : ""}.
            </p>
            {onSendChatPrompt && (
              <button
                type="button"
                onClick={discussInChat}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent-dim)] px-4 py-2.5 text-sm font-semibold text-[var(--accent)] ring-1 ring-[var(--accent)]/25 transition-colors hover:bg-[var(--accent)]/20"
              >
                <MessageSquare className="h-4 w-4" />
                Talk through this strategy with Forge
              </button>
            )}
            <p className="mt-2 text-center text-xs text-[var(--muted)]">
              Forge discusses your own robot&apos;s plan — it doesn&apos;t simulate or judge
              other teams.
            </p>
          </div>
        )}

        {/* VEX parts lookup (Exa) */}
        <div className="card p-5">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-[var(--blue)]" />
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">VEX parts lookup · Exa</p>
          </div>
          <p className="mt-1.5 text-sm text-[var(--muted)]">
            Hit a building challenge? Search vexrobotics.com competition products.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              value={partsQuery}
              onChange={(e) => setPartsQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchParts()}
              placeholder="e.g. flex wheel intake 4 inch"
              className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2.5 text-sm outline-none focus:border-[var(--blue)]"
            />
            <button
              type="button"
              onClick={searchParts}
              disabled={searching}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--blue-dim)] px-4 py-2.5 text-sm font-semibold text-[var(--blue)] ring-1 ring-[var(--blue)]/25 disabled:opacity-50"
            >
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </button>
          </div>
          {searchError && <p className="mt-2 text-sm text-[var(--red)]">{searchError}</p>}
          {partsResults.length > 0 && (
            <div className="mt-3 flex flex-col gap-2">
              {partsResults.map((r) => (
                <a
                  key={r.url}
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="glass flex items-start gap-2 rounded-lg px-3 py-2.5 transition-colors hover:border-[var(--blue)]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold text-[var(--foreground)]">
                      {r.title}
                    </p>
                    {r.highlights[0] && (
                      <p className="mt-0.5 line-clamp-2 text-sm text-[var(--muted)]">
                        {r.highlights[0]}
                      </p>
                    )}
                  </div>
                  <ExternalLink className="h-4 w-4 shrink-0 text-[var(--blue)]" />
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Detected routines in the codebase */}
        <div>
          <div className="flex items-center gap-2">
            <Route className="h-4 w-4 text-[var(--muted)]" />
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">Detected routines</p>
          </div>
          <div className="mt-3 flex flex-col gap-1.5">
            {displayRoutines.map((r) => (
              <button
                key={r.name}
                type="button"
                onClick={() => onSelectFile?.(r.file)}
                className="glass flex items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:border-[var(--border-strong)]"
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-base">{r.name}()</p>
                  <p className="truncate text-sm text-[var(--muted)]">{r.points}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-[var(--muted)]" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </ModulePanelShell>
  );
}

function StepLabel({ n, text }: { n: number; text: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent-dim)] text-xs font-bold text-[var(--accent)]">
        {n}
      </span>
      <span className="text-[var(--foreground)]">{text}</span>
    </span>
  );
}
