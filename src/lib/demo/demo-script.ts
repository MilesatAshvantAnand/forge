import type { TourStep } from "@/components/demo/DemoTour";
import type { SpotlightId } from "@/lib/demo/feature-spotlights";

export type DemoBeat =
  | { type: "spotlight"; id: SpotlightId; label: string }
  | { type: "tour"; step: TourStep; label: string }
  | { type: "action"; action: "open-editor"; file: string; label: string };

/** Ordered judge demo script (~12 beats, ~5 min with Next skips) */
export const DEMO_SCRIPT: DemoBeat[] = [
  { type: "tour", step: "project-overview", label: "Project overview" },
  { type: "spotlight", id: "coding-assistant", label: "Coding Assistant" },
  { type: "tour", step: "differentiator", label: "Why context matters" },
  { type: "spotlight", id: "onshape-cad", label: "Onshape CAD" },
  { type: "spotlight", id: "engineering-notebook", label: "Engineering Notebook" },
  { type: "spotlight", id: "build-log", label: "Build Log" },
  { type: "spotlight", id: "autonomous-planner", label: "Autonomous Planner" },
  { type: "spotlight", id: "match-intelligence", label: "Match Intelligence" },
  { type: "tour", step: "intake-jam", label: "Capstone question" },
  { type: "tour", step: "cad-panel", label: "CAD ↔ code link" },
  {
    type: "action",
    action: "open-editor",
    file: "src/intake.cpp",
    label: "Open in Editor",
  },
  { type: "tour", step: "vision", label: "Vision close" },
];

export const DEMO_CAPSTONE_PROMPT =
  "Why does the collection mechanism fail under load?";

export const DEMO_EXPLAIN_PROMPT = "Explain this project architecture";

export function getDemoBeat(index: number): DemoBeat | null {
  if (index < 0 || index >= DEMO_SCRIPT.length) return null;
  return DEMO_SCRIPT[index];
}

export function isSpotlightBeat(
  beat: DemoBeat
): beat is Extract<DemoBeat, { type: "spotlight" }> {
  return beat.type === "spotlight";
}

export function isTourBeat(
  beat: DemoBeat
): beat is Extract<DemoBeat, { type: "tour" }> {
  return beat.type === "tour";
}

export function isActionBeat(
  beat: DemoBeat
): beat is Extract<DemoBeat, { type: "action" }> {
  return beat.type === "action";
}
