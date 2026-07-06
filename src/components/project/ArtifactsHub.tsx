"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Box,
  Download,
  ExternalLink,
  FileCode,
  FileText,
  Film,
  Flame,
  FolderGit2,
  Image as ImageIcon,
  Loader2,
  Search,
} from "lucide-react";
import { formatBytes } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

interface ArtifactResource {
  id: string;
  type: string;
  name: string;
  size: number;
  summary?: string | null;
  externalUrl?: string | null;
  externalProvider?: string | null;
}

interface ProjectInfo {
  id: string;
  name: string;
  source: string;
  metadata: { githubRepo?: string; githubRef?: string } | null;
}

const TYPE_ICONS: Record<string, typeof FileText> = {
  repository: FolderGit2,
  cad: Box,
  pdf: FileText,
  document: FileText,
  notebook: FileText,
  image: ImageIcon,
  video: Film,
  other: FileText,
};

const PROVIDER_LABELS: Record<string, string> = {
  onshape: "Edit in Onshape",
  github: "Open on GitHub",
  other: "Open link",
};

interface GitHubStatus {
  oauthConfigured: boolean;
  connected: boolean;
  login: string | null;
  fallbackToken: boolean;
}

export function ArtifactsHub({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [resources, setResources] = useState<ArtifactResource[] | null>(null);
  const [github, setGithub] = useState<GitHubStatus | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then((r) => r.json())
      .then(setProject)
      .catch(() => setProject(null));
    fetch(`/api/projects/${projectId}/resources`)
      .then((r) => r.json())
      .then((d) => setResources(d.resources ?? []))
      .catch(() => setResources([]));
    fetch(`/api/projects/${projectId}/github`)
      .then((r) => r.json())
      .then(setGithub)
      .catch(() => setGithub(null));
  }, [projectId]);

  if (!resources) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--muted)]" />
      </div>
    );
  }

  const cad = resources.filter((r) => r.type === "cad");
  const docs = resources.filter((r) =>
    ["pdf", "document", "notebook"].includes(r.type)
  );
  const media = resources.filter((r) => ["image", "video"].includes(r.type));
  const externalLinks = resources.filter(
    (r) => r.externalUrl && !["cad"].includes(r.type)
  );
  const githubRepo = project?.metadata?.githubRepo;

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/projects/${projectId}`}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Workspace
          </Link>
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-[var(--accent)]" />
            <span className="text-sm font-semibold">{project?.name ?? "Project"}</span>
          </div>
        </div>
        <ThemeToggle />
      </div>

      <h1 className="mt-8 text-3xl font-bold tracking-tight">Artifacts</h1>
      <p className="mt-2 text-base text-[var(--muted)]">
        Every artifact connected to this project — view in Forge, edit online, or
        download.
      </p>

      <Section title="Source code" icon={FileCode}>
        <ArtifactRow
          icon={FolderGit2}
          name={project?.name ?? "Repository"}
          detail={
            project?.source === "github"
              ? `GitHub · ${githubRepo ?? ""}${
                  github?.connected
                    ? ` · connected${github.login ? ` as ${github.login}` : ""}`
                    : ""
                }`
              : "Uploaded repository (.zip)"
          }
          actions={
            <>
              <ActionLink href={`/projects/${projectId}`} label="View in Forge" internal />
              {githubRepo && (
                <ActionLink
                  href={`https://github.com/${githubRepo}`}
                  label="Open on GitHub"
                />
              )}
              {githubRepo &&
                github &&
                !github.connected &&
                github.oauthConfigured && (
                  <ActionLink
                    href={`/api/integrations/github?projectId=${projectId}`}
                    label="Connect GitHub"
                    internal
                  />
                )}
            </>
          }
        />
        {githubRepo && github?.connected && (
          <p className="mt-2 px-1 text-xs text-[var(--muted)]">
            GitHub connected — edits saved in the Forge editor can be pushed back to{" "}
            <span className="font-mono">{githubRepo}</span> with the Push button.
          </p>
        )}
      </Section>

      <Section title="CAD" icon={Box} empty={cad.length === 0} emptyText="No CAD linked yet — connect Onshape or upload STEP/STL exports from the Onshape CAD module.">
        {cad.map((r) => (
          <ArtifactRow
            key={r.id}
            icon={Box}
            name={r.name}
            detail={r.externalProvider === "onshape" ? "Onshape document" : formatBytes(r.size)}
            actions={
              <>
                <ActionLink href={`/projects/${projectId}`} label="View in Forge" internal />
                {r.externalUrl && (
                  <ActionLink
                    href={r.externalUrl}
                    label={PROVIDER_LABELS[r.externalProvider ?? "other"]}
                  />
                )}
                {r.size > 0 && (
                  <ActionLink
                    href={`/api/projects/${projectId}/resources/${r.id}/file?download=1`}
                    label="Download"
                    icon={Download}
                  />
                )}
              </>
            }
          />
        ))}
      </Section>

      <Section title="Documents" icon={FileText} empty={docs.length === 0} emptyText="No documents attached yet.">
        {docs.map((r) => {
          const Icon = TYPE_ICONS[r.type] ?? FileText;
          return (
            <ArtifactRow
              key={r.id}
              icon={Icon}
              name={r.name}
              detail={`${r.type.toUpperCase()} · ${formatBytes(r.size)}`}
              actions={
                <>
                  <ActionLink href={`/projects/${projectId}`} label="View in Forge" internal />
                  {r.externalUrl && (
                    <ActionLink
                      href={r.externalUrl}
                      label={PROVIDER_LABELS[r.externalProvider ?? "other"]}
                    />
                  )}
                  <ActionLink
                    href={`/api/projects/${projectId}/resources/${r.id}/file?download=1`}
                    label="Download"
                    icon={Download}
                  />
                </>
              }
            />
          );
        })}
      </Section>

      {media.length > 0 && (
        <Section title="Media" icon={Film}>
          {media.map((r) => {
            const Icon = TYPE_ICONS[r.type] ?? Film;
            return (
              <ArtifactRow
                key={r.id}
                icon={Icon}
                name={r.name}
                detail={`${r.type} · ${formatBytes(r.size)}`}
                actions={
                  <ActionLink
                    href={`/api/projects/${projectId}/resources/${r.id}/file?download=1`}
                    label="Download"
                    icon={Download}
                  />
                }
              />
            );
          })}
        </Section>
      )}

      {externalLinks.length > 0 && (
        <Section title="External links" icon={ExternalLink}>
          {externalLinks.map((r) => (
            <ArtifactRow
              key={`ext-${r.id}`}
              icon={ExternalLink}
              name={r.name}
              detail={r.externalProvider ?? "link"}
              actions={
                <ActionLink
                  href={r.externalUrl!}
                  label={PROVIDER_LABELS[r.externalProvider ?? "other"]}
                />
              }
            />
          ))}
        </Section>
      )}

      <RelatedCodeSearch />
    </main>
  );
}

interface RelatedCodeResult {
  title: string;
  url: string;
  highlights: string[];
}

/** Exa-powered search across GitHub for relevant library/example source code. */
function RelatedCodeSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RelatedCodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch("/api/knowledge/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, type: "github-code" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Search failed");
      setResults(data.results ?? []);
      if ((data.results ?? []).length === 0) {
        setSearchError("No results — is EXA_API_KEY configured?");
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  };

  return (
    <section className="mt-10 pb-12">
      <div className="flex items-center gap-2">
        <FolderGit2 className="h-4 w-4 text-[var(--accent)]" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--muted)]">
          Related code on GitHub
        </h2>
      </div>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Search open-source VEX/PROS/LemLib code relevant to your project.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="e.g. odometry with rotation sensors"
          className="glass min-w-0 flex-1 rounded-xl px-4 py-2.5 text-sm outline-none placeholder:text-[var(--muted)]/60 focus:border-[var(--accent)]"
        />
        <button
          type="button"
          onClick={search}
          disabled={searching || !query.trim()}
          className="flex shrink-0 items-center gap-2 rounded-xl border border-[var(--border)] px-4 text-sm font-medium transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
        >
          {searching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          Search
        </button>
      </div>
      {searchError && <p className="mt-2 text-sm text-[var(--muted)]">{searchError}</p>}
      {results.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {results.map((r) => (
            <a
              key={r.url}
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="glass flex items-start gap-3 rounded-xl p-4 transition-colors hover:border-[var(--accent)]"
            >
              <FolderGit2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted)]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{r.title}</p>
                {r.highlights[0] && (
                  <p className="mt-1 line-clamp-2 text-xs text-[var(--muted)]">
                    {r.highlights[0]}
                  </p>
                )}
              </div>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

function Section({
  title,
  icon: Icon,
  empty,
  emptyText,
  children,
}: {
  title: string;
  icon: typeof FileText;
  empty?: boolean;
  emptyText?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-[var(--accent)]" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--muted)]">
          {title}
        </h2>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {empty ? (
          <p className="rounded-xl border border-dashed border-[var(--border)] px-4 py-5 text-sm text-[var(--muted)]">
            {emptyText}
          </p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

function ArtifactRow({
  icon: Icon,
  name,
  detail,
  actions,
}: {
  icon: typeof FileText;
  name: string;
  detail: string;
  actions: React.ReactNode;
}) {
  return (
    <div className="glass flex flex-col gap-3 rounded-xl p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-dim)]">
          <Icon className="h-5 w-5 text-[var(--accent)]" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{name}</p>
          <p className="text-sm text-[var(--muted)]">{detail}</p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
    </div>
  );
}

function ActionLink({
  href,
  label,
  internal = false,
  icon: Icon,
}: {
  href: string;
  label: string;
  internal?: boolean;
  icon?: typeof Download;
}) {
  const className =
    "inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]";
  if (internal) {
    return (
      <Link href={href} className={className}>
        {label}
      </Link>
    );
  }
  return (
    <a href={href} target={href.startsWith("/api") ? undefined : "_blank"} rel="noopener noreferrer" className={className}>
      {Icon ? <Icon className="h-3.5 w-3.5" /> : <ExternalLink className="h-3.5 w-3.5" />}
      {label}
    </a>
  );
}
