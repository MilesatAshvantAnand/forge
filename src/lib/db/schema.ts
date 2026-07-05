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
});
