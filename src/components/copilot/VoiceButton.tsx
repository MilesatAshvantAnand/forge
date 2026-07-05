"use client";

import { useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

/**
 * Voice input: tries Wispr Flow via the backend proxy; if unconfigured,
 * falls back to the browser Web Speech API.
 */
export function VoiceButton({ onTranscript, disabled }: VoiceButtonProps) {
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const speechRecRef = useRef<any>(null);

  const stopAll = () => {
    mediaRecorderRef.current?.stop();
    speechRecRef.current?.stop();
    setRecording(false);
  };

  const start = async () => {
    setRecording(true);

    // Web Speech API fallback path (works without Wispr keys)
    const SpeechRecognition =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: recorder.mimeType });
        const base64 = await blobToBase64(blob);
        const res = await fetch("/api/voice/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audio: base64 }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.text) {
            onTranscript(data.text);
            return;
          }
        }
        // Wispr unavailable → use Web Speech live recognition next time
        if (SpeechRecognition && !speechRecRef.current) {
          startWebSpeech(SpeechRecognition);
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;

      // Run Web Speech in parallel as instant fallback when Wispr is not configured
      if (SpeechRecognition) startWebSpeech(SpeechRecognition);
    } catch {
      setRecording(false);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const startWebSpeech = (SpeechRecognition: any) => {
    const rec = new SpeechRecognition();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.onresult = (e: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => {
      const text = e.results[0][0].transcript;
      if (text) onTranscript(text);
    };
    rec.onend = () => {
      speechRecRef.current = null;
    };
    rec.start();
    speechRecRef.current = rec;
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={recording ? stopAll : start}
      title={recording ? "Stop recording" : "Ask with voice"}
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] transition-colors",
        recording
          ? "animate-pulse-soft border-red-500/50 bg-red-500/15 text-red-400"
          : "text-[var(--muted)] hover:text-[var(--foreground)]",
        disabled && "opacity-40"
      )}
    >
      {recording ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
    </button>
  );
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.readAsDataURL(blob);
  });
}
