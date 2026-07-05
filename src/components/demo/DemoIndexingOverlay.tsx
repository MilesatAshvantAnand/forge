"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Check } from "lucide-react";
import type { IndexProgress } from "@/lib/types";
import { DEMO_DISCOVERIES } from "@/lib/demo/constants";
import { KnowledgeGraphAnimation } from "./KnowledgeGraphAnimation";

export function DemoIndexingOverlay({
  progress,
}: {
  progress: IndexProgress | null;
}) {
  const [discovered, setDiscovered] = useState<string[]>([]);

  useEffect(() => {
    let i = 0;
    const timer = setInterval(() => {
      if (i < DEMO_DISCOVERIES.length) {
        setDiscovered((prev) => [...prev, DEMO_DISCOVERIES[i]]);
        i++;
      } else {
        clearInterval(timer);
      }
    }, 700);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--background)] px-6">
      <div className="grid w-full max-w-4xl gap-12 lg:grid-cols-2 lg:items-center">
        <div>
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2"
          >
            <Flame className="h-5 w-5 animate-pulse-soft text-[var(--accent)]" />
            <span className="text-sm font-semibold">Building project knowledge</span>
          </motion.div>
          <p className="mt-2 text-xs text-[var(--muted)]">
            Forge reads your entire project — not just individual files
          </p>

          <div className="mt-8 flex flex-col gap-2">
            <AnimatePresence>
              {discovered.map((d) => (
                <motion.div
                  key={d}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2 text-sm"
                >
                  <Check className="h-4 w-4 text-[var(--green)]" />
                  <span>{d}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        <KnowledgeGraphAnimation progress={progress} demoMode />
      </div>

      {progress?.message && (
        <p className="absolute bottom-10 text-xs text-[var(--muted)]">
          {progress.message}
        </p>
      )}
    </div>
  );
}
