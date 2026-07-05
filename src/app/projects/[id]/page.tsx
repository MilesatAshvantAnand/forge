import { Suspense } from "react";
import { ProjectWorkspace } from "@/components/project/ProjectWorkspace";

function Workspace({ projectId }: { projectId: string }) {
  return <ProjectWorkspace projectId={projectId} />;
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center text-sm text-[var(--muted)]">
          Loading workspace…
        </div>
      }
    >
      <Workspace projectId={id} />
    </Suspense>
  );
}
