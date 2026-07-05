"use client";

import { MessageSquare, Code2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConversationView } from "./ConversationView";
import { CodeEditorView } from "./CodeEditorView";
import { ForgeModulePanel } from "@/components/modules/ForgeModulePanel";
import { FORGE_MODULES, type ForgeModuleId } from "@/lib/modules/types";
import type { FileTreeNode, ProjectMetadata } from "@/lib/types";
import type { ResourceItem } from "./ProjectSidebar";

export type CenterView = "chat" | "editor" | ForgeModuleId;

function isModuleView(view: CenterView): view is ForgeModuleId {
  return view !== "chat" && view !== "editor";
}

interface MainPanelProps {
  projectId: string;
  projectName: string;
  conversationId: string | null;
  centerView: CenterView;
  editorFile: string | null;
  fileTree: FileTreeNode[];
  metadata: ProjectMetadata | null;
  resources: ResourceItem[];
  onCenterViewChange: (view: CenterView) => void;
  onConversationCreated: (id: string) => void;
  onSelectFile: (path: string) => void;
  onTitleChanged: () => void;
  suggestedPrompts?: string[];
  welcomeTitle?: string;
  welcomeSubtitle?: string;
  highlightedPrompt?: string | null;
  cannedResponses?: Record<string, string>;
  onDemoMessageSent?: (prompt: string) => boolean;
  buildLogRecording?: boolean;
  onBuildLogEntry?: (user: string, assistant?: string) => void;
  onRecordingChange?: (recording: boolean) => void;
  onResourceUploaded?: () => void;
  pendingPrompt?: string | null;
  onPendingPromptConsumed?: () => void;
}

export function MainPanel({
  projectId,
  projectName,
  conversationId,
  centerView,
  editorFile,
  fileTree,
  metadata,
  resources,
  onCenterViewChange,
  onConversationCreated,
  onSelectFile,
  onTitleChanged,
  suggestedPrompts,
  welcomeTitle,
  welcomeSubtitle,
  highlightedPrompt,
  cannedResponses,
  onDemoMessageSent,
  buildLogRecording,
  onBuildLogEntry,
  onRecordingChange,
  onResourceUploaded,
  pendingPrompt,
  onPendingPromptConsumed,
}: MainPanelProps) {
  return (
    <div className="flex h-full min-w-0 flex-1 flex-col border-r border-[var(--border)]">
      <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-[var(--border)] px-4 py-2.5">
        <ViewTab
          active={centerView === "chat"}
          onClick={() => onCenterViewChange("chat")}
          icon={MessageSquare}
          label="Chat"
        />
        <ViewTab
          active={centerView === "editor"}
          onClick={() => onCenterViewChange("editor")}
          icon={Code2}
          label="Editor"
        />
        <div className="mx-1.5 h-5 w-px shrink-0 bg-[var(--border)]" />
        {FORGE_MODULES.map((m) => (
          <ViewTab
            key={m.id}
            active={centerView === m.id}
            onClick={() => onCenterViewChange(m.id)}
            icon={m.icon}
            label={m.label}
          />
        ))}
        {buildLogRecording && (
          <span className="badge-green ml-2 shrink-0">
            <span className="record-dot h-1.5 w-1.5 rounded-full bg-[var(--green)]" />
            Recording
          </span>
        )}
        {centerView === "editor" && editorFile && (
          <span className="ml-auto shrink-0 truncate pl-4 font-mono text-xs text-[var(--muted)]">
            {editorFile}
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1">
        {centerView === "chat" ? (
          <ConversationView
            projectId={projectId}
            projectName={projectName}
            conversationId={conversationId}
            onConversationCreated={onConversationCreated}
            onSelectFile={onSelectFile}
            onTitleChanged={onTitleChanged}
            suggestedPrompts={suggestedPrompts}
            welcomeTitle={welcomeTitle}
            welcomeSubtitle={welcomeSubtitle}
            highlightedPrompt={highlightedPrompt}
            cannedResponses={cannedResponses}
            onDemoMessageSent={onDemoMessageSent}
            buildLogRecording={buildLogRecording}
            onBuildLogEntry={onBuildLogEntry}
            pendingPrompt={pendingPrompt}
            onPendingPromptConsumed={onPendingPromptConsumed}
          />
        ) : centerView === "editor" ? (
          <CodeEditorView
            projectId={projectId}
            filePath={editorFile}
            fileTree={fileTree}
            onSelectFile={onSelectFile}
          />
        ) : isModuleView(centerView) ? (
          <ForgeModulePanel
            moduleId={centerView}
            projectId={projectId}
            projectName={projectName}
            metadata={metadata}
            resources={resources}
            recording={!!buildLogRecording}
            onRecordingChange={onRecordingChange ?? (() => {})}
            onClose={() => onCenterViewChange("chat")}
            onSelectFile={onSelectFile}
            onResourceUploaded={onResourceUploaded}
          />
        ) : null}
      </div>
    </div>
  );
}

function ViewTab({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof MessageSquare;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-[var(--accent-dim)] text-[var(--accent)]"
          : "text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--foreground)]"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
