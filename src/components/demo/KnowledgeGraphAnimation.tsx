"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { KNOWLEDGE_GRAPH_NODES } from "@/lib/demo/constants";
import type { IndexProgress } from "@/lib/types";
import { cn } from "@/lib/utils";

interface KnowledgeGraphAnimationProps {
  progress: IndexProgress | null;
  /** Demo mode animates nodes on a timer instead of real progress */
  demoMode?: boolean;
}

export function KnowledgeGraphAnimation({
  progress,
  demoMode = false,
}: KnowledgeGraphAnimationProps) {
  const pct = progress?.progress ?? 0;
  const [demoStep, setDemoStep] = useState(1);

  useEffect(() => {
    if (!demoMode) return;
    const timer = setInterval(() => {
      setDemoStep((s) => (s >= KNOWLEDGE_GRAPH_NODES.length ? s : s + 1));
    }, 900);
    return () => clearInterval(timer);
  }, [demoMode]);

  const activeCount = demoMode
    ? demoStep
    : Math.ceil((pct / 100) * KNOWLEDGE_GRAPH_NODES.length);

  return (
    <div className="flex flex-col items-center">
      <div className="flex flex-col items-center gap-0">
        {KNOWLEDGE_GRAPH_NODES.map((node, i) => {
          const active = i < activeCount;
          const current = i === activeCount - 1;
          return (
            <div key={node.id} className="flex flex-col items-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{
                  opacity: active ? 1 : 0.25,
                  scale: current ? 1.05 : 1,
                }}
                transition={{ delay: demoMode ? i * 0.15 : 0 }}
                className={cn(
                  "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                  active
                    ? current
                      ? "border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)]"
                      : "border-[var(--border-strong)] bg-[var(--elevated)] text-[var(--foreground)]"
                    : "border-[var(--border)] text-[var(--muted)]"
                )}
              >
                <span className="flex items-center gap-2">
                  {active && !current && (
                    <Check className="h-3.5 w-3.5 text-[var(--green,#34d399)]" />
                  )}
                  {node.label}
                </span>
              </motion.div>
              {i < KNOWLEDGE_GRAPH_NODES.length - 1 && (
                <motion.div
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: active ? 1 : 0.3 }}
                  className="h-6 w-px origin-top bg-gradient-to-b from-[var(--accent)] to-transparent opacity-60"
                />
              )}
            </div>
          );
        })}
      </div>
      {progress?.message && !demoMode && (
        <p className="mt-8 text-center text-xs text-[var(--muted)]">
          {progress.message}
        </p>
      )}
    </div>
  );
}
