"use client";

import { motion } from "framer-motion";
import { Flame } from "lucide-react";
import type { IndexProgress } from "@/lib/types";
import { KnowledgeGraphAnimation } from "@/components/demo/KnowledgeGraphAnimation";

export function IndexingOverlay({ progress }: { progress: IndexProgress | null }) {
  const pct = progress?.progress ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--background)] px-6">
      <div className="w-full max-w-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center justify-center gap-2"
        >
          <Flame className="h-6 w-6 animate-pulse-soft text-[var(--accent)]" />
          <span className="text-lg font-semibold tracking-tight">
            Building project knowledge
          </span>
        </motion.div>

        <p className="mt-2 text-center text-xs text-[var(--muted)]">
          Forge reads code, subsystems, libraries, and autonomous routines — not
          just uploading files
        </p>

        <div className="mt-10">
          <KnowledgeGraphAnimation progress={progress} />
        </div>

        <div className="mt-8 h-1 overflow-hidden rounded-full bg-[var(--elevated)]">
          <motion.div
            className="h-full rounded-full bg-[var(--accent)]"
            animate={{ width: `${pct}%` }}
            transition={{ ease: "easeOut" }}
          />
        </div>
      </div>
    </div>
  );
}
