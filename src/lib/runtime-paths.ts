import { resolve } from "path";

/**
 * On Vercel, the deployment bundle (`process.cwd()`, e.g. `/var/task`) is
 * read-only at runtime — attempting to `mkdir` there throws ENOENT/EROFS.
 * `/tmp` is the only writable directory available to serverless functions.
 *
 * This is a stopgap so the app never crashes even without Turso/Blob
 * configured: it keeps working, just without durable persistence across
 * cold starts (set TURSO_DATABASE_URL + BLOB_READ_WRITE_TOKEN for that).
 * Local dev is unaffected — `./data` is used unless DATA_DIR is set.
 */
export function defaultDataDir(): string {
  if (process.env.DATA_DIR) return resolve(process.env.DATA_DIR);
  if (process.env.VERCEL) return "/tmp/forge-data";
  return resolve("./data");
}

export function defaultDatabasePath(): string {
  if (process.env.DATABASE_URL) {
    return resolve(process.env.DATABASE_URL.replace("file:", ""));
  }
  if (process.env.VERCEL) return "/tmp/forge-data/forge.db";
  return resolve("./data/forge.db");
}
