"use client";

/**
 * Speak text aloud: ElevenLabs via /api/voice/tts when configured,
 * otherwise the browser SpeechSynthesis API. Returns a stop function.
 */
export async function speakText(text: string): Promise<() => void> {
  const clean = text
    .replace(/```[\s\S]*?```/g, " code omitted. ")
    .replace(/[*_#`>\[\]]/g, "");

  try {
    const res = await fetch("/api/voice/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (res.ok) {
      const blob = await res.blob();
      const audio = new Audio(URL.createObjectURL(blob));
      await audio.play();
      return () => audio.pause();
    }
  } catch {
    // fall through to browser TTS
  }

  const utterance = new SpeechSynthesisUtterance(clean);
  speechSynthesis.speak(utterance);
  return () => speechSynthesis.cancel();
}
