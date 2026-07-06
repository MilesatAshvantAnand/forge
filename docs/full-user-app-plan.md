# From Demo to Product: Multi-User Forge Implementation Plan

> Status: **planning document.** No application code changes are proposed as
> "done" here — this is the roadmap for turning Forge from a single, shared-
> state demo into a real multi-user, multi-team product. All file paths below
> are real paths in this repository as of writing.

---

## 0. Where Forge is today (the "normal site")

Forge currently works, ships, and demos well — but it has **no concept of a
user**. Everything is keyed by `projectId` alone, and every project is visible
and mutable by anyone who can reach the server. Concretely:

- **No authentication anywhere.** There is no `proxy.ts` (Next.js 16's renamed
  middleware — see `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`),
  no `src/lib/auth`, no session cookie, no login page. `Glob src/middleware.ts`
  returns nothing.
- **Global shared project list.** `GET /api/projects`
  (`src/app/api/projects/route.ts`) does `select().from(projects).limit(12)` —
  it returns *everyone's* projects to *everyone*. The home page
  (`src/app/page.tsx`) renders these under "Your projects," but they are not
  "yours" at all.
- **No authorization on any route.** Every handler under
  `src/app/api/projects/[id]/**` loads by id with zero ownership check:
  `src/app/api/projects/[id]/route.ts`, `.../conversations/route.ts`,
  `.../conversations/[cid]/messages/route.ts`, `.../resources/route.ts`,
  `.../files/route.ts`, `.../github/route.ts` (commit-back!), `.../onshape/route.ts`.
  Anyone who guesses/sees a project UUID can read its code, chat, resources, and
  **push commits to the linked GitHub repo** (`POST /api/projects/[id]/github`).
- **Integrations are project-scoped, not user-scoped.** OAuth tokens live in the
  `integrations` table keyed by `projectId` (`src/lib/db/schema.ts`,
  `src/lib/integrations/github.ts` `saveGitHubIntegration`). The OAuth `state`
  parameter is just the raw `projectId`
  (`src/app/api/auth/github/route.ts`, `.../onshape/route.ts`) — no CSRF token,
  no user binding. Access tokens are stored **in plaintext**.
- **Ephemeral persistence by default.** `src/lib/runtime-paths.ts` deliberately
  falls back to `/tmp/forge-data` on Vercel when Turso/Blob aren't configured,
  so a project created on one serverless instance vanishes on the next request.
  This is the exact problem that forced the demo to become a committed,
  seed-on-read snapshot (`src/lib/demo/seed.ts`, `src/lib/demo/demo-seed.json`).
- **Public blob storage.** `src/lib/storage.ts` uploads resource files with
  `access: "public"` to a guessable path (`projects/${projectId}/resources/...`).
  Fine for a demo; a privacy problem once a real team uploads its engineering
  notebook.

The good news: the foundations for the *data plane* already exist. The DB layer
(`src/lib/db/index.ts`) exposes a **single `await db.<query>()` abstraction**
over both `better-sqlite3` (local) and libSQL/Turso (prod), and
`src/lib/storage.ts` already abstracts disk vs Vercel Blob. Adding multi-user
support is mostly about adding an **identity plane** and **scoping** the
existing data plane to it — not rewriting it.

---

## 1. What a real "user site" has over the current demo

Each capability below is justified specifically for Forge: a *learning-focused
engineering tool used by student robotics teams (VEX/FTC/FRC)* — i.e. groups of
minors + an adult mentor, sharing one robot's worth of code, CAD, and notebooks,
often on shared/lab computers.

### 1.1 Per-user accounts & authentication
Today anyone is "everyone." A real product needs identities so a student can
have their own login, their work follows them across the team's shared lab
computers, and the mentor can be a distinct, accountable person.
**Why for Forge:** teams rotate members season to season; onboarding a new
student should mean "join the team," not "here's a shared link anyone can open."

### 1.2 Data isolation / multi-tenancy
Every row that is currently global (`projects`, `files`, `chunks`,
`conversations`, `chat_messages`, `resources`, `integrations`) must be scoped so
that Team A can never see Team B's robot. This is the single most important
change.
**Why for Forge:** at competition, teams are *rivals*. Leaking one team's
autonomous routines, CAD, or notebook to another is a competitive-integrity and
trust failure, not just a privacy bug.

### 1.3 Per-user (per-team) persistent projects
Projects must belong to an owner/team and survive cold starts and deploys —
backed by a durable DB (Turso) and durable blob storage, not `/tmp`.
**Why for Forge:** a build season is months long. The whole value prop ("Forge
already knows your robot") collapses if a project silently disappears.

### 1.4 Roles & permissions (team-based)
A VEX team = multiple students + at least one mentor. Forge needs at least three
roles: **owner** (team creator/mentor), **member** (student), and **viewer**
(read-only — e.g. a guest, a judge, an alumnus). Mentors can invite/remove
members, delete the project, and manage integrations; students can chat, upload
resources, and edit code; viewers can read.
**Why for Forge:** mentors are responsible adults who need administrative
control (and, realistically, oversight of minors' activity); students shouldn't
be able to disconnect the team's GitHub or delete the season's work.

### 1.5 Sharing & collaboration
Invite flows (email/link invites into a team), and optionally per-project share
links with a role. Multiple students working the same robot is the normal case.
**Why for Forge:** robotics is a *team* sport. The product must model "our
team's workspace," not "my personal sandbox."

### 1.6 Quotas & rate limits
Per-user and per-team caps on uploads (currently a hard 50 MB/zip in
`src/app/api/projects/upload/route.ts`), project count, and — importantly —
**LLM/embedding/STT/TTS usage**, which cost real money per call
(`src/lib/llm/provider.ts`, `src/lib/knowledge/exa.ts`, `src/lib/voice/*`).
**Why for Forge:** the AI calls are the cost center. Without per-tenant limits,
one team (or an abusive anonymous user) can run up the DashScope/Exa/ElevenLabs
bill for everyone. Rate limiting also protects the fire-and-forget indexing
pipeline (`runIndexingPipeline`) from being spammed.

### 1.7 Billing / plans (optional, later)
A free tier for teams (this is education) with generous-but-bounded AI usage,
and a paid tier for higher limits / private repos / more seats. Even if Forge
stays free, the *plan* abstraction is what enforces quotas.
**Why for Forge:** schools have budgets and procurement; a clean "Team Free" vs
"Team Pro" story is how this becomes sustainable without nickel-and-diming
students. This can be deferred — model `plan` on the team from day one, monetize
later.

### 1.8 Durable storage (DB + blob) instead of ephemeral `/tmp`
Make Turso and Vercel Blob **required** in production, and stop silently
degrading to `/tmp` (`src/lib/runtime-paths.ts`). Private blob access instead of
`access: "public"` (`src/lib/storage.ts`).
**Why for Forge:** see 1.3. Also, a team's notebook PDF sitting at a public,
guessable URL is unacceptable once it's real student work.

### 1.9 Session management
HttpOnly, Secure, SameSite cookies; expiry + refresh; "log out everywhere."
Next 16's guidance (bundled `authentication.md`) is DB-backed sessions with an
encrypted session id in the cookie.
**Why for Forge:** shared lab computers. A student must be able to log out and
know the next student on that machine can't act as them.

### 1.10 Audit / history
Who invited/removed whom, who deleted a project, who connected GitHub, who
pushed a commit. Forge already writes commits back to real repos
(`commitFileToGitHub`), so attribution matters.
**Why for Forge:** mentors supervising minors need accountability; "who pushed
that broken commit to our comp code the night before?" is a real question.

### 1.11 Security: authorization on every route
Every handler must verify (a) there is a session, and (b) the session's user is
a member of the team that owns the requested resource, with a sufficient role.
This is the "Data Access Layer (DAL)" pattern the bundled Next docs recommend
(`authentication.md` §"Creating a Data Access Layer").
**Why for Forge:** UUIDs are not secrets. Today a leaked project link = full
read/write. The GitHub commit-back route in particular is a remote-write
primitive that must be locked down.

### 1.12 Privacy
Minimal PII (email + display name), private-by-default resources, clear data
ownership/export/delete, and awareness that many users are minors.
**Why for Forge:** student data triggers real obligations (FERPA/COPPA-adjacent
expectations, school policies). Designing for "team owns its data, mentor can
export/delete" from the start avoids a painful retrofit.

---

## 2. Concrete implementation plan (phased)

### Tech choices (with rationale)

| Concern | Recommendation | Why for *this* repo |
|---|---|---|
| **Auth** | **Better Auth** (self-hosted, with the **organization plugin**) | It is TypeScript-first and **Drizzle-native**, so it writes its `user`/`session`/`account`/`organization`/`member`/`invitation` tables into the **same Turso/libSQL database** Forge already uses via `src/lib/db/index.ts` — preserving the single `db` abstraction and avoiding a second datastore. The organization plugin models VEX-team semantics (orgs, members, roles, invitations) out of the box. No per-MAU pricing — critical for student teams. Works with Next 16's `proxy.ts` + Node runtime. |
| Auth (alt. A) | **Clerk** | Fastest to ship, first-class Organizations UI, hosted. Trade-off: user/team data lives on Clerk's servers (not in Turso), so the "single db" story breaks and you sync via webhooks. Good fallback if you want auth solved in an afternoon. |
| Auth (alt. B) | **Auth.js v5** | Broadest OAuth provider set, but **no built-in org/role model** — you'd hand-roll teams/memberships/invites, which is most of the work here. Not recommended given Better Auth exists and is Drizzle-native. |
| **DB** | **Turso / libSQL** (already half-supported) | `src/lib/db/index.ts` already picks libSQL when `TURSO_DATABASE_URL` is set. Make it **required in prod**. Better Auth's Drizzle adapter targets the same DB. |
| **Blob** | **Vercel Blob** (already abstracted) | `src/lib/storage.ts` already switches to Blob when `BLOB_READ_WRITE_TOKEN` is set. Switch new uploads to private access + signed reads. |
| **Rate limiting** | **Upstash Redis** (or Vercel KV) | Per-user/per-team token buckets for AI routes. Stateless-friendly for serverless. |
| **Migrations** | Keep the repo's **`ensureColumn` pattern for local dev**, add an **idempotent Turso migration script** (evolve `scripts/init-turso-db.mjs`). Optionally adopt `drizzle-kit` (already a devDependency) later. |

> **Compatibility rule that governs every phase:** never break the single
> `await db.<query>()` codepath in `src/lib/db/index.ts`. All new tables go
> through the same Drizzle `schema` object; all new DDL is mirrored in **three
> places that must stay in sync**: `schema.ts` (types), `SCHEMA_SQL` in
> `index.ts` (local boot), and `scripts/init-turso-db.mjs` (remote provision).
> This triple is an existing wart; Phase 0 addresses it.

---

### Data model changes

Add identity/tenancy tables and thread a `teamId` (and `createdByUserId`)
through the existing rows.

**New tables (owned partly by Better Auth, partly by us):**

- Better Auth manages: `user`, `session`, `account` (OAuth/credential links),
  `verification`, and — via the organization plugin — `organization`,
  `member`, `invitation`. In Forge terms, **`organization` == a robotics team**.
  Consider naming the display concept "Team" in the UI while keeping Better
  Auth's `organization` table underneath.
- We add app-specific columns/tables as needed, e.g. `team` metadata
  (program: VEX/FTC/FRC, team number like "9999X", `plan`).

**Existing tables get scoped** (`src/lib/db/schema.ts`):

```ts
// projects: add ownership + tenancy
export const projects = sqliteTable("projects", {
  // ...existing columns...
  teamId: text("team_id"),          // organization/team id (nullable for demo + backfill)
  createdByUserId: text("created_by_user_id"),
  visibility: text("visibility").notNull().default("team"), // team | private | link
});

// integrations: move from project-only to user + team attribution
export const integrations = sqliteTable("integrations", {
  // ...existing columns (still projectId-scoped)...
  connectedByUserId: text("connected_by_user_id"),
  teamId: text("team_id"),
});
```

Child tables (`files`, `chunks`, `conversations`, `chat_messages`, `resources`)
stay keyed by `projectId`; they inherit tenancy transitively through the
project. Authorization checks resolve `projectId -> teamId -> membership`, so we
do **not** need to denormalize `teamId` onto every child row (though adding it
to `resources` and `chat_messages` later can speed up queries).

Add indexes: `idx_projects_team ON projects(team_id)`.

**Token encryption:** stop storing OAuth access/refresh tokens in plaintext in
`integrations`. Encrypt at rest (AES-GCM with a `SECRET`), decrypt in
`src/lib/integrations/github.ts` / `onshape.ts`.

---

### Migration approach (respecting the lightweight pattern)

The repo has two migration realities:

1. **Local dev (`better-sqlite3`)** — `src/lib/db/index.ts` runs `SCHEMA_SQL`
   (`CREATE TABLE IF NOT EXISTS ...`) on every boot, then applies
   `ensureColumn(...)` ALTERs for drift. **Extend this**: add the new
   `CREATE TABLE`s for Better Auth's tables (or let Better Auth's CLI generate
   them) and add `ensureColumn("projects", "team_id", "team_id TEXT")`, etc.
2. **Remote (Turso)** — provisioned once by `scripts/init-turso-db.mjs`
   (`npm run db:push:turso`). It is **not** re-run automatically, so schema
   changes need a deliberate step. Two options, in order of preference:
   - **Preferred:** make `scripts/init-turso-db.mjs` fully idempotent (it
     already uses `CREATE TABLE IF NOT EXISTS`) and add an `ALTER`-with-guard
     helper mirroring `ensureColumn` (query `PRAGMA table_info` over libSQL,
     add missing columns). Add the Better Auth tables' DDL here too. Re-running
     `npm run db:push:turso` becomes the standard "apply migrations to prod"
     command.
   - **Later:** adopt `drizzle-kit generate`/`migrate` (already a
     devDependency) with a `migrations/` folder for versioned, reviewable
     migrations. This is the clean long-term answer but is more machinery than
     the current project needs day one.

**Backfill:** existing rows have `team_id = NULL`. On first login after the
migration, offer to "claim" unowned projects into the user's new default team
(a one-time admin/backfill route), or treat `NULL`-team projects as
demo/legacy-only. The demo project (`DEMO_PROJECT_ID`) intentionally stays
`team_id = NULL` (see §4).

---

### How auth guards get added to existing routes

Create a **Data Access Layer** (`src/lib/auth/dal.ts`) per the bundled Next 16
`authentication.md`, wrapping Better Auth's session lookup with React `cache()`:

```ts
// src/lib/auth/dal.ts  (illustrative)
import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth"; // Better Auth instance

export const requireSession = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new UnauthorizedError();
  return session;
});

// Resolve project -> team -> membership; throw 403 if not a member.
export async function requireProjectAccess(
  projectId: string,
  minRole: "viewer" | "member" | "owner" = "viewer",
) {
  if (isDemoProjectId(projectId)) return DEMO_GRANT; // demo stays public read-only
  const session = await requireSession();
  // load project.teamId, then membership(session.user.id, teamId), compare role
}
```

Then each handler gains a two-line guard at the top. Example for the highest-
risk route, `POST /api/projects/[id]/github` (commit-back):

```ts
export async function POST(req, { params }) {
  const { id } = await params;
  await requireProjectAccess(id, "member"); // <-- new; 401/403 before any work
  // ...existing commit logic unchanged...
}
```

A **`proxy.ts`** at the repo root does *optimistic* redirects only (unauth users
hitting `/projects/*` → `/login`), per the docs' explicit warning that Proxy is
**not** the real security boundary — the DAL checks in each route/handler are.

---

### Phases

#### Phase 0 — Foundations & schema hygiene (no user-facing change)
**Goals:** de-risk everything downstream; unify the migration story.
- Consolidate the DDL triple (`schema.ts`, `SCHEMA_SQL`, `init-turso-db.mjs`):
  make `init-turso-db.mjs` idempotent with an `ensureColumn`-equivalent for
  libSQL so re-running it is the prod migration command.
- Add a `SECRET`/`SESSION_SECRET` env var and an AES-GCM helper
  (`src/lib/crypto.ts`) for encrypting integration tokens.
- Add `zod` for input validation (currently routes hand-parse JSON).
- **Files:** `src/lib/db/index.ts`, `scripts/init-turso-db.mjs`,
  `.env.example`, new `src/lib/crypto.ts`.

#### Phase 1 — Identity: auth + accounts
**Goals:** users can sign up, log in, log out; sessions persist.
- Install and configure **Better Auth** with the Drizzle adapter pointed at the
  existing `db`/`schema` (`src/lib/auth.ts`), plus GitHub social login (reuse
  `GITHUB_CLIENT_ID/SECRET`) and email/password.
- Mount its handler at `src/app/api/auth/[...all]/route.ts` (note: coexists with
  the existing `src/app/api/auth/github` and `.../onshape` integration routes —
  those are *integration connect* flows, distinct from *login*; keep them, but
  rename conceptually or move integration connects under
  `/api/integrations/*` to avoid confusion).
- Add `src/app/login/page.tsx` and `src/app/signup/page.tsx` (Server Actions +
  `useActionState`, per `authentication.md`).
- Add `src/lib/auth/dal.ts` (`requireSession`) and root `proxy.ts` for
  optimistic redirects.
- **Schema:** Better Auth's `user`/`session`/`account`/`verification` tables.
- **Tech rationale:** Better Auth keeps identity in Turso → the single `db`
  abstraction is preserved end to end.

#### Phase 2 — Tenancy: teams, memberships, roles
**Goals:** every project belongs to a team; members have roles.
- Enable Better Auth's **organization plugin** (orgs = teams; members;
  invitations; roles owner/member/viewer).
- Add `teamId` + `createdByUserId` + `visibility` to `projects`
  (`src/lib/db/schema.ts` + migrations both drivers).
- Set `teamId` on create in `src/app/api/projects/upload/route.ts` and
  `src/app/api/projects/github/route.ts` (from the caller's *active* team).
- Scope the list: `GET /api/projects` (`src/app/api/projects/route.ts`) filters
  by the user's team memberships instead of returning all 12 globally.
- Team switcher + "create team" UI (mentor creates the team, invites students).
- **Why now:** this is the multi-tenancy core (§1.2) and everything after
  depends on `projectId -> teamId`.

#### Phase 3 — Authorization on every route (the security phase)
**Goals:** no resource is reachable without membership + sufficient role.
- Implement `requireProjectAccess()` in the DAL and add guards to **all**
  `src/app/api/projects/[id]/**` handlers and `src/app/api/knowledge/search`,
  `src/app/api/voice/*`.
- Bind OAuth `state` to the user + a CSRF nonce (not just `projectId`) in
  `src/app/api/auth/github/route.ts` and `.../onshape/route.ts`; verify on
  callback. Attribute the integration to `connectedByUserId`.
- Gate destructive/admin ops (delete project, disconnect integration,
  commit-back) behind `owner`/`member` as appropriate.
- Encrypt integration tokens at rest (`integrations.access_token` etc.).
- **Why:** closes the "UUID = full access" hole (§1.11), incl. the commit-back
  RCE-adjacent write primitive.

#### Phase 4 — Durable storage & privacy hardening
**Goals:** production never uses `/tmp`; resources are private.
- Make Turso + Blob **required** in prod; fail loudly (or show a setup banner)
  instead of silently degrading in `src/lib/runtime-paths.ts`.
- Switch new uploads in `src/lib/storage.ts` from `access: "public"` to private,
  and serve via short-lived signed URLs / a proxied
  `GET /api/projects/[id]/resources/[rid]/file` route that first calls
  `requireProjectAccess`.
- **Why:** delivers §1.8/§1.12 and structurally retires the ephemeral-storage
  problem that birthed the demo-seed workaround.

#### Phase 5 — Quotas, rate limits, audit
**Goals:** protect the AI cost center; make actions accountable.
- Add per-team/user token buckets (Upstash) on the AI routes
  (`.../conversations/[cid]/messages`, `knowledge/search`, `voice/*`) and on
  `projects/upload` + `projects/github` (indexing).
- Add an `audit_log` table (actor, action, target, team, ts) and write entries
  for invites, role changes, deletes, integration connect, and commit-back.
- Add `plan` on team + enforce project/upload/AI limits by plan (billing can
  come later — Stripe/LemonSqueezy — but the enforcement hooks exist now).
- **Why:** §1.6, §1.7, §1.10.

#### Phase 6 (optional) — Collaboration polish & billing
Invite-by-email UI, per-project share links with role, "log out everywhere,"
data export/delete (privacy §1.12), and a real billing integration if/when a
paid tier is introduced.

---

## 3. Deployment / infra

Cross-referenced with `.env.example` and `README.md` (§"Deploying to Vercel").

### Turso (libSQL)
- Already the intended prod DB. `src/lib/db/index.ts` selects it when
  `TURSO_DATABASE_URL` is set; `README.md` documents `npm run db:push:turso`.
- **Change:** run the (now idempotent) `scripts/init-turso-db.mjs` on every
  schema change; it provisions Forge's tables **and** Better Auth's tables.
- Make it required in prod (Phase 4): if `process.env.VERCEL` and no
  `TURSO_DATABASE_URL`, surface a clear error rather than falling back to
  `/tmp` (`src/lib/runtime-paths.ts`).

### Vercel Blob
- Already abstracted in `src/lib/storage.ts` behind `BLOB_READ_WRITE_TOKEN`.
- **Change:** required in prod; new writes use private access + signed/proxied
  reads.

### Required env vars (additions to `.env.example`)
```bash
# ── Auth (Better Auth) ──────────────────────────────────────
BETTER_AUTH_SECRET=            # openssl rand -base64 32
BETTER_AUTH_URL=               # = NEXT_PUBLIC_APP_URL in prod
SESSION_SECRET=                # if any custom session/crypto helper is used
INTEGRATION_TOKEN_KEY=         # AES-GCM key for encrypting stored OAuth tokens

# ── Rate limiting (Phase 5) ─────────────────────────────────
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```
Existing vars that become **required in prod**: `TURSO_DATABASE_URL`,
`TURSO_AUTH_TOKEN`, `BLOB_READ_WRITE_TOKEN`, `NEXT_PUBLIC_APP_URL`
(already used for OAuth redirect URIs). `GITHUB_CLIENT_ID/SECRET` now do
double duty: GitHub *login* (Phase 1) and per-project GitHub *integration*
(existing) — they can be the same OAuth app with multiple callback URLs, or two
apps.

### How this supersedes the ephemeral-storage demo problem
The demo exists as a committed, seed-on-read snapshot **because** runtime writes
don't survive on Vercel without Turso/Blob (`src/lib/demo/seed.ts` docstring,
`src/lib/runtime-paths.ts`). Once Turso + Blob are required and every real
project is written to them, **real projects persist for real** — the
seed-on-read hack is no longer needed for anything except the intentionally
anonymous demo (next section).

---

## 4. How demo mode coexists with the multi-user app

Keep the demo as the **anonymous, unauthenticated on-ramp**; layer auth
*around* it, not *through* it.

- **Demo project stays public + read-only + team-less.** `DEMO_PROJECT_ID`
  (`src/lib/demo/constants.ts`) keeps `team_id = NULL`. `requireProjectAccess()`
  short-circuits for `isDemoProjectId(id)` (already a helper in
  `src/lib/demo/seed.ts`) and grants **read-only** access without a session, so
  `/demo` and the seeded project work with zero login — preserving the "5-minute
  judge demo, no account required" flow on `src/app/page.tsx`.
- **Writes to the demo are blocked or ephemeral.** For anonymous demo users,
  make chat/upload against the demo either disabled or scoped to a throwaway
  session (never persisted to the shared demo rows). This prevents anonymous
  users from mutating the shared demo (a latent issue today, since
  `POST .../messages` writes to the demo conversation with no guard).
- **Authenticated users get real, isolated projects.** After login, uploads and
  GitHub imports create `team_id`-scoped projects on the normal write path
  (Turso/Blob), fully isolated per §1.2 — exactly what `src/lib/demo/seed.ts`
  already anticipates ("Real multi-user projects still use the normal write
  path").
- **Home page adapts to auth state.** `src/app/page.tsx` shows "Try the demo /
  Explore sample" for anonymous visitors and the team's real project list
  (from the now-scoped `GET /api/projects`) once logged in.
- **Optional "graduate the demo" nudge.** After the demo tour, prompt "Create a
  team to upload your own robot" → signup → Phase 2 team creation.

Net: the demo remains a frictionless, shared, read-only artifact; real work
happens in authenticated, team-isolated, durably-stored projects. The two paths
share the same DB abstraction and the same code, differentiated only by the
`isDemoProjectId` short-circuit in the DAL.

---

## 5. Summary — recommended stack & phase ordering

**Recommended stack**
- **Auth:** **Better Auth** + its **organization plugin** (Drizzle-native →
  identity lives in the same Turso DB, no per-seat pricing, models VEX teams
  natively). *Fallback: Clerk if you want it done in an afternoon and accept
  hosted user data.*
- **DB:** **Turso / libSQL** (already half-wired in `src/lib/db/index.ts`), made
  required in prod, migrated via an idempotent `scripts/init-turso-db.mjs`
  (keep local `ensureColumn` for dev).
- **Files:** **Vercel Blob** (already in `src/lib/storage.ts`), switched to
  private access + signed/proxied reads.
- **Authz:** a **DAL** (`src/lib/auth/dal.ts`) with `requireProjectAccess()`
  called in every route handler; `proxy.ts` for optimistic redirects only.
- **Limits/observability:** **Upstash Redis** rate limits on AI routes + an
  `audit_log` table.
- **Cross-cutting invariant:** never break the single `await db.<query>()`
  abstraction; mirror all DDL across `schema.ts`, `SCHEMA_SQL`, and
  `init-turso-db.mjs`.

**Phase ordering**
0. Foundations & schema-migration hygiene (crypto, zod, idempotent Turso migrate).
1. **Identity** — Better Auth accounts, sessions, login/signup, DAL skeleton.
2. **Tenancy** — teams/orgs, memberships, roles; add `teamId` to `projects`; scope the project list.
3. **Authorization** — `requireProjectAccess()` on every route; secure OAuth `state`; encrypt tokens. *(highest security value)*
4. **Durable storage & privacy** — require Turso+Blob, private resources, retire `/tmp` fallback.
5. **Quotas, rate limits, audit** — protect the AI cost center; accountability.
6. *(optional)* collaboration polish + billing.

Do 1→2→3 as the critical path (that's what turns the demo into a real
multi-user product); 0 de-risks them; 4 removes the ephemeral-storage class of
bug entirely; 5–6 harden and monetize. The demo stays a public, read-only
anonymous on-ramp throughout, isolated from real team data by a single
`isDemoProjectId` short-circuit in the DAL.
