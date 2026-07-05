"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Flame, Loader2 } from "lucide-react";

export default function DemoPage() {
  const router = useRouter();
  const [status, setStatus] = useState("Starting interactive demo…");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const res = await fetch("/api/demo", { method: "POST" });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Demo failed to start");
          return;
        }

        const projectId = data.projectId as string;

        if (data.ready) {
          router.replace(`/projects/${projectId}?demo=1`);
          return;
        }

        setStatus("Building project knowledge…");
        router.replace(`/projects/${projectId}?demo=1`);
      } catch {
        if (!cancelled) setError("Could not reach the server");
      }
    }

    start();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 px-6">
        <p className="text-sm text-red-400">{error}</p>
        <Link href="/" className="text-xs text-[var(--accent)] underline">
          Back home
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 px-6">
      <Flame className="h-8 w-8 animate-pulse-soft text-[var(--accent)]" />
      <Loader2 className="h-5 w-5 animate-spin text-[var(--muted)]" />
      <p className="text-sm text-[var(--muted)]">{status}</p>
    </div>
  );
}
