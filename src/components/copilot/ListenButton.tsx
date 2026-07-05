"use client";

import { useRef, useState } from "react";
import { Volume2, Square, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function ListenButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stop = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    setState("idle");
  };

  const play = async () => {
    setState("loading");
    try {
      const res = await fetch("/api/voice/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        // ElevenLabs not configured → browser TTS fallback
        const utterance = new SpeechSynthesisUtterance(
          text.replace(/```[\s\S]*?```/g, " code omitted. ").replace(/[*_#`]/g, "")
        );
        utterance.onend = () => setState("idle");
        speechSynthesis.speak(utterance);
        setState("playing");
        return;
      }
      const blob = await res.blob();
      const audio = new Audio(URL.createObjectURL(blob));
      audioRef.current = audio;
      audio.onended = stop;
      await audio.play();
      setState("playing");
    } catch {
      setState("idle");
    }
  };

  return (
    <button
      onClick={state === "playing" ? stop : state === "idle" ? play : undefined}
      title="Listen to this answer"
      className={cn(
        "flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-[var(--muted)] transition-colors hover:text-[var(--accent)]",
        state === "playing" && "text-[var(--accent)]"
      )}
    >
      {state === "loading" ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : state === "playing" ? (
        <Square className="h-3 w-3" />
      ) : (
        <Volume2 className="h-3 w-3" />
      )}
      {state === "playing" ? "Stop" : "Listen"}
    </button>
  );
}
