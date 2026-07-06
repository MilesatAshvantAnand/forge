import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { anonymous, organization } from "better-auth/plugins";
import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { randomUUID } from "crypto";

/**
 * When an anonymous user upgrades to a real account (email/password sign-up or
 * GitHub OAuth while holding an anonymous session), carry their workspace over:
 * every project/integration owned by the anonymous user's personal team is
 * re-pointed at the new user's default team, then the now-empty anonymous
 * teams are removed. Better Auth deletes the anonymous user itself afterwards.
 */
async function migrateAnonymousWorkspace(anonymousUserId: string, newUserId: string) {
  const anonMemberships = await db
    .select({ organizationId: schema.member.organizationId })
    .from(schema.member)
    .where(eq(schema.member.userId, anonymousUserId))
    .all();

  const anonOrgIds = anonMemberships.map((m) => m.organizationId);
  if (anonOrgIds.length === 0) return;

  // The new user's personal team was created by the user-create databaseHook,
  // which runs before this link hook.
  const newMembership = await db
    .select({ organizationId: schema.member.organizationId })
    .from(schema.member)
    .where(eq(schema.member.userId, newUserId))
    .get();
  const newTeamId = newMembership?.organizationId ?? null;

  if (!newTeamId) {
    // Fallback: no destination team (hook failed) — keep the anonymous teams
    // alive by making the new user their owner instead of moving data.
    const now = new Date();
    for (const orgId of anonOrgIds) {
      await db
        .insert(schema.member)
        .values({
          id: randomUUID(),
          organizationId: orgId,
          userId: newUserId,
          role: "owner",
          createdAt: now,
        })
        .run();
    }
    return;
  }

  await db
    .update(schema.projects)
    .set({ teamId: newTeamId, createdByUserId: newUserId })
    .where(inArray(schema.projects.teamId, anonOrgIds))
    .run();

  await db
    .update(schema.integrations)
    .set({ teamId: newTeamId, connectedByUserId: newUserId })
    .where(inArray(schema.integrations.teamId, anonOrgIds))
    .run();

  // Anonymous personal teams are single-member; they're empty now.
  await db
    .delete(schema.organization)
    .where(inArray(schema.organization.id, anonOrgIds))
    .run();
}

export const auth = betterAuth({
  // base URL — used for building callback / redirect URIs
  baseURL: process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET ?? "dev-secret-change-me-in-production",

  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      organization: schema.organization,
      member: schema.member,
      invitation: schema.invitation,
    },
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },

  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
      enabled: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
    },
  },

  // Long-lived, rolling sessions — anonymous visitors keep their workspace
  // across reloads for 60 days; each visit past `updateAge` extends it.
  session: {
    expiresIn: 60 * 60 * 24 * 60, // 60 days
    updateAge: 60 * 60 * 24, // refresh expiry at most once a day
  },

  plugins: [
    organization(),
    anonymous({
      // Anonymous emails look like temp-<id>@forge.anonymous (never routable)
      emailDomainName: "forge.anonymous",
      generateName: () => "Guest",
      onLinkAccount: async ({ anonymousUser, newUser }) => {
        try {
          await migrateAnonymousWorkspace(anonymousUser.user.id, newUser.user.id);
        } catch (err) {
          // Non-fatal: sign-up must not fail because migration hiccuped —
          // but the anonymous workspace would be lost, so log loudly.
          console.error("[auth] Failed to migrate anonymous workspace:", err);
        }
      },
    }),
  ],

  databaseHooks: {
    user: {
      create: {
        /**
         * After a user signs up, automatically create a personal "team"
         * (Better Auth organization) for them and make them the owner.
         * This gives every new user an isolated workspace from day one.
         * Fires for anonymous sign-ins too (the anonymous plugin creates
         * users through the same internal adapter), so guests get a team.
         */
        after: async (user) => {
          try {
            const isAnonymous = Boolean(
              (user as { isAnonymous?: boolean | null }).isAnonymous
            );
            const orgId = randomUUID();
            const now = new Date();
            // Derive a URL-safe slug from the user's name or email prefix
            const slugBase = (user.name ?? user.email.split("@")[0])
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "");
            const slug = `${slugBase || "team"}-${orgId.slice(0, 6)}`;

            await db.insert(schema.organization).values({
              id: orgId,
              name: isAnonymous
                ? "My Workspace"
                : user.name
                  ? `${user.name}'s Team`
                  : "My Team",
              slug,
              createdAt: now,
            }).run();

            await db.insert(schema.member).values({
              id: randomUUID(),
              organizationId: orgId,
              userId: user.id,
              role: "owner",
              createdAt: now,
            }).run();
          } catch (err) {
            // Non-fatal — user is created but without a default team
            console.error("[auth] Failed to create default team for new user:", err);
          }
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
