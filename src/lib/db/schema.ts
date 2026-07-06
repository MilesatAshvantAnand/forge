import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  source: text("source").notNull().default("zip"),
  status: text("status").notNull().default("uploading"),
  summary: text("summary"),
  metadata: text("metadata"),
  indexProgress: text("index_progress"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  // Multi-tenancy columns (Phase 2)
  teamId: text("team_id"),
  createdByUserId: text("created_by_user_id"),
  // visibility: "team" | "private" | "link"
  visibility: text("visibility").notNull().default("team"),
});

export const files = sqliteTable("files", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  path: text("path").notNull(),
  language: text("language"),
  size: integer("size").notNull(),
  content: text("content"),
});

export const chunks = sqliteTable("chunks", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  filePath: text("file_path").notNull(),
  startLine: integer("start_line").notNull(),
  endLine: integer("end_line").notNull(),
  content: text("content").notNull(),
  embedding: text("embedding"),
  // 'code' for repository chunks, 'resource' for attached docs/notebooks
  sourceType: text("source_type").notNull().default("code"),
});

export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  title: text("title").notNull().default("New conversation"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const chatMessages = sqliteTable("chat_messages", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  conversationId: text("conversation_id"),
  role: text("role").notNull(),
  content: text("content").notNull(),
  citations: text("citations"),
  createdAt: integer("created_at").notNull(),
});

export const resources = sqliteTable("resources", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  // repository | document | notebook | image | video | pdf | cad | other
  type: text("type").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("ready"),
  size: integer("size").notNull().default(0),
  storagePath: text("storage_path"),
  summary: text("summary"),
  // External artifact linking (Artifacts hub): where to view/edit this online
  externalUrl: text("external_url"),
  // onshape | github | other
  externalProvider: text("external_provider"),
  // Provider-specific JSON snapshot (e.g. Onshape document/assembly metadata)
  metadata: text("metadata"),
  createdAt: integer("created_at").notNull(),
});

export const integrations = sqliteTable("integrations", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  // onshape | github
  provider: text("provider").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  expiresAt: integer("expires_at"),
  // Provider-specific JSON (linked repo, linked document ids, account info)
  metadata: text("metadata"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  // Attribution columns (Phase 2)
  connectedByUserId: text("connected_by_user_id"),
  teamId: text("team_id"),
});

// ─── Bot Gateway ─────────────────────────────────────────────────────────────

/**
 * One bot profile per project: the source-of-truth description of the exact
 * robot (firmware, PROS kernel, brain, port map) that the Bot Gateway checks
 * generated code against. `components` is a JSON array of
 * { port, type, label, reversed?, gearset? } objects.
 */
export const botProfiles = sqliteTable("bot_profiles", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().unique(),
  name: text("name").notNull().default("My Robot"),
  firmwareVersion: text("firmware_version"),
  prosKernelVersion: text("pros_kernel_version"),
  brainType: text("brain_type").notNull().default("V5"),
  components: text("components").notNull().default("[]"),
  rubricVersion: text("rubric_version").notNull().default("1"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// ─── Better Auth tables ───────────────────────────────────────────────────────

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  // Anonymous plugin — true for auto-created guest identities
  isAnonymous: integer("is_anonymous", { mode: "boolean" }).default(false),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  // Organization plugin — active organization for this session
  activeOrganizationId: text("active_organization_id"),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

// ─── Better Auth organization plugin tables ───────────────────────────────────

export const organization = sqliteTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique(),
  logo: text("logo"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  metadata: text("metadata"),
});

export const member = sqliteTable("member", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  // owner | admin | member
  role: text("role").notNull().default("member"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const invitation = sqliteTable("invitation", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role"),
  status: text("status").notNull().default("pending"),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  inviterId: text("inviter_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});
