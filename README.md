# Forge

**The AI engineering workspace for competitive robotics.**

Forge is a conversational AI assistant where every conversation is grounded in
deep understanding of your team's robotics project. Generic AI starts every
conversation from zero — Forge never does. Before you ask a question, it
already knows your project structure, subsystems, libraries, autonomous
routines, constants, hardware configuration, and attached engineering
documents.

Think **Claude Projects + Cursor + Onshape + Engineering Notebook**, built
specifically for VEX, FTC, and FRC teams.

## How it works

1. **Create a project** by uploading your code repository (.zip). Forge indexes
   every file: it detects PROS, LemLib, OkapiLib, EZ-Template, WPILib, FTC SDK,
   Road Runner, and more — and extracts subsystems, constants, PID controllers,
   autonomous routines, and sensor configs.
2. **Attach context.** Engineering notebooks, PDFs, design docs, photos, and
   match footage all become project resources. Text-bearing documents are
   indexed into retrieval; everything is surfaced to the assistant.
3. **Converse.** The assistant behaves like a senior robotics mentor — it asks
   clarifying questions on diagnostic problems before reasoning, cites specific
   files inline (click any citation to open the code), states its confidence,
   and tells you which missing resources would improve its answer.

## Product surface

- **Sidebar** — conversations, project context (attached resources), future
  modules (Onshape CAD, Engineering Notebook, Match Intelligence, Autonomous
  Planner)
- **Main** — the conversation: minimal, Claude-style, voice in (Wispr Flow /
  Web Speech) and voice out (ElevenLabs / browser TTS)
- **Right panel** — live project understanding: architecture summary,
  libraries, subsystems, autonomous routines, PID gains, sensors, files
- **File drawer** — click any cited file to read it with syntax highlighting

## Stack

| Layer | Tech |
|---|---|
| App | Next.js 16, React 19, Tailwind 4, Framer Motion |
| Data | Drizzle + SQLite (conversations, resources, RAG chunks) |
| AI | Qwen (DashScope) chat + embeddings, Exa web grounding, Wispr Flow STT, ElevenLabs TTS |
| Ingestion | ZIP repository indexer, pdf-parse, markdown/text chunking |
| Deploy | Vercel (zero-config Next.js build); Turso (libSQL) for the prod DB |

## Getting started

```bash
npm install
cp .env.example .env.local   # add DASHSCOPE_API_KEY (required for chat) and EXA_API_KEY (recommended)
npm run dev
```

Open http://localhost:3000 and create a project. A sample VEX project is
bundled at `samples/sample-robot.zip`.

Without API keys, indexing, project understanding, and keyword retrieval all
work — only AI conversation requires a key.

## Deploying to Vercel

Forge builds on Vercel with zero extra config (`next build` / `next start`,
detected automatically). Two things matter for production:

1. **Database.** Vercel's serverless functions have an ephemeral filesystem,
   so the default local `better-sqlite3` file does **not** persist across
   requests or deployments. Set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`
   in the Vercel project's environment variables to switch to
   [Turso](https://turso.tech) (libSQL) — `src/lib/db/index.ts` picks the
   driver automatically based on whether `TURSO_DATABASE_URL` is set, so
   local dev (`npm run dev`) is unaffected. After creating a Turso database,
   run the one-time schema setup once against it:

   ```bash
   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npm run db:push:turso
   ```

   Without Turso configured, the app still builds and runs on Vercel, but
   data will not reliably persist across cold starts/deployments.

2. **File uploads.** Ingested resources (PDFs, notebooks, ZIPs, CAD files)
   are currently written to a local `data/` directory
   (`src/lib/resources/ingest.ts`, `src/lib/indexer/pipeline.ts`). This has
   the same ephemeral-filesystem caveat as the database — uploaded files
   won't survive across serverless invocations on Vercel. This is a known
   limitation; migrating to an object store (e.g.
   [Vercel Blob](https://vercel.com/docs/storage/vercel-blob)) is recommended
   as a follow-up.

Required environment variables are listed in `.env.example`. At minimum, set
`DASHSCOPE_API_KEY` (chat) in the Vercel dashboard for AI conversation to
work; `EXA_API_KEY`, `WISPR_FLOW_API_KEY`, and `ELEVENLABS_API_KEY` are
optional feature enhancers.

## Architecture

```
src/
├── app/
│   ├── page.tsx                      # Project cards home
│   ├── projects/[id]/                # Conversation workspace
│   └── api/
│       ├── projects/upload           # Repository ingestion
│       └── projects/[id]/
│           ├── conversations/        # Conversation CRUD
│           ├── conversations/[cid]/messages  # Streaming chat (SSE)
│           ├── resources/            # Attach notebooks, PDFs, media
│           └── files/                # File content for the drawer
├── components/
│   ├── project/                      # Sidebar, ConversationView, ContextPanel, FileDrawer
│   ├── copilot/                      # Voice input/output buttons
│   └── workspace/                    # Indexing overlay
└── lib/
    ├── indexer/                      # ZIP parsing + robotics heuristics
    ├── resources/                    # Resource ingestion (pdf/md/media)
    ├── rag/                          # Chunking, retrieval, query routing
    ├── knowledge/                    # Exa integration
    ├── llm/                          # Qwen/OpenAI provider + consultant prompt
    ├── voice/                        # Wispr + ElevenLabs
    └── db/                           # Drizzle + SQLite
```

## Roadmap

| Module | Capability |
|---|---|
| 1 (now) | Engineering Assistant — repository understanding, context-aware conversations |
| 2 | Onshape integration — assemblies, parts, mates as engineering knowledge |
| 3 | Engineering Notebook — notebook indexing, sketches, automatic documentation |
| 4 | Match Intelligence — video, telemetry, failure investigation |
| 5 | Autonomous Planner — visual planning, simulation, AI-assisted routines |

Every future module feeds the same assistant. The user always talks to one
Forge — it just keeps getting smarter about their robot.
