/**
 * Bot Gateway — bot profile CRUD.
 *
 * One profile per project (projects.id → bot_profiles.project_id is unique).
 * `components` is stored as a JSON string and parsed at the edge here so the
 * rest of the app only ever sees typed BotProfile objects.
 */

import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { BotComponent, BotProfile } from "./types";

type BotProfileRow = typeof schema.botProfiles.$inferSelect;

function parseComponents(json: string | null): BotComponent[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as BotComponent[]) : [];
  } catch {
    return [];
  }
}

function rowToProfile(row: BotProfileRow): BotProfile {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    firmwareVersion: row.firmwareVersion,
    prosKernelVersion: row.prosKernelVersion,
    brainType: row.brainType,
    components: parseComponents(row.components),
    rubricVersion: row.rubricVersion,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getBotProfile(projectId: string): Promise<BotProfile | null> {
  const row = await db
    .select()
    .from(schema.botProfiles)
    .where(eq(schema.botProfiles.projectId, projectId))
    .get();
  return row ? rowToProfile(row) : null;
}

export interface BotProfileInput {
  name?: string;
  firmwareVersion?: string | null;
  prosKernelVersion?: string | null;
  brainType?: string;
  components?: BotComponent[];
}

/** Creates or updates the project's single bot profile. */
export async function upsertBotProfile(
  projectId: string,
  input: BotProfileInput
): Promise<BotProfile> {
  const existing = await getBotProfile(projectId);
  const now = Date.now();

  if (existing) {
    await db
      .update(schema.botProfiles)
      .set({
        name: input.name ?? existing.name,
        firmwareVersion:
          input.firmwareVersion !== undefined
            ? input.firmwareVersion
            : existing.firmwareVersion,
        prosKernelVersion:
          input.prosKernelVersion !== undefined
            ? input.prosKernelVersion
            : existing.prosKernelVersion,
        brainType: input.brainType ?? existing.brainType,
        components: JSON.stringify(input.components ?? existing.components),
        updatedAt: now,
      })
      .where(eq(schema.botProfiles.projectId, projectId))
      .run();
    return (await getBotProfile(projectId))!;
  }

  await db
    .insert(schema.botProfiles)
    .values({
      id: randomUUID(),
      projectId,
      name: input.name ?? "My Robot",
      firmwareVersion: input.firmwareVersion ?? null,
      prosKernelVersion: input.prosKernelVersion ?? null,
      brainType: input.brainType ?? "V5",
      components: JSON.stringify(input.components ?? []),
      rubricVersion: "1",
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return (await getBotProfile(projectId))!;
}

export async function deleteBotProfile(projectId: string): Promise<void> {
  await db
    .delete(schema.botProfiles)
    .where(eq(schema.botProfiles.projectId, projectId))
    .run();
}
