import type { ForgeModuleId } from "@/lib/modules/types";

/**
 * Lightweight voice command palette: a keyword/regex intent matcher over a
 * dictated transcript. Deliberately not an LLM call — commands must resolve
 * instantly and work offline. Unrecognized speech falls back to the chat
 * input (`dictate-to-chat`), so nothing the student says is ever lost.
 */
export type VoiceCommand =
  | { type: "switch-view"; view: "chat" | "editor" | ForgeModuleId }
  | { type: "open-artifacts" }
  | { type: "new-conversation" }
  | { type: "read-last-answer" }
  | { type: "dictate-to-chat"; text: string };

const VIEW_PATTERNS: { pattern: RegExp; view: "chat" | "editor" | ForgeModuleId }[] = [
  { pattern: /\b(code )?editor\b|\bopen (the )?code\b/, view: "editor" },
  { pattern: /\bchat\b|\bconversation\b/, view: "chat" },
  { pattern: /\bnotebook\b|\bengineering notes?\b/, view: "engineering-notebook" },
  { pattern: /\bcad\b|\bonshape\b/, view: "onshape-cad" },
  {
    pattern: /\b(autonomous|auton|path) planner\b|\bjerry\.?io\b|\bjrero\b/,
    view: "autonomous-planner",
  },
  { pattern: /\bbuild log\b/, view: "build-log" },
  { pattern: /\bmatch (intelligence|footage|analysis)\b/, view: "match-intelligence" },
];

export function matchVoiceCommand(transcript: string): VoiceCommand {
  const text = transcript.trim().toLowerCase().replace(/[.,!?]+$/, "");

  if (/\b(read|speak|play)\b.*\b(last|latest|previous)\b.*\b(answer|response|message|reply)\b/.test(text)) {
    return { type: "read-last-answer" };
  }

  if (/\b(new|start( a)?)\b.*\bconversation\b|\bnew chat\b/.test(text)) {
    return { type: "new-conversation" };
  }

  if (/\bartifacts?\b/.test(text)) {
    return { type: "open-artifacts" };
  }

  // Navigation intents require a navigation verb (or a bare surface name) so
  // that questions like "why does my editor..." don't hijack into a view switch
  const wantsNavigation =
    /\b(open|show|go to|switch to|take me to|bring up|view)\b/.test(text) ||
    text.split(/\s+/).length <= 3;

  if (wantsNavigation) {
    for (const { pattern, view } of VIEW_PATTERNS) {
      if (pattern.test(text)) return { type: "switch-view", view };
    }
  }

  return { type: "dictate-to-chat", text: transcript.trim() };
}
