import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { embedTexts } from "@/lib/llm/provider";

export interface RetrievedChunk {
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  score: number;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}

export async function retrieveChunks(
  projectId: string,
  query: string,
  topK = 8
): Promise<RetrievedChunk[]> {
  const rows = db
    .select()
    .from(schema.chunks)
    .where(eq(schema.chunks.projectId, projectId))
    .all();

  if (rows.length === 0) return [];

  const embedded = rows.filter((r) => r.embedding);

  // Vector search when embeddings exist, keyword fallback otherwise
  if (embedded.length > 0) {
    try {
      const [queryVec] = await embedTexts([query]);
      const scored = embedded.map((r) => ({
        filePath: r.filePath,
        startLine: r.startLine,
        endLine: r.endLine,
        content: r.content,
        score: cosineSimilarity(queryVec, JSON.parse(r.embedding!)),
      }));
      // Path keyword boost: query terms matching the file path rank higher
      const terms = query.toLowerCase().split(/\W+/).filter((t) => t.length > 3);
      for (const s of scored) {
        const pathLower = s.filePath.toLowerCase();
        if (terms.some((t) => pathLower.includes(t))) s.score += 0.08;
      }
      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, topK);
    } catch {
      // fall through to keyword search
    }
  }

  const terms = query.toLowerCase().split(/\W+/).filter((t) => t.length > 2);
  const scored = rows.map((r) => {
    const contentLower = r.content.toLowerCase();
    const pathLower = r.filePath.toLowerCase();
    let score = 0;
    for (const t of terms) {
      if (contentLower.includes(t)) score += 1;
      if (pathLower.includes(t)) score += 2;
    }
    return {
      filePath: r.filePath,
      startLine: r.startLine,
      endLine: r.endLine,
      content: r.content,
      score,
    };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.filter((s) => s.score > 0).slice(0, topK);
}
