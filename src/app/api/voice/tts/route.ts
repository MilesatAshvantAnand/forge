import { NextRequest, NextResponse } from "next/server";
import { textToSpeech } from "@/lib/voice/elevenlabs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { text } = (await req.json()) as { text: string };

  if (!text?.trim()) {
    return NextResponse.json({ error: "No text provided" }, { status: 400 });
  }
  if (!process.env.ELEVENLABS_API_KEY) {
    return NextResponse.json({ error: "ElevenLabs not configured" }, { status: 503 });
  }

  // Strip markdown so TTS reads clean prose
  const clean = text
    .replace(/```[\s\S]*?```/g, " code block omitted. ")
    .replace(/[*_#`>\[\]]/g, "")
    .replace(/\(https?:\/\/[^)]+\)/g, "");

  const audio = await textToSpeech(clean);
  if (!audio) {
    return NextResponse.json({ error: "TTS failed" }, { status: 502 });
  }

  return new Response(audio, {
    headers: { "Content-Type": "audio/mpeg" },
  });
}
