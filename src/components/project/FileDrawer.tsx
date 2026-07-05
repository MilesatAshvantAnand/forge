"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { useTheme } from "@/components/theme/ThemeProvider";
import { syntaxTheme } from "@/lib/syntax-theme";
import { FileCode, X, Loader2 } from "lucide-react";
import { formatBytes } from "@/lib/utils";

interface FileDrawerProps {
  projectId: string;
  filePath: string | null;
  onClose: () => void;
}

interface FileData {
  path: string;
  language: string;
  size: number;
  content: string;
}

export function FileDrawer({ projectId, filePath, onClose }: FileDrawerProps) {
  const { theme } = useTheme();
  const [file, setFile] = useState<FileData | { path: string; notfound: true } | null>(
    null
  );
  const loading = Boolean(filePath) && file?.path !== filePath;

  useEffect(() => {
    if (!filePath) return;
    let cancelled = false;
    fetch(`/api/projects/${projectId}/files?path=${encodeURIComponent(filePath)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setFile(d.error ? { path: filePath, notfound: true } : d);
      })
      .catch(() => {
        if (!cancelled) setFile({ path: filePath, notfound: true });
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, filePath]);

  useEffect(() => {
    if (!filePath) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filePath, onClose]);

  return (
    <AnimatePresence>
      {filePath && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-[var(--backdrop)] backdrop-blur-sm"
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col border-l border-[var(--border)] bg-[var(--surface)]"
          >
            <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
              <FileCode className="h-4 w-4 shrink-0 text-[var(--accent)]" />
              <span className="truncate font-mono text-xs">{filePath}</span>
              {file && !("notfound" in file) && (
                <span className="ml-auto shrink-0 text-[10px] text-[var(--muted)]">
                  {file.language} · {formatBytes(file.size)}
                </span>
              )}
              <button
                onClick={onClose}
                className="ml-2 shrink-0 rounded p-1 text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--foreground)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              {loading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
                </div>
              ) : !file || "notfound" in file ? (
                <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
                  File not found in this project
                </div>
              ) : (
                <SyntaxHighlighter
                  language={file.language}
                  style={syntaxTheme(theme)}
                  showLineNumbers
                  customStyle={{
                    margin: 0,
                    background: "transparent",
                    fontSize: "12px",
                    minHeight: "100%",
                  }}
                  lineNumberStyle={{ opacity: 0.35, minWidth: "3em" }}
                >
                  {file.content}
                </SyntaxHighlighter>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
