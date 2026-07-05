"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { TourStep } from "@/components/demo/DemoTour";
import type { FeatureSpotlightDef } from "@/lib/demo/feature-spotlights";
import {
  DEMO_SCRIPT,
  getDemoBeat,
  isSpotlightBeat,
  isTourBeat,
  DEMO_CAPSTONE_PROMPT,
  DEMO_EXPLAIN_PROMPT,
} from "@/lib/demo/demo-script";
import type { ForgeModuleId } from "@/lib/modules/types";
import type { CenterView } from "@/components/project/MainPanel";

interface UseDemoOrchestratorOptions {
  projectId: string;
  demoActive: boolean;
  onSelectFile: (path: string) => void;
  onCenterViewChange: (view: CenterView) => void;
  onOpenModule: (id: ForgeModuleId | null) => void;
  onPendingPrompt: (prompt: string | null) => void;
}

export function useDemoOrchestrator({
  projectId,
  demoActive,
  onSelectFile,
  onCenterViewChange,
  onOpenModule,
  onPendingPrompt,
}: UseDemoOrchestratorOptions) {
  const router = useRouter();
  const [beatIndex, setBeatIndex] = useState(demoActive ? 0 : -1);

  const currentBeat = beatIndex >= 0 ? getDemoBeat(beatIndex) : null;

  const endDemo = useCallback(() => {
    setBeatIndex(-1);
    router.replace(`/projects/${projectId}`);
  }, [projectId, router]);

  const advanceBeat = useCallback(() => {
    setBeatIndex((i) => {
      if (i < 0) return i;
      const next = i + 1;
      if (next >= DEMO_SCRIPT.length) {
        router.replace(`/projects/${projectId}`);
        return -1;
      }
      return next;
    });
  }, [projectId, router]);

  const applyBeatSideEffects = useCallback(
    (index: number) => {
      const beat = getDemoBeat(index);
      if (!beat || beat.type !== "action") return;
      if (beat.action === "open-editor") {
        onSelectFile(beat.file);
        onCenterViewChange("editor");
      }
    },
    [onSelectFile, onCenterViewChange]
  );

  const advanceBeatWithEffects = useCallback(() => {
    setBeatIndex((i) => {
      if (i < 0) return i;
      const next = i + 1;
      if (next >= DEMO_SCRIPT.length) {
        router.replace(`/projects/${projectId}`);
        return -1;
      }
      applyBeatSideEffects(next);
      return next;
    });
  }, [projectId, router, applyBeatSideEffects]);

  const handleSpotlightTry = useCallback(
    (spotlight: FeatureSpotlightDef) => {
      if (spotlight.moduleId) onOpenModule(spotlight.moduleId);
      if (spotlight.action === "chat") onCenterViewChange("chat");
      if (spotlight.action === "editor") onCenterViewChange("editor");
      if (spotlight.prompt) onPendingPrompt(spotlight.prompt);
      advanceBeatWithEffects();
    },
    [onOpenModule, onCenterViewChange, onPendingPrompt, advanceBeatWithEffects]
  );

  const handleSpotlightNext = useCallback(() => {
    advanceBeatWithEffects();
  }, [advanceBeatWithEffects]);

  const handleTourAdvance = useCallback(() => {
    advanceBeatWithEffects();
  }, [advanceBeatWithEffects]);

  const handleDemoMessage = useCallback(
    (prompt: string): boolean => {
      if (beatIndex < 0) return false;
      const beat = getDemoBeat(beatIndex);
      const key = prompt.toLowerCase().replace(/\?/g, "").trim();
      if (
        beat &&
        isTourBeat(beat) &&
        beat.step === "intake-jam" &&
        (key.includes("collection mechanism") || key.includes("intake jam"))
      ) {
        advanceBeatWithEffects();
        return true;
      }
      return false;
    },
    [beatIndex, advanceBeatWithEffects]
  );

  const tourStep: TourStep | null = useMemo(() => {
    if (!currentBeat || !isTourBeat(currentBeat)) return null;
    return currentBeat.step;
  }, [currentBeat]);

  const spotlightId = useMemo(() => {
    if (!currentBeat || !isSpotlightBeat(currentBeat)) return null;
    return currentBeat.id;
  }, [currentBeat]);

  const highlightPrompt = useMemo(() => {
    if (tourStep === "intake-jam") return DEMO_CAPSTONE_PROMPT;
    if (tourStep === "explain-robot") return DEMO_EXPLAIN_PROMPT;
    return null;
  }, [tourStep]);

  const contextHighlight = tourStep === "differentiator";

  const cadPanelOpen = tourStep === "cad-panel";

  const demoModeActive = beatIndex >= 0;

  const progressLabel = currentBeat?.label ?? "";

  return {
    demoModeActive,
    beatIndex,
    currentBeat,
    tourStep,
    spotlightId,
    highlightPrompt,
    contextHighlight,
    cadPanelOpen,
    progressLabel,
    totalBeats: DEMO_SCRIPT.length,
    endDemo,
    advanceBeat,
    handleSpotlightTry,
    handleSpotlightNext,
    handleTourAdvance,
    handleDemoMessage,
  };
}
