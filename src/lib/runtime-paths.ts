import { mkdirSync, accessSync, constants } from "fs";
import { resolve, dirname } from "path";

/**
 * On Vercel, the deployment bundle (`process.cwd()`, e.g. `/var/task`) is
 * read-only at runtime — attempting to `mkdir` there throws ENOENT/EROFS.
 * `/tmp` is the only directory serverless functions can always write to.
 *
 * Rather than trusting env vars alone (a misconfigured DATA_DIR/DATABASE_URL
 * pointing at the bundle directory would still crash), we actively probe
 * writability and fall back to /tmp whenever the configured/derived path
 * isn't usable. This is a stopgap so the app never crashes even without
 * Turso/Blob configured — data won't persist across cold starts without
 * those, but the app keeps working. Local dev is unaffected: `./data` is
 * writable there, so nothing changes.
 */

const TMP_DATA_DIR = "/tmp/forge-data";

function isWritable(dir: string): boolean {
  try {
    mkdirSync(dir, { recursive: true });
    accessSync(dir, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export function defaultDataDir(): string {
  const candidate = process.env.DATA_DIR
    ? resolve(process.env.DATA_DIR)
    : process.env.VERCEL
      ? TMP_DATA_DIR
      : resolve("./data");
  return isWritable(candidate) ? candidate : TMP_DATA_DIR;
}

export function defaultDatabasePath(): string {
  const candidate = process.env.DATABASE_URL
    ? resolve(process.env.DATABASE_URL.replace("file:", ""))
    : process.env.VERCEL
      ? `${TMP_DATA_DIR}/forge.db`
      : resolve("./data/forge.db");
  return isWritable(dirname(candidate)) ? candidate : `${TMP_DATA_DIR}/forge.db`;
}
