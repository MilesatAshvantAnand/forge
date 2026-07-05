"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { useTheme } from "@/components/theme/ThemeProvider";
import {
  FileCode,
  Folder,
  ChevronDown,
  ChevronRight,
  Loader2,
  Save,
  Check,
  ExternalLink,
  GitCommitHorizontal,
  FolderGit2,
} from "lucide-react";
import type { FileTreeNode } from "@/lib/types";
import { cn, formatBytes } from "@/lib/utils";

interface CodeEditorViewProps {
  projectId: string;
  filePath: string | null;
  fileTree: FileTreeNode[];
  onSelectFile: (path: string) => void;
  /** Scroll to and highlight this line when the file opens (e.g. from a chat citation) */
  focusLine?: number | null;
  /** Set for GitHub-imported projects — enables Open on GitHub deep links */
  githubRepo?: string | null;
  githubRef?: string | null;
}

interface FileData {
  path: string;
  language: string;
  size: number;
  content: string;
}

const MONACO_LANGUAGES: Record<string, string> = {
  cpp: "cpp",
  c: "c",
  h: "cpp",
  hpp: "cpp",
  java: "java",
  python: "python",
  py: "python",
  javascript: "javascript",
  typescript: "typescript",
  json: "json",
  markdown: "markdown",
  md: "markdown",
  cmake: "plaintext",
  makefile: "plaintext",
};

export function CodeEditorView({
  projectId,
  filePath,
  fileTree,
  onSelectFile,
  focusLine,
  githubRepo,
  githubRef,
}: CodeEditorViewProps) {
  const { theme } = useTheme();
  const [file, setFile] = useState<FileData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const contentRef = useRef<string>("");
  const loading = Boolean(filePath) && file?.path !== filePath;

  // GitHub connection status — controls the Connect / Push buttons
  const [github, setGithub] = useState<{
    oauthConfigured: boolean;
    connected: boolean;
    login: string | null;
    fallbackToken: boolean;
  } | null>(null);
  const [pushing, setPushing] = useState(false);
  const [pushed, setPushed] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);

  useEffect(() => {
    if (!githubRepo) return;
    fetch(`/api/projects/${projectId}/github`)
      .then((r) => r.json())
      .then((d) => setGithub(d))
      .catch(() => setGithub(null));
  }, [projectId, githubRepo]);

  const canPush = Boolean(github && (github.connected || github.fallbackToken));

  useEffect(() => {
    if (!filePath) {
      setFile(null);
      setNotFound(false);
      return;
    }
    let cancelled = false;
    setFile(null);
    setNotFound(false);
    setDirty(false);
    fetch(`/api/projects/${projectId}/files?path=${encodeURIComponent(filePath)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.error) {
          setNotFound(true);
          setFile(null);
        } else {
          setFile(d);
          contentRef.current = d.content ?? "";
        }
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, filePath]);

  const handleSave = useCallback(async () => {
    if (!filePath || !dirty) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/files`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: filePath, content: contentRef.current }),
      });
      if (res.ok) {
        setDirty(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }, [projectId, filePath, dirty]);

  const handlePush = useCallback(async () => {
    if (!filePath || pushing) return;
    setPushing(true);
    setPushError(null);
    try {
      // Make sure the latest editor content is saved before committing
      if (dirty) {
        const saveRes = await fetch(`/api/projects/${projectId}/files`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: filePath, content: contentRef.current }),
        });
        if (!saveRes.ok) throw new Error("Save before push failed");
        setDirty(false);
      }
      const res = await fetch(`/api/projects/${projectId}/github`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: filePath }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Push failed");
      setPushed(true);
      setTimeout(() => setPushed(false), 2500);
    } catch (err) {
      setPushError(err instanceof Error ? err.message : "Push failed");
      setTimeout(() => setPushError(null), 5000);
    } finally {
      setPushing(false);
    }
  }, [projectId, filePath, dirty, pushing]);

  const handleMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        // handleSave reads latest state via refs set in onChange
        saveRef.current?.();
      });
      if (focusLine && focusLine > 0) {
        editor.revealLineInCenter(focusLine);
        editor.setPosition({ lineNumber: focusLine, column: 1 });
      }
    },
    [focusLine]
  );

  // Keep the Cmd+S command pointed at the latest save closure
  const saveRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    saveRef.current = handleSave;
  }, [handleSave]);

  useEffect(() => {
    if (editorRef.current && focusLine && focusLine > 0 && file) {
      editorRef.current.revealLineInCenter(focusLine);
      editorRef.current.setPosition({ lineNumber: focusLine, column: 1 });
    }
  }, [focusLine, file]);

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
              <span className="truncate font-mono text-xs">
                {filePath}
                {dirty && <span className="ml-1 text-[var(--accent)]">●</span>}
              </span>
              {file && (
                <span className="ml-auto shrink-0 text-[10px] text-[var(--muted)]">
                  {file.language} · {formatBytes(file.size)}
                </span>
              )}
              {githubRepo && filePath && (
                <a
                  href={`https://github.com/${githubRepo}/blob/${githubRef ?? "main"}/${filePath}${focusLine ? `#L${focusLine}` : ""}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex shrink-0 items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-1 text-[10px] font-medium text-[var(--muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
                  title="Open on GitHub"
                >
                  <ExternalLink className="h-3 w-3" />
                  GitHub
                </a>
              )}
              {githubRepo && github && !canPush && github.oauthConfigured && (
                <a
                  href={`/api/auth/github?projectId=${projectId}`}
                  className="flex shrink-0 items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-1 text-[10px] font-medium text-[var(--muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
                  title="Connect your GitHub account to push edits back"
                >
                  <FolderGit2 className="h-3 w-3" />
                  Connect GitHub
                </a>
              )}
              {githubRepo && canPush && (
                <button
                  type="button"
                  onClick={handlePush}
                  disabled={pushing}
                  className={cn(
                    "flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-medium transition-colors",
                    pushError
                      ? "border-red-500/50 text-red-400"
                      : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
                  )}
                  title={
                    pushError ??
                    `Commit this file to ${githubRepo}@${githubRef ?? "main"}${github?.login ? ` as ${github.login}` : ""}`
                  }
                >
                  {pushing ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : pushed ? (
                    <Check className="h-3 w-3 text-[var(--accent)]" />
                  ) : (
                    <GitCommitHorizontal className="h-3 w-3" />
                  )}
                  {pushed ? "Pushed" : pushError ? "Push failed" : "Push"}
                </button>
              )}
              <button
                type="button"
                onClick={handleSave}
                disabled={!dirty || saving}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                  dirty
                    ? "bg-[var(--accent)] text-black hover:opacity-90"
                    : "border border-[var(--border)] text-[var(--muted)]"
                )}
                title="Save (Cmd+S)"
              >
                {saving ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : saved ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Save className="h-3 w-3" />
                )}
                {saved ? "Saved" : "Save"}
              </button>
            </div>
            <div className="min-h-0 flex-1">
              {loading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
                </div>
              ) : notFound ? (
                <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
                  File not found in this project
                </div>
              ) : file ? (
                <Editor
                  height="100%"
                  language={MONACO_LANGUAGES[file.language] ?? "plaintext"}
                  theme={theme === "light" ? "light" : "vs-dark"}
                  value={file.content}
                  onMount={handleMount}
                  onChange={(value) => {
                    contentRef.current = value ?? "";
                    setDirty((value ?? "") !== file.content);
                  }}
                  options={{
                    fontSize: 13,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    wordWrap: "on",
                    automaticLayout: true,
                    padding: { top: 12 },
                  }}
                />
              ) : null}
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <FileCode className="h-10 w-10 text-[var(--muted)] opacity-50" />
            <p className="mt-4 text-sm font-medium">Select a file to edit</p>
            <p className="mt-2 max-w-xs text-xs leading-relaxed text-[var(--muted)]">
              Browse the file tree on the left, or click a code citation in chat to open
              it here. Edits save back into Forge&apos;s index.
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
