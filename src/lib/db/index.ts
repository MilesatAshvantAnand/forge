import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "fs";
import { dirname, resolve } from "path";
import * as schema from "./schema";

const dbPath = resolve(
  process.env.DATABASE_URL?.replace("file:", "") ?? "./data/forge.db"
);

mkdirSync(dirname(dbPath), { recursive: true });

// Reuse a single connection across Next.js hot reloads
const globalForDb = globalThis as unknown as { __forgeDb?: Database.Database };

const sqlite = globalForDb.__forgeDb ?? new Database(dbPath);
globalForDb.__forgeDb = sqlite;

// Wait instead of throwing SQLITE_BUSY when parallel workers open the DB
sqlite.pragma("busy_timeout = 10000");
sqlite.pragma("journal_mode = WAL");
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'zip',
    status TEXT NOT NULL DEFAULT 'uploading',
    summary TEXT,
    metadata TEXT,
    index_progress TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    path TEXT NOT NULL,
    language TEXT,
    size INTEGER NOT NULL,
    content TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_files_project ON files(project_id);
  CREATE TABLE IF NOT EXISTS chunks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    file_path TEXT NOT NULL,
    start_line INTEGER NOT NULL,
    end_line INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding TEXT,
    source_type TEXT NOT NULL DEFAULT 'code'
  );
  CREATE INDEX IF NOT EXISTS idx_chunks_project ON chunks(project_id);
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT 'New conversation',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_conversations_project ON conversations(project_id);
  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    conversation_id TEXT,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    citations TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_chat_project ON chat_messages(project_id);
  CREATE TABLE IF NOT EXISTS resources (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ready',
    size INTEGER NOT NULL DEFAULT 0,
    storage_path TEXT,
    summary TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_resources_project ON resources(project_id);
`);

// Lightweight migrations for existing dev databases
function ensureColumn(table: string, column: string, ddl: string) {
  const cols = sqlite
    .prepare(`PRAGMA table_info(${table})`)
    .all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}
ensureColumn("chat_messages", "conversation_id", "conversation_id TEXT");
ensureColumn("chunks", "source_type", "source_type TEXT NOT NULL DEFAULT 'code'");

export const db = drizzle(sqlite, { schema });
export { schema };
