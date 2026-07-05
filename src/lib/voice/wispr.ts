export async function transcribeAudio(
  audioBase64: string,
  language = "en"
): Promise<string | null> {
  const apiKey = process.env.WISPR_FLOW_API_KEY;
  if (!apiKey) return null;

  const baseUrl = process.env.WISPR_FLOW_BASE_URL ?? "https://api.wisprflow.ai";

  const res = await fetch(`${baseUrl}/api`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      audio: audioBase64,
      language: [language],
      context: {
        app: { name: "Forge", type: "code" },
        dictionary: ["PID", "odometry", "LemLib", "PROS", "auton", "drivetrain", "VEX"],
      },
    }),
  });

  if (!res.ok) {
    console.error("Wispr transcription failed:", res.status, await res.text());
    return null;
  }
  const data = await res.json();
  return data.text ?? null;
}
