import unzipper from "unzipper";
import { mkdirSync, writeFileSync } from "fs";
import { dirname, join, normalize } from "path";

const SKIP_DIRS = [
  "node_modules",
  ".git",
  ".vscode",
  "__pycache__",
  "build",
  "bin",
  ".DS_Store",
  "firmware",
];

const TEXT_EXTENSIONS = new Set([
  ".cpp", ".hpp", ".c", ".h", ".cc", ".hh", ".java", ".py", ".ts", ".js",
  ".json", ".md", ".txt", ".mk", ".cfg", ".ini", ".yaml", ".yml", ".toml",
  ".gradle", ".pros", ".cmake", ".xml", ".properties",
]);

export interface ExtractedFile {
  path: string;
  content: string;
  size: number;
}

function shouldSkip(path: string): boolean {
  const parts = path.split("/");
  return parts.some((p) => SKIP_DIRS.includes(p)) || parts.some((p) => p.startsWith("."));
}

function isTextFile(path: string): boolean {
  const dot = path.lastIndexOf(".");
  if (dot === -1) return /makefile$/i.test(path);
  return TEXT_EXTENSIONS.has(path.slice(dot).toLowerCase());
}

export async function extractZip(
  zipBuffer: Buffer,
  destDir: string
): Promise<ExtractedFile[]> {
  const directory = await unzipper.Open.buffer(zipBuffer);
  const extracted: ExtractedFile[] = [];

  // Strip a single common root folder (GitHub-style zips)
  const roots = new Set(
    directory.files
      .filter((f) => f.type === "File")
      .map((f) => f.path.split("/")[0])
  );
  const commonRoot = roots.size === 1 ? [...roots][0] : null;

  for (const entry of directory.files) {
    if (entry.type !== "File") continue;

    let relPath = entry.path;
    if (commonRoot && relPath.startsWith(commonRoot + "/")) {
      relPath = relPath.slice(commonRoot.length + 1);
    }
    if (!relPath || shouldSkip(relPath) || !isTextFile(relPath)) continue;
    // Prevent zip-slip path traversal
    const safe = normalize(relPath);
    if (safe.startsWith("..") || safe.includes("../")) continue;
    if (entry.uncompressedSize > 1_000_000) continue;

    const buf = await entry.buffer();
    const content = buf.toString("utf-8");
    const outPath = join(destDir, safe);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, content);
    extracted.push({ path: safe, content, size: buf.length });
  }

  return extracted;
}

export function detectLanguage(path: string): string {
  const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  const map: Record<string, string> = {
    cpp: "cpp", cc: "cpp", hpp: "cpp", h: "cpp", c: "c",
    java: "java", py: "python", ts: "typescript", js: "javascript",
    json: "json", md: "markdown", mk: "makefile", cmake: "cmake",
    yaml: "yaml", yml: "yaml", toml: "toml", gradle: "groovy", xml: "xml",
  };
  return map[ext] ?? "text";
}
