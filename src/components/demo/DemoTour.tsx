"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Rocket, Sparkles, Check } from "lucide-react";
import { DemoEditorPanel } from "@/components/demo/DemoEditorPanel";
import {
  DEMO_PROJECT_STATS,
  FUTURE_MODULES,
  VISION_STEPS,
} from "@/lib/demo/constants";

export type TourStep =
  | "project-overview"
  | "chat-welcome"
  | "explain-robot"
  | "differentiator"
  | "intake-jam"
  | "cad-panel"
  | "vision";

interface DemoTourProps {
  step: TourStep;
  docked?: boolean;
  onAdvance: () => void;
  onSkip: () => void;
  onEngage: () => void;
}

function TourCard({
  children,
  className = "",
  compact = false,
}: {
  children: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8 }}
      className={`glass glow-accent w-full rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] shadow-2xl ${
        compact ? "p-5" : "max-w-2xl rounded-3xl p-8"
      } ${className}`}
    >
      {children}
    </motion.div>
  );
}

function OverviewContent({
  compact,
  onContinue,
}: {
  compact?: boolean;
  onContinue: () => void;
}) {
  return (
    <>
      <p
        className={`font-bold uppercase tracking-wider text-[var(--accent)] ${
          compact ? "text-xs" : "text-sm"
        }`}
      >
        Demo project · Indexed
      </p>
      <h3 className={`mt-2 font-bold ${compact ? "text-lg" : "text-2xl"}`}>
        Sample competition robot
      </h3>
      <ul className={`space-y-2 font-semibold ${compact ? "mt-4 text-sm" : "mt-6 text-lg"}`}>
        <li className="flex items-center gap-2">
          <Check className="h-4 w-4 shrink-0 text-[var(--green)]" />
          {DEMO_PROJECT_STATS.fileCount} source files
        </li>
        <li className="flex items-center gap-2">
          <Check className="h-4 w-4 shrink-0 text-[var(--green)]" />
          {DEMO_PROJECT_STATS.subsystems} mechanical subsystems
        </li>
        {DEMO_PROJECT_STATS.attachedResources.map((r) => (
          <li key={r} className="flex items-center gap-2">
            <Check className="h-4 w-4 shrink-0 text-[var(--green)]" />
            {r}
          </li>
        ))}
      </ul>
      <button
        onClick={onContinue}
        className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] font-bold text-black transition-opacity hover:opacity-90 ${
          compact ? "py-2.5 text-sm" : "py-3.5 text-base"
        }`}
      >
        Continue
        <ArrowRight className="h-4 w-4" />
      </button>
    </>
  );
}

function DifferentiatorContent({
  compact,
  onContinue,
}: {
  compact?: boolean;
  onContinue: () => void;
}) {
  return (
    <>
      <Sparkles className={`text-[var(--accent)] ${compact ? "h-6 w-6" : "h-8 w-8"}`} />
      <p
        className={`mt-3 font-bold leading-snug ${
          compact ? "text-base" : "text-2xl"
        }`}
      >
        Forge understands your entire project before you ask a question.
      </p>
      <button
        onClick={onContinue}
        className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] font-bold text-black ${
          compact ? "py-2.5 text-sm" : "py-3.5 text-base"
        }`}
      >
        Continue
        <ArrowRight className="h-4 w-4" />
      </button>
    </>
  );
}

function CadPanelContent({
  compact,
  onContinue,
}: {
  compact?: boolean;
  onContinue: () => void;
}) {
  return (
    <>
      <p className="text-xs font-bold uppercase tracking-wide text-[var(--blue)]">
        CAD ↔ Code
      </p>
      <p className={`mt-2 font-bold leading-snug ${compact ? "text-base" : "text-xl"}`}>
        Mechanical design, code, and notebook — one workspace.
      </p>
      <button
        onClick={onContinue}
        className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] font-bold text-black ${
          compact ? "py-2.5 text-sm" : "py-3.5 text-base"
        }`}
      >
        Continue
        <ArrowRight className="h-4 w-4" />
      </button>
    </>
  );
}

function VisionContent({
  compact,
  onSkip,
}: {
  compact?: boolean;
  onSkip: () => void;
}) {
  return (
    <div className={compact ? "max-h-[60vh] overflow-y-auto" : ""}>
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
        The vision
      </p>
      <h2
        className={`mt-2 font-bold tracking-tight ${
          compact ? "text-lg" : "text-3xl"
        }`}
      >
        One assistant. One workspace. Every engineering artifact.
      </h2>

      <div className={`space-y-3 ${compact ? "mt-4" : "mt-10"}`}>
        {VISION_STEPS.map((v, i) => (
          <div key={i} className="flex gap-3">
            {v.label ? (
              <span className="w-12 shrink-0 text-xs font-bold text-[var(--accent)]">
                {v.label}
              </span>
            ) : (
              <span className="w-12 shrink-0" />
            )}
            <p className="text-sm font-medium text-[var(--muted)]">{v.text}</p>
          </div>
        ))}
      </div>

      <div className={`grid grid-cols-2 gap-2 ${compact ? "mt-4" : "mt-8"}`}>
        {FUTURE_MODULES.map((m) => (
          <div key={m.name} className="glass rounded-lg px-3 py-2 text-xs font-semibold">
            {m.status === "live" ? (
              <span className="flex items-center gap-1 text-[var(--green)]">
                <Check className="h-3 w-3" />
                {m.name}
              </span>
            ) : (
              <span className="text-[var(--muted)]">{m.name}</span>
            )}
          </div>
        ))}
      </div>

      <div className={`flex flex-col gap-2 sm:flex-row ${compact ? "mt-4" : "mt-8"}`}>
        <button
          onClick={onSkip}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] py-2.5 text-sm font-bold text-black"
        >
          <Rocket className="h-4 w-4" />
          Start exploring
        </button>
        <Link
          href="/"
          className="flex flex-1 items-center justify-center rounded-xl border border-[var(--border)] py-2.5 text-sm font-semibold text-[var(--muted)] transition-colors hover:border-[var(--border-strong)]"
        >
          Upload your project
        </Link>
      </div>
    </div>
  );
}

export function DemoTour({
  step,
  docked = false,
  onAdvance,
  onSkip,
  onEngage,
}: DemoTourProps) {
  const advance = () => {
    onEngage();
    onAdvance();
  };

  if (docked) {
    return (
      <AnimatePresence mode="wait">
        {step === "differentiator" && (
          <DemoEditorPanel key="diff" wide>
            <TourCard compact>
              <DifferentiatorContent compact onContinue={advance} />
            </TourCard>
          </DemoEditorPanel>
        )}
        {step === "cad-panel" && (
          <DemoEditorPanel key="cad">
            <TourCard compact>
              <CadPanelContent compact onContinue={advance} />
            </TourCard>
          </DemoEditorPanel>
        )}
        {step === "intake-jam" && (
          <DemoEditorPanel key="intake">
            <TourCard compact className="border-[var(--accent)]">
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--accent)]">
                Capstone · Click prompt below
              </p>
              <p className="mt-2 text-base font-bold">
                &ldquo;Why does the collection mechanism fail under load?&rdquo;
              </p>
            </TourCard>
          </DemoEditorPanel>
        )}
        {step === "chat-welcome" && (
          <DemoEditorPanel key="welcome">
            <TourCard compact>
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--accent)]">
                Ask anything
              </p>
              <p className="mt-2 text-sm font-semibold">
                Try a suggested prompt — Forge already knows this project.
              </p>
              <button
                onClick={advance}
                className="mt-3 text-xs font-semibold text-[var(--accent)] underline"
              >
                Got it
              </button>
            </TourCard>
          </DemoEditorPanel>
        )}
        {step === "explain-robot" && (
          <DemoEditorPanel key="explain">
            <TourCard compact className="border-[var(--accent)]">
              <p className="text-xs font-bold text-[var(--accent)]">
                Click the highlighted prompt below
              </p>
              <p className="mt-1 text-sm font-bold">&ldquo;Explain this project architecture&rdquo;</p>
            </TourCard>
          </DemoEditorPanel>
        )}
        {step === "vision" && (
          <DemoEditorPanel key="vision" wide className="bottom-4 top-16">
            <TourCard compact>
              <VisionContent compact onSkip={onSkip} />
            </TourCard>
          </DemoEditorPanel>
        )}
      </AnimatePresence>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]">
      <AnimatePresence mode="wait">
        {step === "project-overview" && (
          <motion.div
            key="overview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-auto flex h-full items-center justify-center bg-[var(--backdrop)] px-6 backdrop-blur-sm"
          >
            <TourCard>
              <OverviewContent onContinue={advance} />
            </TourCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export const DEMO_PROMPTS = [
  "Explain this project architecture",
  "Why does the collection mechanism fail under load?",
  "Show autonomous routines",
  "Find control parameters in the codebase",
  "Generate documentation from project scope",
];

export const DEMO_CANNED: Record<string, string> = {
  "explain this robot": "explain",
  "why does the intake jam": "intake",
};
