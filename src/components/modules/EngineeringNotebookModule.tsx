"use client";

import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Download,
  FileText,
  KeyRound,
  Loader2,
  Paperclip,
  Presentation,
  RefreshCw,
  ScanSearch,
  Target,
  X,
} from "lucide-react";
import type { ReviewFlag } from "@/lib/review/refine";
import { ModulePanelShell } from "./ModulePanelShell";

interface NotebookResource {
  id: string;
  type: string;
  name: string;
  summary?: string | null;
}

type DocViewMode = "text" | "pdf" | "slides";

function viewModeFor(name: string): DocViewMode {
  const ext = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "pptx") return "slides";
  return "text";
}

interface EngineeringNotebookModuleProps {
  projectId: string;
  resources: NotebookResource[];
  onClose: () => void;
  onResourceUploaded?: () => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

type Tab = "scope" | "documents";

// ─── Review state ────────────────────────────────────────────────────────────

interface ReviewState {
  status: "loading" | "done" | "error" | "no-key";
  flags: ReviewFlag[];
  reviewedSections?: number;
  message?: string;
}

function reviewCacheKey(projectId: string, rid: string) {
  return `forge-review-${projectId}-${rid}`;
}

function readCachedReview(projectId: string, rid: string): ReviewState | null {
  try {
    const raw = sessionStorage.getItem(reviewCacheKey(projectId, rid));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.status === "done" && Array.isArray(parsed.flags)) return parsed;
  } catch {
    /* ignore corrupt cache */
  }
  return null;
}

const SEVERITY_COLOR: Record<string, string> = {
  high: "var(--red, #ef4444)",
  medium: "var(--orange, #f59e0b)",
  low: "var(--muted)",
};

export function EngineeringNotebookModule({
  projectId,
  resources,
  onClose,
  onResourceUploaded,
  expanded,
  onToggleExpand,
}: EngineeringNotebookModuleProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const notebookResources = resources.filter((r) =>
    ["notebook", "pdf", "document", "other"].includes(r.type)
  );
  const scopeResource = notebookResources.find(
    (r) => r.name.includes("scope") || r.name.includes("project-scope")
  );
  const [tab, setTab] = useState<Tab>(scopeResource ? "scope" : "documents");
  const [activeId, setActiveId] = useState<string | null>(
    notebookResources.find((r) => !r.name.includes("scope"))?.id ?? null
  );
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Review assistant state
  const [reviews, setReviews] = useState<Record<string, ReviewState>>({});
  const [reviewOpen, setReviewOpen] = useState<Record<string, boolean>>({});
  const [pdfPage, setPdfPage] = useState<number | null>(null);
  const [highlightSection, setHighlightSection] = useState<{
    kind: string;
    number: number;
  } | null>(null);

  const viewId = tab === "scope" && scopeResource ? scopeResource.id : activeId;

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/projects/${projectId}/resources`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      onResourceUploaded?.();
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if (!viewId) {
      setContent(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/projects/${projectId}/resources/${viewId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setContent(d.content ?? d.summary ?? null);
      })
      .catch(() => {
        if (!cancelled) setContent(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [viewId, projectId]);

  // Reset per-document navigation state when switching documents
  useEffect(() => {
    setPdfPage(null);
    setHighlightSection(null);
  }, [activeId]);

  // Briefly highlight a slide/section, then fade
  useEffect(() => {
    if (!highlightSection) return;
    const el = document.getElementById(
      `${highlightSection.kind}-anchor-${highlightSection.number}`
    );
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    const t = setTimeout(() => setHighlightSection(null), 2500);
    return () => clearTimeout(t);
  }, [highlightSection]);

  const runReview = async (rid: string, force = false) => {
    if (!force) {
      const cached = readCachedReview(projectId, rid);
      if (cached) {
        setReviews((prev) => ({ ...prev, [rid]: cached }));
        setReviewOpen((prev) => ({ ...prev, [rid]: true }));
        return;
      }
    }
    setReviews((prev) => ({ ...prev, [rid]: { status: "loading", flags: [] } }));
    setReviewOpen((prev) => ({ ...prev, [rid]: true }));
    try {
      const res = await fetch(
        `/api/projects/${projectId}/resources/${rid}/review`,
        { method: "POST" }
      );
      const data = await res.json().catch(() => ({}));
      if (res.status === 503 && data.error === "llm-not-configured") {
        setReviews((prev) => ({
          ...prev,
          [rid]: { status: "no-key", flags: [] },
        }));
        return;
      }
      if (!res.ok) {
        setReviews((prev) => ({
          ...prev,
          [rid]: {
            status: "error",
            flags: [],
            message: data.message ?? data.error ?? "Review failed",
          },
        }));
        return;
      }
      const state: ReviewState = {
        status: "done",
        flags: data.flags ?? [],
        reviewedSections: data.reviewedSections,
      };
      setReviews((prev) => ({ ...prev, [rid]: state }));
      try {
        sessionStorage.setItem(reviewCacheKey(projectId, rid), JSON.stringify(state));
      } catch {
        /* storage full/unavailable — cache is best-effort */
      }
    } catch {
      setReviews((prev) => ({
        ...prev,
        [rid]: { status: "error", flags: [], message: "Review failed" },
      }));
    }
  };

  const handleFlagClick = (flag: ReviewFlag) => {
    if (flag.location.number === undefined) return;
    if (flag.location.kind === "page") {
      setPdfPage(flag.location.number);
    } else {
      // "slide" and "section" anchors live inside the rendered outline
      setHighlightSection({
        kind: flag.location.kind,
        number: flag.location.number,
      });
    }
  };

  const docResources = notebookResources.filter((r) => r.id !== scopeResource?.id);
  const activeDoc = docResources.find((r) => r.id === activeId) ?? null;
  const activeReview = activeDoc ? reviews[activeDoc.id] : undefined;
  const activeReviewOpen = activeDoc ? (reviewOpen[activeDoc.id] ?? false) : false;

  return (
    <ModulePanelShell
      eyebrow="Engineering Notebook"
      title="Scope & design knowledge"
      onClose={onClose}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
    >
      <div className="mx-auto flex h-full max-w-3xl flex-col px-8 py-8">
        <div className="flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--inset)] p-1">
          <TabButton active={tab === "scope"} onClick={() => setTab("scope")} icon={Target}>
            Project scope
          </TabButton>
          <TabButton active={tab === "documents"} onClick={() => setTab("documents")} icon={BookOpen}>
            Documents
          </TabButton>
        </div>

        {tab === "scope" && (
          <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--blue-dim)] px-4 py-3 text-sm text-[var(--foreground-secondary)]">
            Forge uses project scope to prioritize subsystems, generate coding sections, and
            align autonomous routines with competition goals.
          </div>
        )}

        {tab === "documents" && docResources.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {docResources.map((r) => {
              const isPptx = r.name.toLowerCase().endsWith(".pptx");
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setActiveId(r.id)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    activeId === r.id
                      ? "border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)]"
                      : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--border-strong)]"
                  }`}
                >
                  {isPptx ? (
                    <Presentation className="h-3.5 w-3.5" />
                  ) : (
                    <FileText className="h-3.5 w-3.5" />
                  )}
                  {r.name}
                  {isPptx && (
                    <span className="ml-0.5 rounded px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-[var(--orange-dim,rgba(234,88,12,0.1))] text-[var(--orange,#ea580c)]">
                      PPTX
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {tab === "documents" && docResources.length === 0 ? (
          <EmptyDocs uploading={uploading} fileRef={fileRef} onUpload={handleUpload} />
        ) : tab === "scope" && !scopeResource ? (
          <div className="mt-8 flex flex-1 flex-col items-center justify-center text-center">
            <Target className="h-12 w-12 text-[var(--muted)] opacity-60" />
            <p className="mt-4 text-base font-semibold">No project scope yet</p>
            <p className="mt-2 max-w-sm text-sm text-[var(--muted)]">
              Upload a scope document or open the sample project to see scope-driven codegen.
            </p>
          </div>
        ) : (
          <div className="mt-5 min-h-0 flex-1">
            {activeDoc && tab === "documents" && (
              <div className="mb-3 flex items-center justify-between gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium ${
                    content
                      ? "border-[var(--green)]/30 bg-[var(--green-dim)] text-[var(--green)]"
                      : "border-[var(--border)] text-[var(--muted)]"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${content ? "bg-[var(--green)]" : "bg-[var(--muted)]"}`}
                  />
                  {loading ? "Extracting…" : content ? "Indexed" : "Stored (no text)"}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => runReview(activeDoc.id)}
                    disabled={activeReview?.status === "loading"}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[var(--accent)]/40 bg-[var(--accent-dim)] px-2.5 py-1 text-xs font-semibold text-[var(--accent)] transition-opacity hover:opacity-85 disabled:opacity-50"
                    title="AI review: pointers to problems — never rewritten text"
                  >
                    {activeReview?.status === "loading" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ScanSearch className="h-3.5 w-3.5" />
                    )}
                    Review
                  </button>
                  <a
                    href={`/api/projects/${projectId}/resources/${activeDoc.id}/file?download=1`}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </a>
                </div>
              </div>
            )}

            {activeDoc && tab === "documents" && activeReview && activeReviewOpen && (
              <ReviewPanel
                review={activeReview}
                onFlagClick={handleFlagClick}
                onRerun={() => runReview(activeDoc.id, true)}
                onDismiss={() =>
                  setReviewOpen((prev) => ({ ...prev, [activeDoc.id]: false }))
                }
              />
            )}

            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-[var(--muted)]" />
              </div>
            ) : activeDoc && viewModeFor(activeDoc.name) === "pdf" && tab === "documents" ? (
              <iframe
                key={`${activeDoc.id}-p${pdfPage ?? 0}`}
                src={`/api/projects/${projectId}/resources/${activeDoc.id}/file${
                  pdfPage ? `#page=${pdfPage}` : ""
                }`}
                title={activeDoc.name}
                className="h-[min(65vh,640px)] w-full rounded-xl border border-[var(--border)] bg-white"
              />
            ) : activeDoc && viewModeFor(activeDoc.name) === "slides" && tab === "documents" ? (
              content ? (
                <article className="card max-h-[min(65vh,560px)] overflow-y-auto p-5 text-base leading-relaxed text-[var(--foreground-secondary)]">
                  <SlideOutline
                    text={content}
                    highlight={
                      highlightSection?.kind === "slide"
                        ? highlightSection.number
                        : null
                    }
                  />
                </article>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Presentation className="h-10 w-10 text-[var(--muted)] opacity-60" />
                  <p className="mt-3 text-sm text-[var(--muted)]">
                    No text could be extracted from this deck. Download to view slides.
                  </p>
                </div>
              )
            ) : content ? (
              <article className="card max-h-[min(65vh,560px)] overflow-y-auto p-5 text-base leading-relaxed text-[var(--foreground-secondary)]">
                <NotebookContent
                  text={content}
                  highlight={
                    highlightSection?.kind === "section"
                      ? highlightSection.number
                      : null
                  }
                />
              </article>
            ) : (
              <p className="text-base text-[var(--muted)]">
                {tab === "scope"
                  ? "Scope document attached — text extraction pending for this format."
                  : "Could not load document content."}
              </p>
            )}
          </div>
        )}

        {tab === "documents" && (
          <>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".pdf,.md,.txt,.pptx,.doc,.docx"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] py-3 text-sm font-semibold transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-60"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Paperclip className="h-4 w-4" />
              )}
              Attach notebook, PDF, or PPTX
            </button>
          </>
        )}
      </div>
    </ModulePanelShell>
  );
}

// ─── Review punch-list panel ─────────────────────────────────────────────────

function ReviewPanel({
  review,
  onFlagClick,
  onRerun,
  onDismiss,
}: {
  review: ReviewState;
  onFlagClick: (flag: ReviewFlag) => void;
  onRerun: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="mb-3 rounded-xl border border-[var(--border)] bg-[var(--inset)] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
          <ScanSearch className="h-3.5 w-3.5 text-[var(--accent)]" />
          Review — pointers, not rewrites
        </p>
        <div className="flex items-center gap-1">
          {review.status === "done" && (
            <button
              type="button"
              onClick={onRerun}
              className="rounded p-1 text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
              title="Re-run review"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onDismiss}
            className="rounded p-1 text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
            title="Hide review"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {review.status === "loading" ? (
        <div className="flex items-center gap-2 py-3 text-sm text-[var(--muted)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Reading the document and flagging problem areas…
        </div>
      ) : review.status === "no-key" ? (
        <div className="flex items-center gap-2 py-3 text-sm text-[var(--muted)]">
          <KeyRound className="h-4 w-4 shrink-0" />
          Add an AI key to enable document review.
        </div>
      ) : review.status === "error" ? (
        <p className="py-3 text-sm text-red-400">{review.message ?? "Review failed"}</p>
      ) : review.flags.length === 0 ? (
        <p className="py-3 text-sm text-[var(--muted)]">
          No problem areas flagged{review.reviewedSections ? ` across ${review.reviewedSections} sections` : ""}. Nice work — keep documenting decisions and evidence.
        </p>
      ) : (
        <>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {review.flags.length} spot{review.flags.length === 1 ? "" : "s"} to look at
            {review.reviewedSections ? ` · ${review.reviewedSections} sections reviewed` : ""}.
            Click a flag to jump there.
          </p>
          <ul className="mt-2 flex max-h-56 flex-col gap-1 overflow-y-auto">
            {review.flags.map((flag, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => onFlagClick(flag)}
                  className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[var(--surface)]"
                >
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    style={{ background: SEVERITY_COLOR[flag.severity] ?? "var(--muted)" }}
                    title={`${flag.severity} severity`}
                  />
                  <span className="shrink-0 rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                    {flag.location.label}
                  </span>
                  <span className="min-w-0 flex-1 text-sm leading-snug">{flag.issue}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Target;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2.5 text-sm font-medium transition-colors ${
        active
          ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm"
          : "text-[var(--muted)] hover:text-[var(--foreground)]"
      }`}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

function EmptyDocs({
  uploading,
  fileRef,
  onUpload,
}: {
  uploading: boolean;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onUpload: (f: File) => void;
}) {
  return (
    <div className="mt-8 flex flex-1 flex-col items-center justify-center text-center">
      <BookOpen className="h-12 w-12 text-[var(--muted)] opacity-60" />
      <p className="mt-4 text-base font-semibold">No notebook attached</p>
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept=".pdf,.md,.txt,.pptx"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="mt-6 flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
        Attach notebook
      </button>
    </div>
  );
}

const HIGHLIGHT_CLASS =
  "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--surface)] transition-shadow duration-500";

/** Renders PPTX-extracted text as a slide-by-slide outline. */
function SlideOutline({ text, highlight }: { text: string; highlight?: number | null }) {
  const slides = text.split(/\n\n(?=## Slide )/).filter((s) => s.trim());
  return (
    <div className="space-y-4">
      {slides.map((slide, i) => {
        const lines = slide.split("\n");
        const heading = lines[0]?.startsWith("## ") ? lines[0].slice(3) : `Slide ${i + 1}`;
        const body = lines[0]?.startsWith("## ") ? lines.slice(1) : lines;
        const slideNum = Number(heading.match(/Slide (\d+)/)?.[1] ?? i + 1);
        const isHighlighted = highlight === slideNum;
        return (
          <div
            key={i}
            id={`slide-anchor-${slideNum}`}
            className={`rounded-lg border border-[var(--border)] bg-[var(--inset)] p-4 ${
              isHighlighted ? HIGHLIGHT_CLASS : ""
            }`}
          >
            <p className="flex items-center gap-2 text-sm font-semibold text-[var(--accent)]">
              <Presentation className="h-3.5 w-3.5" />
              {heading}
            </p>
            <div className="mt-2 space-y-1">
              {body
                .filter((l) => l.trim())
                .map((line, j) =>
                  line.startsWith("[Notes] ") ? (
                    <p key={j} className="text-sm italic text-[var(--muted)]">
                      {line.slice(8)}
                    </p>
                  ) : (
                    <p key={j} className="text-sm">
                      {line}
                    </p>
                  )
                )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function NotebookContent({ text, highlight }: { text: string; highlight?: number | null }) {
  // Mirror the section split used by the review API (sectionsFromHeadings)
  // so "Section N" flags land on the matching anchor.
  const clean = text.replace(/\r\n/g, "\n").trim();
  const parts = clean.split(/\n(?=#{1,3} )/).filter((s) => s.trim());
  const sections = parts.length > 1 ? parts : [clean];

  return (
    <div className="space-y-2">
      {sections.map((section, si) => (
        <div
          key={si}
          id={`section-anchor-${si + 1}`}
          className={`space-y-2 rounded-md ${highlight === si + 1 ? HIGHLIGHT_CLASS : ""}`}
        >
          {section.split("\n").map((line, i) => {
            if (line.startsWith("# ")) {
              return (
                <h1 key={i} className="text-base font-semibold text-[var(--foreground)]">
                  {line.slice(2)}
                </h1>
              );
            }
            if (line.startsWith("## ")) {
              return (
                <h2 key={i} className="pt-2 text-sm font-semibold text-[var(--foreground)]">
                  {line.slice(3)}
                </h2>
              );
            }
            if (line.startsWith("- ")) {
              return (
                <p key={i} className="pl-3 before:mr-2 before:content-['•']">
                  {line.slice(2)}
                </p>
              );
            }
            if (line.startsWith("|")) {
              return (
                <p key={i} className="font-mono text-xs">
                  {line}
                </p>
              );
            }
            if (!line.trim()) return <div key={i} className="h-1" />;
            return <p key={i}>{line}</p>;
          })}
        </div>
      ))}
    </div>
  );
}
