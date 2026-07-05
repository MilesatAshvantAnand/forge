// One-time schema setup for a Turso (libSQL) production database.
//
// Usage:
//   TURSO_DATABASE_URL=libsql://your-db.turso.io TURSO_AUTH_TOKEN=xxx \
//     node scripts/init-turso-db.mjs
//
// This is intentionally separate from src/lib/db/index.ts: unlike the local
// better-sqlite3 file (recreated/checked on every boot), a remote database's
// schema should be provisioned once, not on every serverless cold start.
//
// Keep this DDL in sync with SCHEMA_SQL in src/lib/db/index.ts.
import { createClient } from "@libsql/client";

const SCHEMA_SQL = `
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
    external_url TEXT,
    external_provider TEXT,
    metadata TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_resources_project ON resources(project_id);
  CREATE TABLE IF NOT EXISTS integrations (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    expires_at INTEGER,
    metadata TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_integrations_project ON integrations(project_id);
`;

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    console.error(
      "TURSO_DATABASE_URL is not set. Export it (and TURSO_AUTH_TOKEN) before running this script."
    );
    process.exit(1);
  }

  const client = createClient({ url, authToken });
  console.log(`Provisioning Forge schema on ${url} ...`);
  await client.executeMultiple(SCHEMA_SQL);
  console.log("Done. Tables created (or already existed).");
  client.close();
}

main().catch((err) => {
  console.error("Turso schema setup failed:", err);
  process.exit(1);
});
