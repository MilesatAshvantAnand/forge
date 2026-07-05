"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Maximize2, Minimize2 } from "lucide-react";

interface ModulePanelShellProps {
  eyebrow: string;
  title: string;
  onClose?: () => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
  children: React.ReactNode;
}

/** Module chrome: fills the main editor column as a primary view; expands to a fullscreen modal on request. */
export function ModulePanelShell({
  eyebrow,
  title,
  onClose,
  expanded = false,
  onToggleExpand,
  children,
}: ModulePanelShellProps) {
  const shell = (
    <>
      <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-5">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">
            {eyebrow}
          </p>
          <h2 className="text-xl font-bold text-[var(--foreground)]">{title}</h2>
        </div>
        <div className="flex items-center gap-1">
          {onToggleExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="rounded-lg p-2 text-[var(--muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--foreground)]"
              aria-label={expanded ? "Collapse module" : "Expand module"}
              title={expanded ? "Collapse" : "Expand"}
            >
              {expanded ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-[var(--muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--foreground)]"
              aria-label="Back to chat"
              title="Back to chat"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </>
  );

  if (expanded) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop)] p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="flex h-[min(95vh,960px)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] shadow-2xl"
          >
            {shell}
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  return <div className="flex h-full min-h-0 w-full flex-1 flex-col">{shell}</div>;
}
