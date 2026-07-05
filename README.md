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
| Deploy | Netlify (`netlify.toml`; use Turso for the prod DB) |

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
