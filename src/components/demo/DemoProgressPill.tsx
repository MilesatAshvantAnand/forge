"use client";

interface DemoProgressPillProps {
  step: number;
  total: number;
  label: string;
  onSkip: () => void;
}

export function DemoProgressPill({
  step,
  total,
  label,
  onSkip,
}: DemoProgressPillProps) {
  return (
    <div className="fixed bottom-4 left-4 z-[65] flex items-center gap-3 rounded-full border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-2 shadow-lg">
      <div className="flex flex-col">
        <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]">
          Demo · Step {step + 1}/{total}
        </span>
        <span className="text-xs font-medium text-[var(--foreground)]">{label}</span>
      </div>
      <button
        type="button"
        onClick={onSkip}
        className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[10px] text-[var(--muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
      >
        Skip demo
      </button>
    </div>
  );
}
