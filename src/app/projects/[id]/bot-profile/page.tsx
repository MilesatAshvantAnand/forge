import { Suspense } from "react";
import { BotProfilePanel } from "@/components/project/BotProfilePanel";

export default async function BotProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center text-sm text-[var(--muted)]">
          Loading bot profile…
        </div>
      }
    >
      <BotProfilePanel projectId={id} />
    </Suspense>
  );
}
