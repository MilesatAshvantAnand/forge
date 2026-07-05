import type { ExtractedFile } from "@/lib/indexer/zip-parser";

export interface CodeChunk {
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
}

const CHUNK_LINES = 60;
const OVERLAP_LINES = 10;
const MAX_CHUNKS = 200;

const PRIORITY_PATTERNS =
  /auton|odom|pid|drive|intake|config|constant|main|robot|chassis|subsystem/i;

export function chunkProject(fileList: ExtractedFile[]): CodeChunk[] {
  const codeFiles = fileList.filter((f) =>
    /\.(cpp|hpp|c|h|java|py|md)$/.test(f.path)
  );

  // Robotics-relevant files first so the chunk cap keeps the good stuff
  codeFiles.sort((a, b) => {
    const aP = PRIORITY_PATTERNS.test(a.path) ? 0 : 1;
    const bP = PRIORITY_PATTERNS.test(b.path) ? 0 : 1;
    return aP - bP;
  });

  const chunks: CodeChunk[] = [];
  for (const file of codeFiles) {
    if (chunks.length >= MAX_CHUNKS) break;
    const lines = file.content.split("\n");
    for (
      let start = 0;
      start < lines.length && chunks.length < MAX_CHUNKS;
      start += CHUNK_LINES - OVERLAP_LINES
    ) {
      const end = Math.min(start + CHUNK_LINES, lines.length);
      const content = lines.slice(start, end).join("\n").trim();
      if (content.length < 50) continue;
      chunks.push({
        filePath: file.path,
        startLine: start + 1,
        endLine: end,
        content,
      });
      if (end >= lines.length) break;
    }
  }
  return chunks;
}
