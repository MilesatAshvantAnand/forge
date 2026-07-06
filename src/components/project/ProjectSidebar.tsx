"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  Flame,
  Plus,
  MessageSquare,
  FolderGit2,
  FileText,
  Image as ImageIcon,
  Video,
  File,
  Paperclip,
  Loader2,
  Box,
  Layers,
  Bot,
  Route,
} from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";
import { FORGE_MODULES, type ForgeModuleId } from "@/lib/modules/types";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export interface ConversationItem {
  id: string;
  title: string;
  updatedAt: number;
}

export interface ResourceItem {
  id: string;
  type: string;
  name: string;
  size: number;
  summary?: string | null;
  externalUrl?: string | null;
  externalProvider?: string | null;
}

const RESOURCE_ICONS: Record<string, typeof File> = {
  repository: FolderGit2,
  notebook: FileText,
  pdf: FileText,
  document: FileText,
  image: ImageIcon,
  video: Video,
  cad: Box,
  "auton-plan": Route,
  other: File,
};

interface ProjectSidebarProps {
  projectName: string;
  conversations: ConversationItem[];
  activeConversationId: string | null;
  resources: ResourceItem[];
  activeModule: ForgeModuleId | null;
  onNewConversation: () => void;
  onSelectConversation: (id: string) => void;
  onSelectModule: (id: ForgeModuleId | null) => void;
  onResourceUploaded: () => void;
  projectId: string;
}

export function ProjectSidebar({
  projectName,
  conversations,
  activeConversationId,
  resources,
  activeModule,
  onNewConversation,
  onSelectConversation,
  onSelectModule,
  onResourceUploaded,
  projectId,
}: ProjectSidebarProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/projects/${projectId}/resources`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Upload failed");
      }
      onResourceUploaded();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-center gap-2 px-4 py-4">
        <Link href="/" className="flex min-w-0 flex-1 items-center gap-2">
          <Flame className="h-5 w-5 shrink-0 text-[var(--accent)]" />
          <span className="text-sm font-semibold tracking-tight">Forge</span>
        </Link>
        <ThemeToggle />
      </div>
      <div className="flex items-center gap-1 px-4 pb-2">
        <span className="text-[var(--muted)]">/</span>
        <span className="truncate text-sm font-medium">{projectName}</span>
      </div>

      <div className="px-3">
        <button
          onClick={onNewConversation}
          className="flex w-full items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm font-medium transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          <Plus className="h-4 w-4" />
          New conversation
        </button>
      </div>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto px-3">
        <p className="px-1 pb-1.5 text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
          Conversations
        </p>
        <div className="flex flex-col gap-0.5">
          {conversations.length === 0 && (
            <p className="px-1 py-2 text-sm text-[var(--muted)]">
              No conversations yet
            </p>
          )}
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelectConversation(c.id)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors",
                c.id === activeConversationId
                  ? "bg-[var(--accent-dim)] text-[var(--accent)]"
                  : "text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--foreground)]"
              )}
            >
              <MessageSquare className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{c.title}</span>
            </button>
          ))}
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between px-1 pb-1.5">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
              Project context
            </p>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              title="Attach a resource (notebook, PDF, photos, video)"
              className="rounded p-1 text-[var(--muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--accent)]"
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Paperclip className="h-3.5 w-3.5" />
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".pdf,.md,.txt,.png,.jpg,.jpeg,.webp,.mp4,.mov,.csv,.json"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
                e.target.value = "";
              }}
            />
          </div>
          <div className="flex flex-col gap-0.5">
            {resources.map((r) => {
              const Icon = RESOURCE_ICONS[r.type] ?? File;
              return (
                <div
                  key={r.id}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-[var(--muted)]"
                  title={`${r.type} · ${formatBytes(r.size)}`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                  <span className="truncate">{r.name}</span>
                </div>
              );
            })}
          </div>
          {uploadError && (
            <p className="px-1 pt-1 text-xs text-red-400">{uploadError}</p>
          )}
          <p className="px-1 pt-2 text-xs leading-relaxed text-[var(--muted)]/70">
            Attach notebooks, PDFs, photos, and match footage. Forge folds them
            into every conversation.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <Link
            href={`/projects/${projectId}/artifacts`}
            className="flex items-center gap-2.5 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <Layers className="h-4 w-4 shrink-0" />
            Artifacts hub
          </Link>
          <Link
            href={`/projects/${projectId}/bot-profile`}
            title="Describe your robot's firmware and port map — the Bot Gateway checks generated code against it"
            className="flex items-center gap-2.5 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <Bot className="h-4 w-4 shrink-0" />
            Bot Profile
          </Link>
        </div>

        <div className="mt-6 pb-4">
          <p className="px-1 pb-1.5 text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
            Modules
          </p>
          <p className="px-1 pb-2 text-xs leading-relaxed text-[var(--muted)]/70">
            Open as a main view alongside Chat and Editor.
          </p>
          <div className="flex flex-col gap-0.5">
            {FORGE_MODULES.map((m) => {
              const Icon = m.icon;
              const isActive = activeModule === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onSelectModule(isActive ? null : m.id)}
                  title={m.description}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm font-medium transition-colors",
                    isActive
                      ? "bg-[var(--accent-dim)] text-[var(--accent)]"
                      : "text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--foreground)]"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}
