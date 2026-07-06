import Database from "better-sqlite3";
import { drizzle as drizzleBetterSqlite3 } from "drizzle-orm/better-sqlite3";
import { createClient } from "@libsql/client";
import { drizzle as drizzleLibsql, type LibSQLDatabase } from "drizzle-orm/libsql";
import { mkdirSync } from "fs";
import { dirname } from "path";
import * as schema from "./schema";
import { defaultDatabasePath } from "@/lib/runtime-paths";

// Turso (libSQL) is used in production when TURSO_DATABASE_URL is configured.
// Vercel's serverless functions have an ephemeral, mostly read-only
// filesystem, so a local better-sqlite3 file does not persist across
// requests/deployments there. Local dev keeps using better-sqlite3 unchanged
// (`npm run dev` needs no extra setup) unless these env vars are set.
//
// Both drivers are exposed through the same drizzle query builder API, so
// every call site in the app uses `await db.<query>()` — a no-op await for
// the synchronous better-sqlite3 driver, and a real network round trip for
// the async libsql driver. This keeps one codepath for both environments.
//
// Turso setup (one-time, run after creating a Turso database):
//   npm run db:push:turso
// This creates the schema in the remote database. Local schema creation
// below (better-sqlite3 branch) still runs automatically on every boot,
// same as before.
export const useTurso = Boolean(process.env.TURSO_DATABASE_URL);

export const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'zip',
    status TEXT NOT NULL DEFAULT 'uploading',
    summary TEXT,
    metadata TEXT,
    index_progress TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    team_id TEXT,
    created_by_user_id TEXT,
    visibility TEXT NOT NULL DEFAULT 'team'
  );
  CREATE INDEX IF NOT EXISTS idx_projects_team ON projects(team_id);
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
    updated_at INTEGER NOT NULL,
    connected_by_user_id TEXT,
    team_id TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_integrations_project ON integrations(project_id);

  -- Better Auth core tables
  CREATE TABLE IF NOT EXISTS user (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    email_verified INTEGER NOT NULL DEFAULT 0,
    image TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS session (
    id TEXT PRIMARY KEY,
    expires_at INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    active_organization_id TEXT
  );
  CREATE TABLE IF NOT EXISTS account (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    access_token TEXT,
    refresh_token TEXT,
    id_token TEXT,
    access_token_expires_at INTEGER,
    refresh_token_expires_at INTEGER,
    scope TEXT,
    password TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS verification (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER,
    updated_at INTEGER
  );

  -- Better Auth organization plugin tables
  CREATE TABLE IF NOT EXISTS organization (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    logo TEXT,
    created_at INTEGER NOT NULL,
    metadata TEXT
  );
  CREATE TABLE IF NOT EXISTS member (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member',
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS invitation (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    expires_at INTEGER NOT NULL,
    inviter_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE
  );
`;

const globalForDb = globalThis as unknown as {
  __forgeSqlite?: InstanceType<typeof Database>;
  __forgeLibsqlClient?: ReturnType<typeof createClient>;
};

let db: LibSQLDatabase<typeof schema>;

if (useTurso) {
  const client =
    globalForDb.__forgeLibsqlClient ??
    createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  globalForDb.__forgeLibsqlClient = client;

  // Schema is provisioned once via `npm run db:push:turso`, not on every
  // cold start — unlike the local sqlite file, a remote DB shouldn't pay a
  // network round trip for CREATE TABLE IF NOT EXISTS on every boot.
  db = drizzleLibsql(client, { schema });
} else {
  const dbPath = defaultDatabasePath();

  mkdirSync(dirname(dbPath), { recursive: true });

  // Reuse a single connection across Next.js hot reloads
  const sqlite = globalForDb.__forgeSqlite ?? new Database(dbPath);
  globalForDb.__forgeSqlite = sqlite;

  // Wait instead of throwing SQLITE_BUSY when parallel workers open the DB
  sqlite.pragma("busy_timeout = 10000");
  sqlite.pragma("journal_mode = WAL");
  sqlite.exec(SCHEMA_SQL);

  // Lightweight migrations for existing dev databases.
  // Silently skips if the table doesn't exist (handles fresh-DB + existing-DB scenarios).
  function ensureColumn(table: string, column: string, ddl: string) {
    try {
      const cols = sqlite
        .prepare(`PRAGMA table_info(${table})`)
        .all() as { name: string }[];
      // PRAGMA returns empty array for non-existent tables — skip safely
      if (cols.length === 0) return;
      if (!cols.some((c) => c.name === column)) {
        sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
      }
    } catch {
      // Non-fatal — best-effort migration
    }
  }

  // Pre-existing migrations
  ensureColumn("chat_messages", "conversation_id", "conversation_id TEXT");
  ensureColumn("chunks", "source_type", "source_type TEXT NOT NULL DEFAULT 'code'");
  ensureColumn("resources", "external_url", "external_url TEXT");
  ensureColumn("resources", "external_provider", "external_provider TEXT");
  ensureColumn("resources", "metadata", "metadata TEXT");

  // Phase 0/2 migrations — new columns on existing tables
  ensureColumn("projects", "team_id", "team_id TEXT");
  ensureColumn("projects", "created_by_user_id", "created_by_user_id TEXT");
  ensureColumn("projects", "visibility", "visibility TEXT NOT NULL DEFAULT 'team'");
  ensureColumn("integrations", "connected_by_user_id", "connected_by_user_id TEXT");
  ensureColumn("integrations", "team_id", "team_id TEXT");

  // Phase 1 — Better Auth session extension
  ensureColumn("session", "active_organization_id", "active_organization_id TEXT");

  // better-sqlite3's drizzle driver returns values synchronously (not
  // Promises), but every call site in this app does `await db.<query>()`.
  // Awaiting a non-Promise value is a safe no-op in JS, so this cast lets
  // both drivers share one static type without changing local behavior.
  db = drizzleBetterSqlite3(sqlite, { schema }) as unknown as LibSQLDatabase<
    typeof schema
  >;
}

export { db, schema };
