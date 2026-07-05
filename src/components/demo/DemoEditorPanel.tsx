"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface DemoEditorPanelProps {
  children: React.ReactNode;
  className?: string;
  wide?: boolean;
}

/** Docked onboarding card anchored to the main editor column */
export function DemoEditorPanel({
  children,
  className,
  wide = false,
}: DemoEditorPanelProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ type: "spring", damping: 28, stiffness: 320 }}
      className={cn(
        "pointer-events-auto absolute inset-x-4 bottom-4 z-30",
        wide ? "max-w-2xl" : "max-w-xl",
        "mx-auto",
        className
      )}
    >
      {children}
    </motion.div>
  );
}
