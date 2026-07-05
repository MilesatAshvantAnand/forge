import { mkdirSync, writeFileSync, readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { defaultDataDir } from "@/lib/runtime-paths";

/**
 * Resource file storage abstraction.
 *
 * Local dev: files live under DATA_DIR (./data) on disk.
 * Production (Vercel): the filesystem is ephemeral, so when
 * BLOB_READ_WRITE_TOKEN is set, files are stored in Vercel Blob and
 * `storagePath` holds the blob URL instead of a filesystem path.
 */

const DATA_DIR = defaultDataDir();

export function blobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function isBlobUrl(storagePath: string): boolean {
  return storagePath.startsWith("https://");
}

/** Store a resource file; returns the storagePath to persist in the DB. */
export async function saveResourceFile(
  projectId: string,
  fileKey: string,
  buffer: Buffer
): Promise<string> {
  if (blobConfigured()) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`projects/${projectId}/resources/${fileKey}`, buffer, {
      access: "public",
      addRandomSuffix: false,
    });
    return blob.url;
  }

  const storageDir = join(DATA_DIR, "projects", projectId, "resources");
  mkdirSync(storageDir, { recursive: true });
  const storagePath = join(storageDir, fileKey);
  writeFileSync(storagePath, buffer);
  return storagePath;
}

/** Read a stored resource file from disk or Blob. Returns null if missing. */
export async function readResourceFile(storagePath: string): Promise<Buffer | null> {
  if (isBlobUrl(storagePath)) {
    try {
      const res = await fetch(storagePath);
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    } catch {
      return null;
    }
  }

  if (!existsSync(storagePath)) return null;
  try {
    return readFileSync(storagePath);
  } catch {
    return null;
  }
}

/** Best-effort write for non-resource files (e.g. edited repo files mirror). */
export function mirrorToDisk(relativePath: string, content: string) {
  try {
    const diskPath = join(DATA_DIR, relativePath);
    mkdirSync(dirname(diskPath), { recursive: true });
    writeFileSync(diskPath, content);
  } catch (err) {
    console.error("Disk mirror failed:", err);
  }
}
