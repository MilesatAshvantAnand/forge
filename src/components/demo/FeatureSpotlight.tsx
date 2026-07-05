"use client";

import { motion } from "framer-motion";
import { ArrowRight, Sparkles, X } from "lucide-react";
import { DemoEditorPanel } from "@/components/demo/DemoEditorPanel";
import {
  FEATURE_SPOTLIGHTS,
  type FeatureSpotlightDef,
  type SpotlightId,
} from "@/lib/demo/feature-spotlights";
import type { ForgeModuleId } from "@/lib/modules/types";

interface FeatureSpotlightProps {
  spotlightId: SpotlightId;
  step: number;
  total: number;
  scriptStep: number;
  scriptTotal: number;
  docked?: boolean;
  onTry: (spotlight: FeatureSpotlightDef) => void;
  onNext: () => void;
  onSkip: () => void;
  onEngage: () => void;
}

function SpotlightCard({
  spotlight,
  step,
  total,
  scriptStep,
  scriptTotal,
  compact,
  onTry,
  onNext,
  onSkip,
  onEngage,
}: {
  spotlight: FeatureSpotlightDef;
  step: number;
  total: number;
  scriptStep: number;
  scriptTotal: number;
  compact?: boolean;
  onTry: (spotlight: FeatureSpotlightDef) => void;
  onNext: () => void;
  onSkip: () => void;
  onEngage: () => void;
}) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] shadow-2xl ${
        compact ? "rounded-xl" : "rounded-3xl"
      }`}
    >
      <div
        className={`border-b border-[var(--border)] bg-[var(--surface-raised)] ${
          compact ? "px-5 py-4" : "px-8 py-6"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`flex items-center justify-center rounded-xl bg-[var(--accent-dim)] ${
                compact ? "h-9 w-9" : "h-11 w-11"
              }`}
            >
              <Sparkles
                className={`text-[var(--accent)] ${compact ? "h-4 w-4" : "h-5 w-5"}`}
              />
            </div>
            <div>
              <p
                className={`font-semibold uppercase tracking-wide text-[var(--accent)] ${
                  compact ? "text-xs" : "text-sm"
                }`}
              >
                {spotlight.subtitle}
              </p>
              <h2
                className={`font-bold tracking-tight text-[var(--foreground)] ${
                  compact ? "text-lg" : "text-2xl"
                }`}
              >
                {spotlight.title}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onSkip}
            className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--foreground)]"
            aria-label="Skip tour"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {!compact && (
          <>
            <div className="mt-4 flex gap-1.5">
              {FEATURE_SPOTLIGHTS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    i <= step ? "bg-[var(--accent)]" : "bg-[var(--elevated)]"
                  }`}
                />
              ))}
            </div>
            <p className="mt-3 text-xs font-medium text-[var(--muted)]">
              Step {scriptStep + 1}/{scriptTotal}
            </p>
          </>
        )}
      </div>

      <div className={compact ? "px-5 py-4" : "px-8 py-8"}>
        <p
          className={`font-bold leading-snug text-[var(--foreground)] ${
            compact ? "text-base" : "text-xl"
          }`}
        >
          {spotlight.body}
        </p>
        {spotlight.bullets[0] && (
          <p
            className={`mt-2 font-medium text-[var(--foreground-secondary)] ${
              compact ? "text-sm" : "text-base"
            }`}
          >
            {spotlight.bullets[0]}
          </p>
        )}
      </div>

      <div
        className={`flex gap-2 border-t border-[var(--border)] bg-[var(--surface-raised)] sm:flex-row ${
          compact ? "flex-col px-5 py-3" : "flex-col gap-3 px-8 py-5"
        }`}
      >
        <button
          type="button"
          onClick={() => {
            onEngage();
            onTry(spotlight);
          }}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] font-bold text-black transition-opacity hover:opacity-90 ${
            compact ? "py-2.5 text-sm" : "py-3.5 text-base"
          }`}
        >
          {spotlight.tryLabel}
          <ArrowRight className={compact ? "h-4 w-4" : "h-5 w-5"} />
        </button>
        <button
          type="button"
          onClick={() => {
            onEngage();
            onNext();
          }}
          className={`flex flex-1 items-center justify-center rounded-xl border border-[var(--border)] font-semibold text-[var(--muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--foreground)] ${
            compact ? "py-2.5 text-sm" : "py-3.5 text-base"
          }`}
        >
          {step < total - 1 ? "Next" : "Continue demo"}
        </button>
      </div>
    </div>
  );
}

export function FeatureSpotlight({
  spotlightId,
  step,
  total,
  scriptStep,
  scriptTotal,
  docked = false,
  onTry,
  onNext,
  onSkip,
  onEngage,
}: FeatureSpotlightProps) {
  const spotlight = FEATURE_SPOTLIGHTS.find((s) => s.id === spotlightId);
  if (!spotlight) return null;

  if (docked) {
    return (
      <DemoEditorPanel wide>
        <SpotlightCard
          spotlight={spotlight}
          step={step}
          total={total}
          scriptStep={scriptStep}
          scriptTotal={scriptTotal}
          compact
          onTry={onTry}
          onNext={onNext}
          onSkip={onSkip}
          onEngage={onEngage}
        />
      </DemoEditorPanel>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center bg-[var(--backdrop)] p-6 backdrop-blur-sm">
      <motion.div
        key={spotlightId}
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12 }}
        className="pointer-events-auto w-full max-w-2xl"
      >
        <SpotlightCard
          spotlight={spotlight}
          step={step}
          total={total}
          scriptStep={scriptStep}
          scriptTotal={scriptTotal}
          onTry={onTry}
          onNext={onNext}
          onSkip={onSkip}
          onEngage={onEngage}
        />
      </motion.div>
    </div>
  );
}

export { FEATURE_SPOTLIGHTS, type SpotlightId, type FeatureSpotlightDef };

export function spotlightToModule(id: SpotlightId): ForgeModuleId | null {
  return FEATURE_SPOTLIGHTS.find((s) => s.id === id)?.moduleId ?? null;
}
