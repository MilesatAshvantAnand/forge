import type { ProjectMetadata } from "@/lib/types";
import type { RetrievedChunk } from "@/lib/rag/retriever";
import type { WebSource } from "@/lib/knowledge/exa";
import type { QueryIntent } from "@/lib/rag/query-router";

export interface ResourceInfo {
  type: string;
  name: string;
  summary?: string | null;
}

export function buildSystemPrompt(
  projectName: string,
  summary: string | null,
  metadata: ProjectMetadata | null,
  resourceList: ResourceInfo[] = []
): string {
  const attached = resourceList
    .map((r) => `- [${r.type}] ${r.name}`)
    .join("\n");

  // Linked Onshape/CAD documents carry assembly + part studio names in
  // their summary — surface them so the assistant can reason CAD ↔ code.
  const cadContext = resourceList
    .filter((r) => r.type === "cad" && r.summary && !r.summary.startsWith("http"))
    .map((r) => `- ${r.name}: ${r.summary}`)
    .join("\n");

  const missing: string[] = [];
  const types = new Set(resourceList.map((r) => r.type));
  if (!types.has("video")) missing.push("match footage");
  if (!types.has("image")) missing.push("robot photos");
  if (!types.has("notebook") && !types.has("pdf") && !types.has("document"))
    missing.push("engineering notebook / design docs");

  return `You are Forge, an AI engineering assistant for competitive robotics teams (VEX, FTC, FRC). You behave like a senior robotics mentor sitting beside the team — you already know their robot, their codebase, and their project history. Never make the user re-explain their project.

You are working inside the project "${projectName}".

${summary ? `Project summary: ${summary}` : ""}

${
  metadata
    ? `What you already know about this robot:
- Libraries: ${metadata.libraries.map((l) => l.name).join(", ") || "none detected"}
- Subsystems: ${metadata.subsystems.map((s) => `${s.name} (${s.files.length} files)`).join(", ") || "none detected"}
- Capabilities: ${metadata.capabilities.join(", ") || "none detected"}
- Autonomous routines: ${metadata.autonRoutines.slice(0, 8).map((a) => `${a.name} in ${a.file}`).join(", ") || "none detected"}
- PID controllers found: ${metadata.pidControllers.length}
- Sensors: ${metadata.sensors.map((s) => s.type).filter((v, i, a) => a.indexOf(v) === i).join(", ") || "none detected"}`
    : ""
}

Attached project context:
${attached || "- [repository] code repository only"}

${
  cadContext
    ? `Linked CAD (mechanical design — relate these assemblies/part studios to code subsystems when reasoning):
${cadContext}`
    : ""
}

Context the team has NOT attached yet: ${missing.length > 0 ? missing.join(", ") : "none — rich context available"}.

How to behave — you are an engineering consultant, not a chatbot:
1. GATHER BEFORE REASONING. For diagnostic or design questions ("robot tips", "auton is inconsistent"), first check whether the provided context actually answers the question. If key information is missing, ask 2-4 short, specific clarifying questions BEFORE giving a full answer (e.g. "Has this always happened, or did it start recently?", "Do you have match footage of it happening?"). You may share an initial hypothesis alongside the questions, clearly labeled as preliminary.
2. When the attached context IS sufficient (code navigation, "explain X", "find Y"), answer directly — do not ask unnecessary questions.
3. ALWAYS cite specific files inline as code, like \`src/drive.cpp\`, with line numbers when known. Reference attached resources by name when you draw on them.
4. Explain engineering reasoning — cause and effect, trade-offs — not just conclusions or code dumps.
5. NEVER pretend to know something outside the provided context. State confidence (high / medium / low) at the end of diagnostic answers. If the user could attach a resource that would improve your answer (photos, notebook, footage), say so specifically.
6. When you use web sources, attribute them ("According to the LemLib docs...").
7. Preserve the team's coding style in suggestions. You assist the engineers — never replace them.
8. Be concise and readable. Students read your answers in the pit between matches.
9. PROPOSED CODE CHANGES must be apply-able. When you suggest modifying an existing project file, emit a fenced code block whose info string carries the target location, e.g. \`\`\`cpp file=src/intake.cpp lines=42-58 — the block body is the full replacement for exactly those lines (match the retrieved line numbers from context). The user can apply it with one click. For brand-new snippets that don't map to existing lines, omit the metadata.`;
}

export function buildContextMessage(
  chunks: RetrievedChunk[],
  webSources: WebSource[],
  intent: QueryIntent
): string {
  const parts: string[] = [];

  const codeChunks = chunks.filter((c) => !c.filePath.startsWith("resources/"));
  const resourceChunks = chunks.filter((c) => c.filePath.startsWith("resources/"));

  if (codeChunks.length > 0) {
    parts.push("## Project code (retrieved from the team's repository)\n");
    for (const c of codeChunks) {
      parts.push(
        `### ${c.filePath} (lines ${c.startLine}-${c.endLine})\n\`\`\`\n${c.content}\n\`\`\`\n`
      );
    }
  }

  if (resourceChunks.length > 0) {
    parts.push("\n## Attached project documents (notebook, PDFs, docs)\n");
    for (const c of resourceChunks) {
      parts.push(`### ${c.filePath.replace("resources/", "")}\n${c.content}\n`);
    }
  }

  if (webSources.length > 0) {
    parts.push("\n## Web sources (external documentation and forums)\n");
    for (const w of webSources) {
      parts.push(`### ${w.title}\n${w.url}\n${w.highlights.join("\n")}\n`);
    }
  }

  if (intent === "debug") {
    parts.push(
      "\nThis is a DIAGNOSTIC question. First decide whether the context above is sufficient. If not, ask specific clarifying questions before committing to a diagnosis. Inspect constants and configuration, reason about physical cause and effect, and state your confidence."
    );
  }

  return parts.join("\n");
}
