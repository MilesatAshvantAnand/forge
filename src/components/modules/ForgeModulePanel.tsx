"use client";

import { useEffect, useState } from "react";
import type { ForgeModuleId } from "@/lib/modules/types";
import type { ProjectMetadata } from "@/lib/types";
import type { ResourceItem } from "@/components/project/ProjectSidebar";
import { OnshapeCadModule } from "./OnshapeCadModule";
import { EngineeringNotebookModule } from "./EngineeringNotebookModule";
import { MatchIntelligenceModule } from "./MatchIntelligenceModule";
import { AutonomousPlannerModule } from "./AutonomousPlannerModule";
import { BuildLogModule } from "./BuildLogModule";

interface ForgeModulePanelProps {
  moduleId: ForgeModuleId;
  projectId: string;
  projectName: string;
  metadata: ProjectMetadata | null;
  resources: ResourceItem[];
  recording: boolean;
  onRecordingChange: (recording: boolean) => void;
  onClose: () => void;
  onSelectFile?: (path: string) => void;
  onResourceUploaded?: () => void;
}

export function ForgeModulePanel({
  moduleId,
  projectId,
  projectName,
  metadata,
  resources,
  recording,
  onRecordingChange,
  onClose,
  onSelectFile,
  onResourceUploaded,
}: ForgeModulePanelProps) {
  const [expanded, setExpanded] = useState(false);
  const isDemoProject = projectName.includes("Demo");

  useEffect(() => {
    setExpanded(false);
  }, [moduleId]);

  const shell = {
    expanded,
    onToggleExpand: () => setExpanded((e) => !e),
  };

  switch (moduleId) {
    case "onshape-cad":
      return (
        <OnshapeCadModule
          projectId={projectId}
          metadata={metadata}
          resources={resources}
          isDemoProject={isDemoProject}
          onClose={onClose}
          onSelectFile={onSelectFile}
          onResourceUploaded={onResourceUploaded}
          {...shell}
        />
      );
    case "engineering-notebook":
      return (
        <EngineeringNotebookModule
          projectId={projectId}
          resources={resources}
          onClose={onClose}
          onResourceUploaded={onResourceUploaded}
          {...shell}
        />
      );
    case "build-log":
      return (
        <BuildLogModule
          projectId={projectId}
          recording={recording}
          onRecordingChange={onRecordingChange}
          onClose={onClose}
          {...shell}
        />
      );
    case "match-intelligence":
      return (
        <MatchIntelligenceModule
          projectId={projectId}
          resources={resources}
          onClose={onClose}
          onResourceUploaded={onResourceUploaded}
          {...shell}
        />
      );
    case "autonomous-planner":
      return (
        <AutonomousPlannerModule
          projectId={projectId}
          metadata={metadata}
          onClose={onClose}
          onSelectFile={onSelectFile}
          {...shell}
        />
      );
  }
}
