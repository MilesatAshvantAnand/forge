"use client";

import { useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDictation } from "@/lib/voice/useDictation";
import { matchVoiceCommand, type VoiceCommand } from "@/lib/voice/commands";

interface VoiceCommandButtonProps {
  onCommand: (command: VoiceCommand) => void;
}

/**
 * Voice command palette trigger. Speak a command like "open the editor",
 * "show the notebook", "go to artifacts", or "read the last answer" —
 * anything unrecognized lands in the chat input instead of being dropped.
 */
export function VoiceCommandButton({ onCommand }: VoiceCommandButtonProps) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { recording, toggle } = useDictation({
    onTranscript: (text) => {
      const command = matchVoiceCommand(text);
      onCommand(command);
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
      setFeedback(
        command.type === "dictate-to-chat" ? `"${text}" → chat` : `"${text}"`
      );
      feedbackTimer.current = setTimeout(() => setFeedback(null), 3000);
    },
  });

  return (
    <div className="relative flex shrink-0 items-center">
      <button
        type="button"
        onClick={toggle}
        title='Voice commands — try "open the editor" or "read the last answer"'
        className={cn(
          "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
          recording
            ? "animate-pulse-soft bg-red-500/15 text-red-400"
            : "text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--foreground)]"
        )}
      >
        {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        Voice
      </button>
      {feedback && (
        <span className="absolute left-0 top-full z-20 mt-1 max-w-64 truncate rounded-lg border border-[var(--border)] bg-[var(--elevated)] px-2.5 py-1.5 text-xs text-[var(--muted)] shadow-lg">
          {feedback}
        </span>
      )}
    </div>
  );
}
