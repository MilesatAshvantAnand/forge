import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { db, schema } from "@/lib/db";
import { randomUUID } from "crypto";

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

  plugins: [organization()],

  databaseHooks: {
    user: {
      create: {
        /**
         * After a user signs up, automatically create a personal "team"
         * (Better Auth organization) for them and make them the owner.
         * This gives every new user an isolated workspace from day one.
         */
        after: async (user) => {
          try {
            const orgId = randomUUID();
            const now = new Date();
            // Derive a URL-safe slug from the user's name or email prefix
            const slugBase = (user.name ?? user.email.split("@")[0])
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "");
            const slug = `${slugBase}-${orgId.slice(0, 6)}`;

            await db.insert(schema.organization).values({
              id: orgId,
              name: user.name ? `${user.name}'s Team` : "My Team",
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
