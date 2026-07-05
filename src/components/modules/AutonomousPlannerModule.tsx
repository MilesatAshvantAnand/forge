"use client";

import { useRef, useState } from "react";
import type { ProjectMetadata } from "@/lib/types";
import {
  Map,
  Route,
  ChevronRight,
  Upload,
  Search,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { ModulePanelShell } from "./ModulePanelShell";

interface AutonomousPlannerModuleProps {
  projectId: string;
  metadata: ProjectMetadata | null;
  onClose: () => void;
  onSelectFile?: (path: string) => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

interface PartResult {
  title: string;
  url: string;
  highlights: string[];
}

const DEMO_ROUTINES: { name: string; color: string; points: string }[] = [
  { name: "redLeft", color: "var(--red)", points: "6-ring rush → match load" },
  { name: "blueRight", color: "var(--blue)", points: "Mirror path, wider turn" },
  { name: "skills", color: "var(--green)", points: "Odometry reset at start tile" },
];

export function AutonomousPlannerModule({
  projectId: _projectId,
  metadata,
  onClose,
  onSelectFile,
  expanded,
  onToggleExpand,
}: AutonomousPlannerModuleProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [jerryFile, setJerryFile] = useState<string | null>(null);
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
      title="Path.jerryio & routine design"
      onClose={onClose}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-8 py-8">
        <FieldMap routines={displayRoutines} />

        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">Path.jerryio import</p>
          <p className="mt-1.5 text-sm text-[var(--muted)]">
            Import a .jerryio path file to visualize waypoints and generate PROS/LemLib routines.
          </p>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".jerryio,.json"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setJerryFile(f.name);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border-strong)] py-5 text-base font-medium transition-colors hover:border-[var(--accent)] hover:bg-[var(--inset)]"
          >
            <Upload className="h-5 w-5 text-[var(--accent)]" />
            {jerryFile ?? "Import .jerryio file"}
          </button>
          {jerryFile && (
            <p className="mt-2 text-sm text-[var(--green)]">
              Loaded {jerryFile} — ask Forge to generate the matching auton routine
            </p>
          )}
        </div>

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

function FieldMap({ routines }: { routines: { name: string; color: string }[] }) {
  return (
    <div className="card overflow-hidden p-4">
      <div className="mb-2 flex items-center gap-2">
        <Map className="h-3.5 w-3.5 text-[var(--muted)]" />
        <span className="section-label">Field map</span>
      </div>
      <svg viewBox="0 0 320 200" className="h-40 w-full" aria-hidden>
        <rect x="8" y="8" width="304" height="184" rx="4" fill="var(--field-map-bg)" stroke="var(--border-strong)" strokeWidth="1" />
        <line x1="160" y1="8" x2="160" y2="192" stroke="var(--border)" strokeWidth="1" strokeDasharray="4 4" />
        <circle cx="48" cy="100" r="6" fill="var(--accent)" opacity="0.9" />
        <text x="48" y="118" textAnchor="middle" fill="var(--muted)" fontSize="8">
          Start
        </text>
        {routines.slice(0, 3).map((r, i) => {
          const paths = [
            "M 48 100 Q 100 60 180 50 T 280 80",
            "M 48 100 Q 90 140 200 150 T 270 120",
            "M 48 100 L 120 100 Q 200 80 280 100",
          ];
          return (
            <path
              key={r.name}
              d={paths[i] ?? paths[0]}
              fill="none"
              stroke={r.color}
              strokeWidth="2"
              strokeOpacity={0.55 + i * 0.1}
              strokeLinecap="round"
            />
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-2">
        {routines.slice(0, 3).map((r) => (
          <span key={r.name} className="badge">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: r.color }} />
            {r.name}
          </span>
        ))}
      </div>
    </div>
  );
}
