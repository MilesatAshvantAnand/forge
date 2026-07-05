"use client";

import { motion } from "framer-motion";
import { Box, FileCode, BookOpen, Cog, X } from "lucide-react";

const CHAIN = [
  { icon: Box, label: "Roller Assembly", sub: "Onshape CAD", color: "var(--blue)" },
  { icon: Cog, label: "Intake Motor", sub: "Port 7 · 200 RPM", color: "var(--accent)" },
  { icon: FileCode, label: "intake.cpp", sub: "Anti-jam logic", color: "var(--green)" },
  { icon: BookOpen, label: "Engineering Notebook", sub: "Compression notes", color: "var(--muted)" },
];

export function CadPanel({ onClose }: { onClose: () => void }) {
  return (
    <motion.aside
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 320 }}
      className="fixed right-0 top-0 z-40 flex h-full w-full max-w-md flex-col border-l border-[var(--border)] bg-[var(--surface)] shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
            CAD Intelligence
          </p>
          <h2 className="text-sm font-semibold">Intake Assembly</h2>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--foreground)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-0 px-8 py-10">
        <div className="mb-8 flex h-40 w-full items-center justify-center rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--inset)]">
          <div className="text-center">
            <Box className="mx-auto h-10 w-10 text-[var(--blue)] opacity-80" />
            <p className="mt-2 text-xs text-[var(--muted)]">3D preview · Onshape integration</p>
          </div>
        </div>

        <p className="mb-6 text-center text-xs text-[var(--muted)]">
          Forge links mechanical design to code and documentation
        </p>

        {CHAIN.map((item, i) => (
          <div key={item.label} className="flex flex-col items-center">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.15 }}
              className="glass w-full rounded-xl px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{ background: `color-mix(in srgb, ${item.color} 15%, transparent)` }}
                >
                  <item.icon className="h-4 w-4" style={{ color: item.color }} />
                </div>
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-[var(--muted)]">{item.sub}</p>
                </div>
              </div>
            </motion.div>
            {i < CHAIN.length - 1 && (
              <motion.div
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ delay: 0.35 + i * 0.15 }}
                className="my-1 h-5 w-px bg-gradient-to-b from-[var(--accent)] to-transparent opacity-50"
              />
            )}
          </div>
        ))}
      </div>
    </motion.aside>
  );
}
