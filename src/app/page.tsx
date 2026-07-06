"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Flame,
  Loader2,
  Brain,
  Search,
  Rocket,
  ArrowRight,
  FolderGit2,
  LogOut,
  User,
} from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { LogoCarousel } from "@/components/home/LogoCarousel";
import { ensureAnonymousSession } from "@/lib/auth/anonymous-client";

interface AuthUser {
  id: string;
  name: string;
  email: string;
  isAnonymous?: boolean | null;
}

interface ProjectCard {
  id: string;
  name: string;
  status: string;
  createdAt: number;
  totalFiles: number;
  libraries: string[];
}

export default function HomePage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [projects, setProjects] = useState<ProjectCard[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [githubRepo, setGithubRepo] = useState("");
  const [importing, setImporting] = useState(false);
  const [authUser, setAuthUser] = useState<AuthUser | null | undefined>(undefined);

  const importFromGitHub = useCallback(async () => {
    if (!githubRepo.trim()) return;
    setImporting(true);
    setError(null);
    try {
      const res = await fetch("/api/projects/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo: githubRepo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      router.push(`/projects/${data.projectId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      setImporting(false);
    }
  }, [githubRepo, router]);

  useEffect(() => {
    // Resolve auth state — silently creates an anonymous session on first
    // visit so guests get a persistent workspace without signing in.
    ensureAnonymousSession()
      .then((user) => setAuthUser(user ?? null))
      .catch(() => setAuthUser(null));
  }, []);

  useEffect(() => {
    // Only load projects if we know the auth state
    if (authUser === undefined) return;
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setProjects(d.projects ?? []))
      .catch(() => setProjects([]));
  }, [authUser]);

  async function handleSignOut() {
    await fetch("/api/auth/sign-out", { method: "POST" });
    setAuthUser(null);
    setProjects([]);
    router.refresh();
  }

  const handleFile = async (file: File) => {
    if (!file.name.endsWith(".zip")) {
      setError("Upload a .zip of your robotics code repository.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/projects/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      router.push(`/projects/${data.projectId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setUploading(false);
    }
  };

  const startDemo = useCallback(() => {
    setDemoLoading(true);
    router.push("/demo");
  }, [router]);

  const openSample = useCallback(async () => {
    setDemoLoading(true);
    try {
      const res = await fetch("/api/demo", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/projects/${data.projectId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open sample");
      setDemoLoading(false);
    }
  }, [router]);

  const valueCards = [
    {
      icon: Brain,
      title: "Understand",
      body: "Upload your project. Forge builds a deep understanding of your robot — subsystems, libraries, and autonomous routines.",
    },
    {
      icon: Search,
      title: "Investigate",
      body: "Ask engineering questions. Forge reasons using code, CAD, documentation, and full project context.",
    },
    {
      icon: Rocket,
      title: "Improve",
      body: "Generate documentation, onboard teammates, and solve problems faster with an assistant that already knows your robot.",
    },
  ];

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-14">
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between gap-2"
      >
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-[var(--accent)]" />
          <span className="text-sm font-semibold tracking-tight">Forge</span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle showLabel />
          {authUser === undefined ? null : authUser?.isAnonymous ? (
            <div className="flex items-center gap-3">
              <Link href="/login" className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]">
                Sign in
              </Link>
              <Link
                href="/signup"
                title="Create a free account to keep this workspace on all your devices"
                className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-black hover:opacity-90"
              >
                Sign up to save your work
              </Link>
            </div>
          ) : authUser ? (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                <User className="h-3.5 w-3.5" />
                {authUser.name}
              </span>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
                title="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link href="/login" className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]">
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-black hover:opacity-90"
              >
                Sign up
              </Link>
            </div>
          )}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06 }}
        className="mt-14"
      >
        <div className="mb-4 inline-flex w-fit items-center gap-1.5 rounded-full border border-[var(--accent)]/30 bg-[var(--accent-dim)] px-3 py-1 text-sm font-medium text-[var(--accent)]">
          <Flame className="h-3.5 w-3.5" />
          Built for VEX &amp; FIRST Robotics teams
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          The AI Engineering Workspace
          <br />
          <span className="text-[var(--muted)]">for Competitive Robotics</span>
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-[var(--muted)]">
          Every robotics team has knowledge scattered across code, CAD, notebooks,
          and videos. Forge brings it together into one AI assistant that already
          understands your robot before you ask a question.
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]/80">
          Understand your robot — not just your code.
        </p>
      </motion.div>

      <div className="mt-10 grid gap-3 sm:grid-cols-3">
        {valueCards.map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 + i * 0.06 }}
            className="glass rounded-xl p-4"
          >
            <card.icon className="h-5 w-5 text-[var(--accent)]" />
            <h3 className="mt-3 text-sm font-semibold">{card.title}</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-[var(--muted)]">
              {card.body}
            </p>
          </motion.div>
        ))}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".zip"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-10 flex flex-col gap-3 sm:flex-row"
      >
        <button
          onClick={startDemo}
          disabled={demoLoading || uploading}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] py-3.5 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {demoLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}
          Try 5-Minute Demo
        </button>
        <button
          onClick={openSample}
          disabled={demoLoading || uploading}
          className="glass flex flex-1 items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-medium transition-colors hover:border-[var(--border-strong)] disabled:opacity-60"
        >
          Explore sample project
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading || demoLoading}
          className="glass flex flex-1 items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-medium transition-colors hover:border-[var(--border-strong)] disabled:opacity-60"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : null}
          Upload Your Project
        </button>
      </motion.div>

      <p className="mt-4 text-center text-xs text-[var(--muted)]">
        Guided demo for judges — ~5 minutes, no robotics knowledge required.
      </p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.34 }}
        className="mt-4 flex gap-2"
      >
        <div className="glass flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3">
          <FolderGit2 className="h-4 w-4 shrink-0 text-[var(--muted)]" />
          <input
            value={githubRepo}
            onChange={(e) => setGithubRepo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && importFromGitHub()}
            placeholder="Import from GitHub — owner/repo or URL"
            className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-[var(--muted)]/60"
          />
        </div>
        <button
          onClick={importFromGitHub}
          disabled={importing || !githubRepo.trim()}
          className="flex shrink-0 items-center gap-2 rounded-xl border border-[var(--border)] px-4 text-sm font-medium transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
        >
          {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Import
        </button>
      </motion.div>

      {error && <p className="mt-4 text-center text-xs text-red-400">{error}</p>}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.36 }}
        className="mt-16"
      >
        <p className="text-center text-xs text-[var(--muted)]">
          Powered by industry-leading technology
        </p>
        <div className="mt-4">
          <LogoCarousel />
        </div>
      </motion.div>

      {projects && projects.length > 0 && (
        <section className="mt-16">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-[var(--muted)]">Your projects</h2>
            <Link href="/projects" className="text-xs text-[var(--accent)] hover:underline">
              View all
            </Link>
          </div>
          {authUser?.isAnonymous && (
            <p className="mt-1 text-xs text-[var(--muted)]/70">
              Saved in this browser —{" "}
              <Link href="/signup" className="text-[var(--accent)] hover:underline">
                sign up
              </Link>{" "}
              to keep your work across devices.
            </p>
          )}
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {projects.slice(0, 4).map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="glass flex items-center gap-3 rounded-xl p-4 transition-colors hover:border-[var(--border-strong)]"
              >
                <FolderGit2 className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {p.totalFiles} files · {formatRelativeTime(p.createdAt)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-20 border-t border-[var(--border)] pt-12">
        <h2 className="text-lg font-bold tracking-tight">What is Forge?</h2>
        <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
          Forge is an AI engineering workspace built for competitive robotics teams.
          Unlike generic chatbots, it <strong className="font-semibold text-[var(--foreground)]">indexes your entire project first</strong> — source code,
          CAD links, engineering notebooks, rules PDFs, and build logs — so every answer
          is grounded in your actual artifacts.
        </p>

        <h3 className="mt-8 text-sm font-bold">How the 5-minute demo works</h3>
        <ol className="mt-3 space-y-2 text-sm text-[var(--muted)]">
          <li>
            <span className="font-semibold text-[var(--foreground)]">1. Indexing</span> — watch Forge scan code, subsystems, and attached documents.
          </li>
          <li>
            <span className="font-semibold text-[var(--foreground)]">2. Feature tour</span> — quick capsules for each module (Coding Assistant, CAD, Notebook, Build Log, Autonomous Planner, Match Intelligence).
          </li>
          <li>
            <span className="font-semibold text-[var(--foreground)]">3. Capstone investigation</span> — ask why a subsystem fails; Forge asks clarifying questions, then links notebook, code, and CAD in one workspace.
          </li>
        </ol>

        <h3 className="mt-8 text-sm font-bold">Modules in one workspace</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {[
            { title: "Coding Assistant", desc: "Context-aware copilot that cites source files inline." },
            { title: "Onshape CAD", desc: "Mechanical ↔ software traceability from assemblies to code." },
            { title: "Engineering Notebook", desc: "Scope and design docs drive documentation and codegen." },
            { title: "Build Log", desc: "Hands-free capture of build-session decisions into log.md." },
            { title: "Autonomous Planner", desc: "Path import and parts catalog search for motion planning." },
            { title: "Match Intelligence", desc: "Postmortem from video and telemetry like incident review." },
          ].map((m) => (
            <div key={m.title} className="glass rounded-xl p-4">
              <p className="text-sm font-semibold">{m.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{m.desc}</p>
            </div>
          ))}
        </div>

        <p className="mt-8 text-sm text-[var(--muted)]">
          Upload your own <code className="rounded bg-[var(--elevated)] px-1.5 py-0.5 text-xs">.zip</code> repository
          to get the same experience with your team&apos;s robot — or explore the sample project without the guided tour.
        </p>
      </section>

      <footer className="mt-16 pb-8 text-center text-xs text-[var(--muted)]">
        One assistant. One engineering workspace. Every part of your robot.
      </footer>
    </main>
  );
}
