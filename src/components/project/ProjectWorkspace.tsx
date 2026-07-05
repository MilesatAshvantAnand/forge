"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { AlertCircle } from "lucide-react";
import type { IndexProgress, ProjectMetadata, ProjectStatus } from "@/lib/types";
import { IndexingOverlay } from "@/components/workspace/IndexingOverlay";
import { DemoIndexingOverlay } from "@/components/demo/DemoIndexingOverlay";
import {
  ProjectSidebar,
  type ConversationItem,
  type ResourceItem,
} from "./ProjectSidebar";
import { MainPanel, type CenterView } from "./MainPanel";
import { ContextPanel } from "./ContextPanel";
import { DemoTour, DEMO_PROMPTS } from "@/components/demo/DemoTour";
import { FeatureSpotlight, FEATURE_SPOTLIGHTS } from "@/components/demo/FeatureSpotlight";
import { DemoProgressPill } from "@/components/demo/DemoProgressPill";
import { useDemoOrchestrator } from "@/components/demo/useDemoOrchestrator";
import { ForgeModulePanel } from "@/components/modules/ForgeModulePanel";
import type { ForgeModuleId } from "@/lib/modules/types";
import {
  DEMO_EXPLAIN_RESPONSE,
  DEMO_INTAKE_RESPONSE,
} from "@/lib/demo/constants";
import {
  getDemoBeat,
  isActionBeat,
  isSpotlightBeat,
  isTourBeat,
} from "@/lib/demo/demo-script";

interface ProjectData {
  id: string;
  name: string;
  status: ProjectStatus;
  summary: string | null;
  metadata: ProjectMetadata | null;
  indexProgress: IndexProgress | null;
}

export function ProjectWorkspace({ projectId }: { projectId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const demoActive =
    searchParams.get("demo") === "1" ||
    searchParams.get("tour") === "1" ||
    searchParams.get("welcome") === "1";

  const [project, setProject] = useState<ProjectData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    null
  );
  const [centerView, setCenterView] = useState<CenterView>("chat");
  const [editorFile, setEditorFile] = useState<string | null>(null);
  const [activeModule, setActiveModule] = useState<ForgeModuleId | null>(null);
  const [buildLogRecording, setBuildLogRecording] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [demoDocked, setDemoDocked] = useState(false);

  const engageDemo = useCallback(() => setDemoDocked(true), []);

  const handleSelectFile = useCallback((path: string) => {
    setEditorFile(path);
    setCenterView("editor");
  }, []);

  const demo = useDemoOrchestrator({
    projectId,
    demoActive,
    onSelectFile: handleSelectFile,
    onCenterViewChange: setCenterView,
    onOpenModule: setActiveModule,
    onPendingPrompt: setPendingPrompt,
  });

  useEffect(() => {
    if (demo.cadPanelOpen) setActiveModule("onshape-cad");
  }, [demo.cadPanelOpen]);

  useEffect(() => {
    if (!demo.demoModeActive || demo.beatIndex < 0) return;
    const beat = getDemoBeat(demo.beatIndex);
    if (!beat || !isActionBeat(beat)) return;
    const t = setTimeout(() => demo.advanceBeat(), 2000);
    return () => clearTimeout(t);
  }, [demo.beatIndex, demo.demoModeActive, demo.advanceBeat]);

  const fetchProject = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}`);
    if (res.status === 404) {
      setNotFound(true);
      return null;
    }
    const data = (await res.json()) as ProjectData;
    setProject(data);
    return data;
  }, [projectId]);

  const fetchConversations = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/conversations`);
    const d = await res.json();
    setConversations(d.conversations ?? []);
  }, [projectId]);

  const fetchResources = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/resources`);
    const d = await res.json();
    setResources(d.resources ?? []);
  }, [projectId]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    const poll = async () => {
      const data = await fetchProject();
      if (cancelled || !data) return;
      if (data.status === "indexing" || data.status === "uploading") {
        timer = setTimeout(poll, 1200);
      } else if (data.status === "ready") {
        fetchConversations();
        fetchResources();
      }
    };
    poll();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [fetchProject, fetchConversations, fetchResources]);

  const demoCanned = useMemo(
    () => ({
      "explain this project architecture": DEMO_EXPLAIN_RESPONSE,
      "explain this robot": DEMO_EXPLAIN_RESPONSE,
      "why does the collection mechanism fail under load": DEMO_INTAKE_RESPONSE,
      "why does the collection mechanism fail under load?": DEMO_INTAKE_RESPONSE,
      "why does the intake jam": DEMO_INTAKE_RESPONSE,
      "why does the intake jam?": DEMO_INTAKE_RESPONSE,
    }),
    []
  );

  const appendBuildLog = useCallback(
    async (userMsg: string, assistantMsg?: string) => {
      if (!buildLogRecording) return;
      const entry = `**You:** ${userMsg}${
        assistantMsg ? `\n\n**Forge:** ${assistantMsg.slice(0, 800)}` : ""
      }`;
      await fetch(`/api/projects/${projectId}/build-log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entry }),
      }).catch(() => {});
    },
    [projectId, buildLogRecording]
  );

  const spotlightMeta = useMemo(() => {
    if (!demo.spotlightId) return null;
    const featureIndex = FEATURE_SPOTLIGHTS.findIndex((s) => s.id === demo.spotlightId);
    return { featureIndex, id: demo.spotlightId };
  }, [demo.spotlightId]);

  const startNewConversation = useCallback(() => {
    setActiveConversationId(null);
  }, []);

  const handleConversationCreated = useCallback(
    (id: string) => {
      setActiveConversationId(id);
      fetchConversations();
    },
    [fetchConversations]
  );

  if (notFound) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3">
        <AlertCircle className="h-8 w-8 text-[var(--muted)]" />
        <p className="text-sm text-[var(--muted)]">Project not found</p>
        <Link href="/" className="text-xs text-[var(--accent)] underline">
          Back home
        </Link>
      </div>
    );
  }

  if (!project || project.status === "indexing" || project.status === "uploading") {
    if (demoActive) {
      return <DemoIndexingOverlay progress={project?.indexProgress ?? null} />;
    }
    return <IndexingOverlay progress={project?.indexProgress ?? null} />;
  }

  if (project.status === "error") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 px-6">
        <AlertCircle className="h-8 w-8 text-red-400" />
        <p className="text-sm font-medium">Indexing failed</p>
        <p className="max-w-md text-center text-xs text-[var(--muted)]">
          {project.indexProgress?.message ?? "Something went wrong."}
        </p>
        <Link href="/" className="text-xs text-[var(--accent)] underline">
          Back home
        </Link>
      </div>
    );
  }

  const showDemoUi = demo.demoModeActive && demo.beatIndex >= 0;
  const currentBeat = getDemoBeat(demo.beatIndex);

  return (
    <div className="flex h-screen overflow-hidden">
      <ProjectSidebar
        projectId={projectId}
        projectName={project.name}
        conversations={conversations}
        activeConversationId={activeConversationId}
        resources={resources}
        activeModule={activeModule}
        onNewConversation={startNewConversation}
        onSelectConversation={setActiveConversationId}
        onSelectModule={setActiveModule}
        onResourceUploaded={fetchResources}
      />

      <div className="relative flex min-w-0 flex-1 flex-col">
        <MainPanel
          projectId={projectId}
          projectName={project.name}
          conversationId={activeConversationId}
          centerView={centerView}
          editorFile={editorFile}
          fileTree={project.metadata?.fileTree ?? []}
          onCenterViewChange={setCenterView}
          onConversationCreated={handleConversationCreated}
          onSelectFile={handleSelectFile}
          onTitleChanged={fetchConversations}
          suggestedPrompts={showDemoUi ? DEMO_PROMPTS : undefined}
          highlightedPrompt={demo.highlightPrompt}
          cannedResponses={showDemoUi ? demoCanned : undefined}
          onDemoMessageSent={demo.handleDemoMessage}
          buildLogRecording={buildLogRecording}
          onBuildLogEntry={appendBuildLog}
          pendingPrompt={pendingPrompt}
          onPendingPromptConsumed={() => setPendingPrompt(null)}
        />

        {showDemoUi && currentBeat && isSpotlightBeat(currentBeat) && spotlightMeta && (
          <FeatureSpotlight
            spotlightId={spotlightMeta.id}
            step={spotlightMeta.featureIndex}
            total={FEATURE_SPOTLIGHTS.length}
            scriptStep={demo.beatIndex}
            scriptTotal={demo.totalBeats}
            docked={demoDocked}
            onTry={demo.handleSpotlightTry}
            onNext={demo.handleSpotlightNext}
            onSkip={demo.endDemo}
            onEngage={engageDemo}
          />
        )}

        {showDemoUi && currentBeat && isTourBeat(currentBeat) && demo.tourStep && (
          <DemoTour
            step={demo.tourStep}
            docked={demoDocked}
            onAdvance={demo.handleTourAdvance}
            onSkip={demo.endDemo}
            onEngage={engageDemo}
          />
        )}
      </div>

      {project.metadata && (
        <ContextPanel
          summary={project.summary}
          metadata={project.metadata}
          onSelectFile={handleSelectFile}
          highlight={demo.contextHighlight}
        />
      )}

      <AnimatePresence>
        {activeModule && (
          <ForgeModulePanel
            moduleId={activeModule}
            projectId={projectId}
            projectName={project.name}
            metadata={project.metadata}
            resources={resources}
            recording={buildLogRecording}
            onRecordingChange={setBuildLogRecording}
            onClose={() => setActiveModule(null)}
            onSelectFile={(path) => {
              setActiveModule(null);
              handleSelectFile(path);
            }}
            onResourceUploaded={fetchResources}
          />
        )}
      </AnimatePresence>

      {showDemoUi && demo.progressLabel && (
        <DemoProgressPill
          step={demo.beatIndex}
          total={demo.totalBeats}
          label={demo.progressLabel}
          onSkip={demo.endDemo}
        />
      )}
    </div>
  );
}
