"use client";

import { Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDictation } from "@/lib/voice/useDictation";

interface VoiceButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  title?: string;
  className?: string;
}

/**
 * Voice input: tries Wispr Flow via the backend proxy; if unconfigured,
 * falls back to the browser Web Speech API (see useDictation).
 */
export function VoiceButton({ onTranscript, disabled, title, className }: VoiceButtonProps) {
  const { recording, toggle } = useDictation({ onTranscript });

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={toggle}
      title={recording ? "Stop recording" : (title ?? "Ask with voice")}
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] transition-colors",
        recording
          ? "animate-pulse-soft border-red-500/50 bg-red-500/15 text-red-400"
          : "text-[var(--muted)] hover:text-[var(--foreground)]",
        disabled && "opacity-40",
        className
      )}
    >
      {recording ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
    </button>
  );
}
