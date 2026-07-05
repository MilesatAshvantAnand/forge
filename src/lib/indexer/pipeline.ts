import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { join, resolve } from "path";
import { extractZip, detectLanguage } from "./zip-parser";
import {
  detectLibraries,
  detectSubsystems,
  extractConstants,
  extractPidControllers,
  extractAutonRoutines,
  extractSensors,
  detectCapabilities,
} from "./robotics-detector";
import { buildFileTree, buildProjectGraph } from "./project-graph";
import { chunkProject } from "@/lib/rag/chunker";
import { embedTexts, chatCompletion, hasLlmConfigured } from "@/lib/llm/provider";
import type { IndexProgress, ProjectMetadata } from "@/lib/types";

const DATA_DIR = resolve(process.env.DATA_DIR ?? "./data");

function setProgress(projectId: string, progress: IndexProgress) {
  db.update(schema.projects)
    .set({
      indexProgress: JSON.stringify(progress),
      status: progress.progress >= 100 ? "ready" : "indexing",
      updatedAt: Date.now(),
    })
    .where(eq(schema.projects.id, projectId))
    .run();
}

export async function runIndexingPipeline(
  projectId: string,
  projectName: string,
  zipBuffer: Buffer
): Promise<void> {
  try {
    setProgress(projectId, {
      stage: "extract",
      progress: 5,
      message: "Extracting repository...",
    });

    const destDir = join(DATA_DIR, "projects", projectId);
    const extracted = await extractZip(zipBuffer, destDir);

    if (extracted.length === 0) {
      throw new Error("No readable source files found in the ZIP");
    }

    setProgress(projectId, {
      stage: "walk",
      progress: 20,
      message: `Reading ${extracted.length} files...`,
    });

    // Store file contents for the editor view
    const fileRows = extracted.map((f) => ({
      id: randomUUID(),
      projectId,
      path: f.path,
      language: detectLanguage(f.path),
      size: f.size,
      content: f.content,
    }));
    for (const row of fileRows) {
      db.insert(schema.files).values(row).run();
    }

    setProgress(projectId, {
      stage: "analyze",
      progress: 35,
      message: "Detecting libraries, subsystems, and PID controllers...",
    });

    const libraries = detectLibraries(extracted);
    const subsystems = detectSubsystems(extracted);
    const constants = extractConstants(extracted);
    const pidControllers = extractPidControllers(extracted);
    const autonRoutines = extractAutonRoutines(extracted);
    const sensors = extractSensors(extracted);
    const capabilities = detectCapabilities(extracted);

    const languages: Record<string, number> = {};
    for (const f of extracted) {
      const lang = detectLanguage(f.path);
      languages[lang] = (languages[lang] ?? 0) + 1;
    }

    const metadata: ProjectMetadata = {
      libraries,
      subsystems,
      constants,
      pidControllers,
      autonRoutines,
      sensors,
      capabilities,
      fileGraph: buildProjectGraph(projectName, subsystems, libraries),
      fileTree: buildFileTree(extracted),
      totalFiles: extracted.length,
      languages,
    };

    db.update(schema.projects)
      .set({ metadata: JSON.stringify(metadata), updatedAt: Date.now() })
      .where(eq(schema.projects.id, projectId))
      .run();

    setProgress(projectId, {
      stage: "chunk",
      progress: 55,
      message: "Chunking code for retrieval...",
    });

    const codeChunks = chunkProject(extracted);
    const chunkRows = codeChunks.map((c) => ({
      id: randomUUID(),
      projectId,
      filePath: c.filePath,
      startLine: c.startLine,
      endLine: c.endLine,
      content: c.content,
      embedding: null as string | null,
    }));

    if (hasLlmConfigured()) {
      setProgress(projectId, {
        stage: "embed",
        progress: 65,
        message: `Embedding ${chunkRows.length} chunks with Qwen...`,
      });
      try {
        const vectors = await embedTexts(
          codeChunks.map((c) => `// ${c.filePath}\n${c.content}`.slice(0, 6000))
        );
        vectors.forEach((v, i) => {
          chunkRows[i].embedding = JSON.stringify(v);
        });
      } catch (err) {
        console.error("Embedding failed, falling back to keyword search:", err);
      }
    }

    for (const row of chunkRows) {
      db.insert(schema.chunks).values(row).run();
    }

    setProgress(projectId, {
      stage: "summary",
      progress: 85,
      message: "Generating architecture summary...",
    });

    let summary: string | null = null;
    if (hasLlmConfigured()) {
      try {
        summary = await generateSummary(projectName, metadata);
      } catch (err) {
        console.error("Summary generation failed:", err);
      }
    }

    // Register the repository itself as the project's first context resource
    db.insert(schema.resources)
      .values({
        id: randomUUID(),
        projectId,
        type: "repository",
        name: `${projectName} (code repository)`,
        status: "ready",
        size: zipBuffer.length,
        storagePath: destDir,
        summary: `${extracted.length} source files indexed`,
        createdAt: Date.now(),
      })
      .run();

    db.update(schema.projects)
      .set({
        summary,
        status: "ready",
        indexProgress: JSON.stringify({
          stage: "done",
          progress: 100,
          message: "Project indexed",
        }),
        updatedAt: Date.now(),
      })
      .where(eq(schema.projects.id, projectId))
      .run();
  } catch (err) {
    console.error("Indexing failed:", err);
    db.update(schema.projects)
      .set({
        status: "error",
        indexProgress: JSON.stringify({
          stage: "error",
          progress: 0,
          message: err instanceof Error ? err.message : "Indexing failed",
        }),
        updatedAt: Date.now(),
      })
      .where(eq(schema.projects.id, projectId))
      .run();
  }
}

async function generateSummary(
  projectName: string,
  metadata: ProjectMetadata
): Promise<string> {
  const prompt = `You are a robotics software architect. Summarize this competitive robotics project in 3-5 sentences for an engineering dashboard. Be specific and technical.

Project: ${projectName}
Libraries: ${metadata.libraries.map((l) => l.name).join(", ") || "none detected"}
Subsystems: ${metadata.subsystems.map((s) => s.name).join(", ") || "none detected"}
Capabilities: ${metadata.capabilities.join(", ") || "none detected"}
Autonomous routines: ${metadata.autonRoutines.map((a) => a.name).slice(0, 10).join(", ") || "none detected"}
Total files: ${metadata.totalFiles}

Write only the summary, no preamble.`;

  return chatCompletion([{ role: "user", content: prompt }], { temperature: 0.4 });
}
