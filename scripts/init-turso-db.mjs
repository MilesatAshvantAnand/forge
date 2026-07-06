// One-time (idempotent) schema setup for a Turso (libSQL) production database.
//
// Usage:
//   TURSO_DATABASE_URL=libsql://your-db.turso.io TURSO_AUTH_TOKEN=xxx \
//     node scripts/init-turso-db.mjs
//
// This script is safe to re-run — it uses CREATE TABLE IF NOT EXISTS for new
// tables and PRAGMA table_info + ALTER TABLE for new columns, so it is fully
// idempotent. Running it is the standard "apply migrations to prod" command.
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
  CREATE TABLE IF NOT EXISTS bot_profiles (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL DEFAULT 'My Robot',
    firmware_version TEXT,
    pros_kernel_version TEXT,
    brain_type TEXT NOT NULL DEFAULT 'V5',
    components TEXT NOT NULL DEFAULT '[]',
    rubric_version TEXT NOT NULL DEFAULT '1',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  -- Better Auth core tables
  CREATE TABLE IF NOT EXISTS user (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    email_verified INTEGER NOT NULL DEFAULT 0,
    image TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    is_anonymous INTEGER DEFAULT 0
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

/**
 * Idempotent ALTER TABLE helper for Turso.
 * Queries PRAGMA table_info and adds the column only if it's missing.
 */
async function ensureColumn(client, table, column, ddl) {
  const result = await client.execute(`PRAGMA table_info(${table})`);
  const exists = result.rows.some((row) => row.name === column);
  if (!exists) {
    console.log(`  + ALTER TABLE ${table} ADD COLUMN ${ddl}`);
    await client.execute(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

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

  // Create all tables (idempotent via IF NOT EXISTS)
  await client.executeMultiple(SCHEMA_SQL);
  console.log("Tables created or already existed.");

  // Idempotent column migrations for tables that may already exist in prod
  console.log("Applying column migrations...");
  await ensureColumn(client, "projects", "team_id", "team_id TEXT");
  await ensureColumn(client, "projects", "created_by_user_id", "created_by_user_id TEXT");
  await ensureColumn(client, "projects", "visibility", "visibility TEXT NOT NULL DEFAULT 'team'");
  await ensureColumn(client, "integrations", "connected_by_user_id", "connected_by_user_id TEXT");
  await ensureColumn(client, "integrations", "team_id", "team_id TEXT");
  await ensureColumn(client, "chat_messages", "conversation_id", "conversation_id TEXT");
  await ensureColumn(client, "chunks", "source_type", "source_type TEXT NOT NULL DEFAULT 'code'");
  await ensureColumn(client, "resources", "external_url", "external_url TEXT");
  await ensureColumn(client, "resources", "external_provider", "external_provider TEXT");
  await ensureColumn(client, "resources", "metadata", "metadata TEXT");
  await ensureColumn(client, "session", "active_organization_id", "active_organization_id TEXT");
  await ensureColumn(client, "user", "is_anonymous", "is_anonymous INTEGER DEFAULT 0");

  console.log("Done. Schema is up to date.");
  client.close();
}

main().catch((err) => {
  console.error("Turso schema setup failed:", err);
  process.exit(1);
});
