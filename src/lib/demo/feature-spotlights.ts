import type { ForgeModuleId } from "@/lib/modules/types";

export type SpotlightId =
  | "coding-assistant"
  | "onshape-cad"
  | "engineering-notebook"
  | "build-log"
  | "autonomous-planner"
  | "match-intelligence";

export interface FeatureSpotlightDef {
  id: SpotlightId;
  title: string;
  subtitle: string;
  body: string;
  bullets: string[];
  tryLabel: string;
  moduleId?: ForgeModuleId;
  action?: "chat" | "editor";
  prompt?: string;
}

export const FEATURE_SPOTLIGHTS: FeatureSpotlightDef[] = [
  {
    id: "coding-assistant",
    title: "Coding Assistant",
    subtitle: "Context-aware engineering copilot",
    body: "Forge indexes your repo first — every answer cites real source files.",
    bullets: ["Click a citation to open it in the Editor"],
    tryLabel: "Try: Explain architecture",
    action: "chat",
    prompt: "Explain this project architecture",
  },
  {
    id: "onshape-cad",
    title: "Onshape CAD",
    subtitle: "Mechanical ↔ software traceability",
    body: "Link assemblies to code subsystems in one workspace.",
    bullets: ["Connect Onshape or upload STEP/STL exports"],
    tryLabel: "Open Onshape CAD",
    moduleId: "onshape-cad",
  },
  {
    id: "engineering-notebook",
    title: "Engineering Notebook",
    subtitle: "Scope drives documentation & codegen",
    body: "Design docs and rules PDFs indexed alongside code.",
    bullets: ["Scope tab drives documentation and codegen"],
    tryLabel: "Open Engineering Notebook",
    moduleId: "engineering-notebook",
  },
  {
    id: "build-log",
    title: "Build Log",
    subtitle: "Hands-free build session capture",
    body: "Record at the workbench — decisions flow into log.md.",
    bullets: ["Toggle recording while you build"],
    tryLabel: "Open Build Log",
    moduleId: "build-log",
  },
  {
    id: "autonomous-planner",
    title: "Autonomous Planner",
    subtitle: "Path planning + parts catalog",
    body: "Import path files and search the parts catalog.",
    bullets: ["Path.jerryio import + Exa parts search"],
    tryLabel: "Open Autonomous Planner",
    moduleId: "autonomous-planner",
  },
  {
    id: "match-intelligence",
    title: "Match Intelligence",
    subtitle: "Postmortem from video & telemetry",
    body: "Replay footage linked to code, CAD, and notebook.",
    bullets: ["Upload match video for timestamped analysis"],
    tryLabel: "Open Match Intelligence",
    moduleId: "match-intelligence",
  },
];
