"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseDictationOptions {
  onTranscript: (text: string) => void;
}

/**
 * Reusable dictation hook: records mic audio and transcribes it through
 * Wispr Flow (/api/voice/transcribe); when Wispr is not configured the
 * browser Web Speech API runs in parallel as an instant fallback, so voice
 * input degrades gracefully without any API keys.
 */
export function useDictation({ onTranscript }: UseDictationOptions) {
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const speechRecRef = useRef<any>(null);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const stop = useCallback(() => {
    mediaRecorderRef.current?.stop();
    speechRecRef.current?.stop();
    setRecording(false);
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const startWebSpeech = useCallback((SpeechRecognition: any) => {
    const rec = new SpeechRecognition();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.onresult = (e: {
      results: { [i: number]: { [j: number]: { transcript: string } } };
    }) => {
      const text = e.results[0][0].transcript;
      if (text) onTranscriptRef.current(text);
    };
    rec.onend = () => {
      speechRecRef.current = null;
    };
    rec.start();
    speechRecRef.current = rec;
  }, []);

  const start = useCallback(async () => {
    setRecording(true);

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
            onTranscriptRef.current(data.text);
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
  }, [startWebSpeech]);

  const toggle = useCallback(() => {
    if (recording) stop();
    else start();
  }, [recording, start, stop]);

  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stop();
      speechRecRef.current?.stop();
    };
  }, []);

  return { recording, start, stop, toggle };
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
