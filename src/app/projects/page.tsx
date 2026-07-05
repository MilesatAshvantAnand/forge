"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Flame, Plus, FolderGit2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatRelativeTime } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

interface ProjectCard {
  id: string;
  name: string;
  status: string;
  createdAt: number;
  totalFiles: number;
  libraries: string[];
}

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectCard[] | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setProjects(d.projects ?? []))
      .catch(() => setProjects([]));
  }, []);

  const handleUpload = async (file: File) => {
    if (!file.name.endsWith(".zip")) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/projects/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (res.ok) router.push(`/projects/${data.projectId}`);
    setUploading(false);
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <div className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
          <Flame className="h-4 w-4 text-[var(--accent)]" />
          Forge
        </Link>
        <ThemeToggle showLabel />
      </div>
      <h1 className="mt-8 text-2xl font-semibold">Your projects</h1>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <label className="glass flex min-h-24 cursor-pointer flex-col justify-center gap-2 rounded-xl border-dashed p-5 hover:border-[var(--accent)]">
          <input
            type="file"
            accept=".zip"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
            }}
          />
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
          ) : (
            <Plus className="h-5 w-5 text-[var(--accent)]" />
          )}
          <span className="text-sm">New project</span>
        </label>
        {projects?.map((p) => (
          <Link
            key={p.id}
            href={`/projects/${p.id}`}
            className="glass flex min-h-24 flex-col justify-between rounded-xl p-5 hover:border-[var(--border-strong)]"
          >
            <div className="flex items-center gap-2">
              <FolderGit2 className="h-4 w-4 text-[var(--accent)]" />
              <p className="truncate text-sm font-medium">{p.name}</p>
            </div>
            <p className="text-xs text-[var(--muted)]">
              {p.totalFiles} files · {formatRelativeTime(p.createdAt)}
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}
