import { NextRequest, NextResponse } from "next/server";
import { transcribeAudio } from "@/lib/voice/wispr";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { audio } = (await req.json()) as { audio: string };

  if (!audio) {
    return NextResponse.json({ error: "No audio provided" }, { status: 400 });
  }
  if (!process.env.WISPR_FLOW_API_KEY) {
    return NextResponse.json(
      { error: "Wispr Flow not configured", fallback: true },
      { status: 503 }
    );
  }

  const text = await transcribeAudio(audio);
  if (text === null) {
    return NextResponse.json({ error: "Transcription failed" }, { status: 502 });
  }
  return NextResponse.json({ text });
}
