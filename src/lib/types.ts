export type ProjectStatus = "uploading" | "indexing" | "ready" | "error";

export interface DetectedLibrary {
  name: string;
  confidence: "high" | "medium";
  evidence: string[];
}

export interface Subsystem {
  name: string;
  files: string[];
}

export interface ConstantEntry {
  name: string;
  value: string;
  file: string;
  line: number;
}

export interface PidEntry {
  name: string;
  values: string;
  file: string;
  line: number;
}

export interface AutonRoutine {
  name: string;
  file: string;
  line: number;
}

export interface SensorConfig {
  type: string;
  file: string;
  line: number;
  snippet: string;
}

export interface GraphNode {
  id: string;
  type: "project" | "subsystem" | "file" | "library";
  label: string;
  file?: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileTreeNode[];
}

export interface ProjectMetadata {
  libraries: DetectedLibrary[];
  subsystems: Subsystem[];
  constants: ConstantEntry[];
  pidControllers: PidEntry[];
  autonRoutines: AutonRoutine[];
  sensors: SensorConfig[];
  capabilities: string[];
  fileGraph: { nodes: GraphNode[]; edges: GraphEdge[] };
  fileTree: FileTreeNode[];
  totalFiles: number;
  languages: Record<string, number>;
  /** Set when the project was imported from GitHub (owner/repo) */
  githubRepo?: string;
  githubRef?: string;
}

export interface IndexProgress {
  stage: string;
  progress: number;
  message: string;
}

export interface ChatCitation {
  file: string;
  startLine?: number;
  endLine?: number;
  source: "project" | "web";
  url?: string;
  title?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: ChatCitation[];
  createdAt: number;
}

export interface ProjectSummary {
  id: string;
  name: string;
  status: ProjectStatus;
  source: string;
  summary: string | null;
  metadata: ProjectMetadata | null;
  indexProgress: IndexProgress | null;
  createdAt: number;
  updatedAt: number;
}
