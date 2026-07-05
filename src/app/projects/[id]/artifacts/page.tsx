import { Suspense } from "react";
import { ArtifactsHub } from "@/components/project/ArtifactsHub";

export default async function ArtifactsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center text-sm text-[var(--muted)]">
          Loading artifacts…
        </div>
      }
    >
      <ArtifactsHub projectId={id} />
    </Suspense>
  );
}
