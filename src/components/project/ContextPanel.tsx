"use client";

import { useState } from "react";
import {
  PanelRightClose,
  PanelRightOpen,
  Sparkles,
  Package,
  Boxes,
  Route,
  Gauge,
  Radar,
  Cpu,
  ChevronDown,
  ChevronRight,
  FileCode,
  Folder,
  CheckCircle2,
} from "lucide-react";
import type { FileTreeNode, ProjectMetadata } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ContextPanelProps {
  summary: string | null;
  metadata: ProjectMetadata;
  onSelectFile: (path: string) => void;
  highlight?: boolean;
}

export function ContextPanel({
  summary,
  metadata,
  onSelectFile,
  highlight = false,
}: ContextPanelProps) {
  const [open, setOpen] = useState(true);
  const uniqueSensors = [...new Set(metadata.sensors.map((s) => s.type))];

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Show project understanding"
        className="flex h-full w-10 shrink-0 items-start justify-center border-l border-[var(--border)] bg-[var(--surface)] pt-4 text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
      >
        <PanelRightOpen className="h-4 w-4" />
      </button>
    );
  }

  return (
    <aside
      className={cn(
        "flex h-full w-72 shrink-0 flex-col border-l border-[var(--border)] bg-[var(--surface)] transition-shadow",
        highlight && "ring-2 ring-[var(--accent)] ring-inset"
      )}
    >
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
        <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
        <span className="text-xs font-semibold">Project understanding</span>
        <button
          onClick={() => setOpen(false)}
          className="ml-auto rounded p-1 text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--foreground)]"
        >
          <PanelRightClose className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {summary && (
          <p className="rounded-lg border border-[var(--border)] bg-[var(--inset-strong)] p-3 text-xs leading-relaxed text-[var(--muted)]">
            {summary}
          </p>
        )}

        <Section icon={Package} title="Libraries" defaultOpen>
          <div className="flex flex-wrap gap-1.5">
            {metadata.libraries.length === 0 && <Muted>None detected</Muted>}
            {metadata.libraries.map((l) => (
              <div
                key={l.name}
                className="flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--elevated)] px-2 py-1 text-xs"
              >
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[var(--green)]" />
                <span>{l.name}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section icon={Boxes} title="Subsystems" defaultOpen>
          {metadata.subsystems.length === 0 && <Muted>None detected</Muted>}
          <div className="flex flex-col gap-0.5">
            {metadata.subsystems.slice(0, 8).map((s) => (
              <button
                key={s.name}
                onClick={() => s.files[0] && onSelectFile(s.files[0])}
                className="flex items-center justify-between rounded px-1.5 py-1 text-left text-xs capitalize text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--foreground)]"
              >
                {s.name}
                <span className="text-[10px]">{s.files.length} files</span>
              </button>
            ))}
          </div>
        </Section>

        <Section icon={Route} title="Autonomous">
          {metadata.autonRoutines.length === 0 && <Muted>None found</Muted>}
          <div className="flex flex-col gap-0.5">
            {metadata.autonRoutines.slice(0, 6).map((a, i) => (
              <button
                key={`${a.file}-${a.name}-${i}`}
                onClick={() => onSelectFile(a.file)}
                className="truncate rounded px-1.5 py-1 text-left font-mono text-[11px] text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--accent)]"
              >
                {a.name}()
              </button>
            ))}
          </div>
        </Section>

        <Section icon={Gauge} title={`PID (${metadata.pidControllers.length})`}>
          {metadata.pidControllers.length === 0 && <Muted>None found</Muted>}
          <div className="flex flex-col gap-0.5">
            {metadata.pidControllers.slice(0, 6).map((p, i) => (
              <button
                key={`${p.file}-${p.line}-${i}`}
                onClick={() => onSelectFile(p.file)}
                className="truncate rounded px-1.5 py-1 text-left font-mono text-[10px] text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--accent)]"
                title={`${p.file}:${p.line}`}
              >
                {p.values}
              </button>
            ))}
          </div>
        </Section>

        <Section icon={Radar} title="Sensors">
          <div className="flex flex-wrap gap-1.5">
            {uniqueSensors.length === 0 && <Muted>None detected</Muted>}
            {uniqueSensors.map((s) => (
              <div
                key={s}
                className="flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--elevated)] px-2 py-1 text-xs"
              >
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[var(--green)]" />
                <span>{s}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section icon={Cpu} title="Capabilities">
          <div className="flex flex-wrap gap-1">
            {metadata.capabilities.length === 0 && <Muted>None detected</Muted>}
            {metadata.capabilities.map((c) => (
              <span
                key={c}
                className="rounded-full bg-[var(--accent-dim)] px-2 py-0.5 text-[11px] text-[var(--accent)]"
              >
                {c}
              </span>
            ))}
          </div>
        </Section>

        <Section icon={Folder} title={`Files (${metadata.totalFiles})`}>
          <MiniFileTree nodes={metadata.fileTree} onSelect={onSelectFile} depth={0} />
        </Section>
      </div>
    </aside>
  );
}

function Section({
  icon: Icon,
  title,
  children,
  defaultOpen = false,
}: {
  icon: typeof Package;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 px-1 py-1 text-[10px] font-medium uppercase tracking-widest text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
      >
        {open ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        <Icon className="h-3 w-3 text-[var(--accent)]" />
        {title}
      </button>
      {open && <div className="mt-1 px-1">{children}</div>}
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-[var(--muted)]">{children}</p>;
}

function MiniFileTree({
  nodes,
  onSelect,
  depth,
}: {
  nodes: FileTreeNode[];
  onSelect: (path: string) => void;
  depth: number;
}) {
  return (
    <div className="flex flex-col">
      {nodes.map((node) => (
        <MiniTreeNode key={node.path} node={node} onSelect={onSelect} depth={depth} />
      ))}
    </div>
  );
}

function MiniTreeNode({
  node,
  onSelect,
  depth,
}: {
  node: FileTreeNode;
  onSelect: (path: string) => void;
  depth: number;
}) {
  const [open, setOpen] = useState(depth < 1);

  if (node.type === "directory") {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] text-[var(--muted)] hover:bg-[var(--hover)]"
          style={{ paddingLeft: `${depth * 10 + 4}px` }}
        >
          {open ? (
            <ChevronDown className="h-2.5 w-2.5 shrink-0" />
          ) : (
            <ChevronRight className="h-2.5 w-2.5 shrink-0" />
          )}
          <Folder className="h-2.5 w-2.5 shrink-0 text-[var(--accent)]" />
          <span className="truncate">{node.name}</span>
        </button>
        {open && node.children && (
          <MiniFileTree nodes={node.children} onSelect={onSelect} depth={depth + 1} />
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => onSelect(node.path)}
      className={cn(
        "flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--foreground)]"
      )}
      style={{ paddingLeft: `${depth * 10 + 14}px` }}
    >
      <FileCode className="h-2.5 w-2.5 shrink-0" />
      <span className="truncate">{node.name}</span>
    </button>
  );
}
