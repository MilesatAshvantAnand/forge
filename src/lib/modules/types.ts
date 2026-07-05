import { Box, BookOpen, ScrollText, Film, Route, type LucideIcon } from "lucide-react";

export type ForgeModuleId =
  | "onshape-cad"
  | "engineering-notebook"
  | "match-intelligence"
  | "autonomous-planner"
  | "build-log";

export interface ForgeModuleDef {
  id: ForgeModuleId;
  label: string;
  description: string;
  accent: string;
  icon: LucideIcon;
}

export const FORGE_MODULES: ForgeModuleDef[] = [
  {
    id: "onshape-cad",
    label: "Onshape CAD",
    description: "Assemblies, parts, and mates linked to code",
    accent: "var(--blue)",
    icon: Box,
  },
  {
    id: "engineering-notebook",
    label: "Engineering Notebook",
    description: "Project scope, notebooks, and design docs",
    accent: "var(--purple)",
    icon: BookOpen,
  },
  {
    id: "build-log",
    label: "Build Log",
    description: "Record build sessions into log.md automatically",
    accent: "var(--green)",
    icon: ScrollText,
  },
  {
    id: "match-intelligence",
    label: "Match Intelligence",
    description: "Match footage, telemetry, and failure investigation",
    accent: "var(--red)",
    icon: Film,
  },
  {
    id: "autonomous-planner",
    label: "Autonomous Planner",
    description: "Path.jerryio import, VEX parts lookup, routine design",
    accent: "var(--accent)",
    icon: Route,
  },
];
