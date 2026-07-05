"use client";

import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { useTheme } from "@/components/theme/ThemeProvider";
import { syntaxTheme } from "@/lib/syntax-theme";
import {
  Check,
  Copy,
  ExternalLink,
  FileCode,
  Loader2,
  Wand2,
  X,
} from "lucide-react";

export interface CodeBlockMeta {
  file: string | null;
  startLine: number | null;
  endLine: number | null;
}

/** Parse fence meta like `file=src/intake.cpp lines=42-58`. */
export function parseCodeBlockMeta(meta: string | null | undefined): CodeBlockMeta {
  const result: CodeBlockMeta = { file: null, startLine: null, endLine: null };
  if (!meta) return result;
  const fileMatch = meta.match(/file=([^\s]+)/);
  if (fileMatch) result.file = fileMatch[1];
  const linesMatch = meta.match(/lines=(\d+)(?:-(\d+))?/);
  if (linesMatch) {
    result.startLine = Number(linesMatch[1]);
    result.endLine = linesMatch[2] ? Number(linesMatch[2]) : Number(linesMatch[1]);
  }
  return result;
}

type ApplyState = "idle" | "applying" | "applied" | "rejected" | "error";

interface CodeEditBlockProps {
  projectId: string;
  language: string;
  code: string;
  file: string | null;
  startLine: number | null;
  endLine: number | null;
  onOpenFile: (path: string, line?: number | null) => void;
  onApplied?: () => void;
}

/**
 * Claude Code-style editable code segment in chat.
 * Apply splices the proposed segment into the target file via the PATCH files
 * API; double-clicking opens the file in the editor at the cited line.
 */
export function CodeEditBlock({
  projectId,
  language,
  code,
  file,
  startLine,
  endLine,
  onOpenFile,
  onApplied,
}: CodeEditBlockProps) {
  const { theme } = useTheme();
  const [state, setState] = useState<ApplyState>("idle");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canApply = Boolean(file) && state !== "applied" && state !== "rejected";

  const handleApply = async () => {
    if (!file) return;
    setState("applying");
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/files?path=${encodeURIComponent(file)}`
      );
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "File not found");

      let newContent: string;
      const proposed = code.replace(/\n$/, "");
      if (startLine && endLine) {
        const lines = (data.content as string).split("\n");
        if (startLine > lines.length) throw new Error("Line range out of bounds");
        newContent = [
          ...lines.slice(0, startLine - 1),
          proposed,
          ...lines.slice(endLine),
        ].join("\n");
      } else {
        // No line range — treat the block as the new full file content
        newContent = proposed;
      }

      const patch = await fetch(`/api/projects/${projectId}/files`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: file, content: newContent }),
      });
      if (!patch.ok) {
        const d = await patch.json().catch(() => ({}));
        throw new Error(d.error ?? "Apply failed");
      }
      setState("applied");
      onApplied?.();
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Apply failed");
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className="not-prose group my-3 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--inset)]"
      onDoubleClick={() => file && onOpenFile(file, startLine)}
      title={file ? "Double-click to open in editor" : undefined}
    >
      <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--surface-raised)] px-3 py-1.5">
        {file ? (
          <button
            type="button"
            onClick={() => onOpenFile(file, startLine)}
            className="flex min-w-0 items-center gap-1.5 font-mono text-xs text-[var(--accent)] hover:underline"
          >
            <FileCode className="h-3 w-3 shrink-0" />
            <span className="truncate">{file}</span>
            {startLine && (
              <span className="shrink-0 text-[var(--muted)]">
                :{startLine}
                {endLine && endLine !== startLine ? `-${endLine}` : ""}
              </span>
            )}
          </button>
        ) : (
          <span className="font-mono text-xs text-[var(--muted)]">{language}</span>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={handleCopy}
            className="rounded p-1 text-[var(--muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--foreground)]"
            title="Copy"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          {file && (
            <button
              type="button"
              onClick={() => onOpenFile(file, startLine)}
              className="rounded p-1 text-[var(--muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--foreground)]"
              title="Open in editor"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <SyntaxHighlighter
        language={language || "cpp"}
        style={syntaxTheme(theme)}
        customStyle={{
          margin: 0,
          background: "transparent",
          fontSize: "12px",
          padding: "0.75rem 1rem",
        }}
      >
        {code.replace(/\n$/, "")}
      </SyntaxHighlighter>

      {file && (
        <div className="flex items-center gap-2 border-t border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2">
          {state === "applied" ? (
            <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--green)]">
              <Check className="h-3.5 w-3.5" />
              Applied to {file}
            </span>
          ) : state === "rejected" ? (
            <span className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
              <X className="h-3.5 w-3.5" />
              Rejected
            </span>
          ) : (
            <>
              <button
                type="button"
                onClick={handleApply}
                disabled={!canApply || state === "applying"}
                className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {state === "applying" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Wand2 className="h-3.5 w-3.5" />
                )}
                {startLine ? "Apply" : "Replace file"}
              </button>
              <button
                type="button"
                onClick={() => setState("rejected")}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
              >
                <X className="h-3.5 w-3.5" />
                Reject
              </button>
            </>
          )}
          {error && <span className="text-xs text-[var(--red,#f87171)]">{error}</span>}
          <span className="ml-auto hidden text-[10px] text-[var(--muted)]/60 sm:block">
            Double-click to open in editor
          </span>
        </div>
      )}
    </div>
  );
}
