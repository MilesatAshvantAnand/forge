"use client";

import { useEffect, useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { useTheme } from "@/components/theme/ThemeProvider";
import { syntaxTheme } from "@/lib/syntax-theme";
import {
  FileCode,
  Folder,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react";
import type { FileTreeNode } from "@/lib/types";
import { cn, formatBytes } from "@/lib/utils";

interface CodeEditorViewProps {
  projectId: string;
  filePath: string | null;
  fileTree: FileTreeNode[];
  onSelectFile: (path: string) => void;
}

interface FileData {
  path: string;
  language: string;
  size: number;
  content: string;
}

export function CodeEditorView({
  projectId,
  filePath,
  fileTree,
  onSelectFile,
}: CodeEditorViewProps) {
  const { theme } = useTheme();
  const [file, setFile] = useState<FileData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const loading = Boolean(filePath) && file?.path !== filePath;

  useEffect(() => {
    if (!filePath) {
      setFile(null);
      setNotFound(false);
      return;
    }
    let cancelled = false;
    setFile(null);
    setNotFound(false);
    fetch(`/api/projects/${projectId}/files?path=${encodeURIComponent(filePath)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.error) {
          setNotFound(true);
          setFile(null);
        } else {
          setFile(d);
        }
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, filePath]);

  return (
    <div className="flex h-full">
      <aside className="flex w-52 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)]">
        <div className="border-b border-[var(--border)] px-3 py-2">
          <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--muted)]">
            Files
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {fileTree.length === 0 ? (
            <p className="px-1 py-2 text-[11px] text-[var(--muted)]">No files indexed</p>
          ) : (
            <EditorFileTree
              nodes={fileTree}
              activePath={filePath}
              onSelect={onSelectFile}
              depth={0}
            />
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {filePath ? (
          <>
            <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border)] px-4 py-2">
              <FileCode className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
              <span className="truncate font-mono text-xs">{filePath}</span>
              {file && (
                <span className="ml-auto shrink-0 text-[10px] text-[var(--muted)]">
                  {file.language} · {formatBytes(file.size)}
                </span>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              {loading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
                </div>
              ) : notFound ? (
                <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
                  File not found in this project
                </div>
              ) : file ? (
                <SyntaxHighlighter
                  language={file.language}
                  style={syntaxTheme(theme)}
                  showLineNumbers
                  customStyle={{
                    margin: 0,
                    background: "transparent",
                    fontSize: "12px",
                    minHeight: "100%",
                    padding: "1rem",
                  }}
                  lineNumberStyle={{ opacity: 0.35, minWidth: "3em" }}
                >
                  {file.content}
                </SyntaxHighlighter>
              ) : null}
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <FileCode className="h-10 w-10 text-[var(--muted)] opacity-50" />
            <p className="mt-4 text-sm font-medium">Select a file to edit</p>
            <p className="mt-2 max-w-xs text-xs leading-relaxed text-[var(--muted)]">
              Browse the file tree on the left, or click a code citation in chat to open
              it here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function EditorFileTree({
  nodes,
  activePath,
  onSelect,
  depth,
}: {
  nodes: FileTreeNode[];
  activePath: string | null;
  onSelect: (path: string) => void;
  depth: number;
}) {
  return (
    <div className="flex flex-col">
      {nodes.map((node) => (
        <EditorTreeNode
          key={node.path}
          node={node}
          activePath={activePath}
          onSelect={onSelect}
          depth={depth}
        />
      ))}
    </div>
  );
}

function EditorTreeNode({
  node,
  activePath,
  onSelect,
  depth,
}: {
  node: FileTreeNode;
  activePath: string | null;
  onSelect: (path: string) => void;
  depth: number;
}) {
  const [open, setOpen] = useState(depth < 2);

  if (node.type === "directory") {
    return (
      <div>
        <button
          type="button"
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
          <EditorFileTree
            nodes={node.children}
            activePath={activePath}
            onSelect={onSelect}
            depth={depth + 1}
          />
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(node.path)}
      className={cn(
        "flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] transition-colors",
        activePath === node.path
          ? "bg-[var(--accent-dim)] text-[var(--accent)]"
          : "text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--foreground)]"
      )}
      style={{ paddingLeft: `${depth * 10 + 14}px` }}
    >
      <FileCode className="h-2.5 w-2.5 shrink-0" />
      <span className="truncate">{node.name}</span>
    </button>
  );
}
