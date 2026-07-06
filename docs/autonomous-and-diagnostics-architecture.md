# Autonomous Builder & Guided Diagnostic Assistant — Architecture

Status: **design** (demo works today; full implementation deferred). This doc
records the recommended approach so the platform can grow into it without
rework. It intentionally matches Forge's core principle:

> Forge is a mentor, not a code generator. VEX is about learning. Every
> feature guides the student to the answer instead of handing them one.

---

## 1. Autonomous Driving Builder

### What exists today
- `src/components/modules/AutonomousPlannerModule.tsx` — a field map, a
  `.jerryio` import button (currently just records the filename), a VEX parts
  search (Exa), and a list of detected `autonRoutines` from the indexed code.
- `runIndexingPipeline` already extracts `autonRoutines`, `pidControllers`,
  `constants`, and `subsystems` into `ProjectMetadata`.

### Best approach: a "path → reviewed routine" pipeline, student in the loop
The strongest, most learning-aligned design is **not** "click generate → get
code." It is a four-stage pipeline where the student authors the path and
Forge explains the translation to code, flags risks, and teaches the motion
model.

```
.jerryio / draw path      Forge parses waypoints        Student reviews &
   (student authors)  ──▶  + robot config from     ──▶  Forge explains each   ──▶  Apply to
                           indexed constants             segment + trade-offs        src/autons.cpp
                                                         (asks before writing)      (CodeEditBlock)
```

Stages:

1. **Path ingest (deterministic, no AI).** Parse the `.jerryio` JSON (it is a
   documented waypoint format: points with x/y/heading + control handles).
   Store as a `resource` of a new type `path` with the waypoint JSON in
   `metadata`. Render the real waypoints on the existing `FieldMap` SVG instead
   of the demo curves.
2. **Config binding.** Pull `wheelDiameter`, track width, `pidControllers`
   (kP/kD), and tracking-wheel setup from the already-indexed `ProjectMetadata`.
   This is what lets Forge reason in *this* robot's units, not generic ones.
3. **Guided translation.** When the student asks "turn this path into a
   routine," the assistant produces a routine **segment by segment**, and for
   each segment explains *why* (e.g. "this 90° arc at your kP=2.0 will likely
   overshoot ~4°; add a settle or lower kP"). It uses the existing
   clarifying-questions-first behavior in `system-prompt.ts`.
4. **Apply.** Emit the routine as an apply-able `CodeEditBlock`
   (`file=src/autons.cpp lines=…`) — the mechanism already exists — so the
   student sees the diff and accepts it deliberately.

### Data-model additions (extends current schema, no breaking changes)
- `resources.type` gains `path`; waypoint JSON lives in `resources.metadata`.
- Optional `path_runs` table later for sim/telemetry overlays (deferred).

### Why this is the right call
- Reuses `AutonomousPlannerModule`, `FieldMap`, `CodeEditBlock`, and the RAG
  system prompt — small surface area.
- The physics/units come from the student's real indexed config, so guidance
  is specific and *correct for their robot*, which is the whole differentiator.
- The student authors the path and approves every edit → learning preserved.

### Build order
1. `.jerryio` parser + render real waypoints on `FieldMap` (pure client/deterministic).
2. Store path as a `path` resource; surface it in the Artifacts hub.
3. Segment-by-segment guided translation prompt (extends `buildContextMessage`
   with a `path` intent).
4. Apply-to-file via existing `CodeEditBlock` + PATCH `/files`.

---

## 2. Guided Diagnostic Assistant ("plug the bot in")

### The criterion (from the user)
> "It can tell you what the issues are diagnosed — but not like it just finds
> them. It's an assistant, and VEX is all about learning, not AI-generated
> code. It should guide the student every step of the way, helping them
> diagnose it."

So the diagnostic tool must be a **Socratic troubleshooting flow**, not an
oracle. It narrows the problem *with* the student and teaches the reasoning.

### Does the current design match? Partially — and here's the gap
Forge already leans this way:
- `query-router.ts` has a `debug` intent (drift/oscillate/stall/overshoot…).
- `system-prompt.ts` rule #1 forces "gather before reasoning": ask 2–4
  clarifying questions before committing, share only a *preliminary* hypothesis,
  and state confidence.

**Gap:** there is no structured, resumable diagnostic *session* and no way to
ingest live robot signals. Today it's freeform chat. The feature turns that
ethos into a first-class, guided module.

### Architecture: a Diagnostic Session state machine
A new module `DiagnosticsModule` drives a decision-tree the student walks
through, with Forge asking one focused question at a time.

```
Symptom picked ─▶ Forge asks 1 question ─▶ student answers (or uploads signal)
      ▲                                              │
      └──────────  narrows hypothesis set  ◀─────────┘
                         │
             confidence high enough?
                    │            │
                   no ──▶ next question
                   yes ─▶ explain root cause + the reasoning + what to try,
                          then optional apply-able fix (student approves)
```

Components:

1. **Symptom taxonomy** (`src/lib/diagnostics/symptoms.ts`): a curated tree of
   common VEX failure modes (intake jam, auton drift, PID oscillation, brownout,
   motor overheat, odometry drift, disconnect). Each node has: guiding
   questions, what evidence to gather, and which indexed artifacts to inspect
   (constants, PID values, sensor config, match footage timestamps).
2. **Session store** (`diagnostic_sessions` table: id, projectId, symptom,
   transcript JSON, status). Resumable — a student can come back to it.
3. **Evidence inputs** — three tiers, most-to-least accessible:
   - *Self-report*: student answers Forge's questions (always available).
   - *Log paste / file*: PROS terminal output, brain screen error, a match
     video (ties into `MatchIntelligenceModule` timestamps).
   - *Live telemetry (future)*: the **Forge Local Agent** (see
     `docs/robot-deploy-architecture.md`) can stream motor temps, current,
     encoder deltas, and battery over serial. This is the "plug the bot in"
     endgame — the browser can't read USB/serial, so it requires the local
     agent bridge already documented for robot deploy.
4. **Guidance engine**: reuses the RAG + system prompt, but constrained by the
   current symptom node so it asks *one* good question at a time and never
   jumps to a code dump. The final step may offer a `CodeEditBlock`, but only
   after the student understands the cause.

### Data-model additions
- `diagnostic_sessions` table (new): `id, project_id, symptom, transcript,
  status, created_at, updated_at`. Mirrors the `integrations`/`resources`
  additive-migration pattern in `src/lib/db/index.ts`.
- No breaking changes; `ensureColumn`-style migration for local SQLite.

### Why this matches the criterion
- One question at a time + "state your reasoning and confidence" is already the
  house style; the module makes it structured and resumable instead of freeform.
- Fixes are *offered*, never auto-applied — the student always approves via
  `CodeEditBlock`.
- The "plug the bot in" live-signal path is explicitly routed through the Local
  Agent, keeping the serverless web app honest about what it can/can't do.

### Build order
1. `symptoms.ts` taxonomy + `DiagnosticsModule` UI (pick symptom → guided Q&A
   using existing chat + a constrained system prompt). Ships value immediately,
   no hardware.
2. `diagnostic_sessions` persistence + resume.
3. Log/screenshot/video evidence ingestion (reuse resource ingest + match module).
4. Live telemetry via Forge Local Agent (depends on robot-deploy work).

---

## Shared principles
- **Deterministic first, AI second.** Parse paths, bind real config, gather
  evidence deterministically; use the model for *explanation and guidance*, not
  as the source of truth.
- **Student authors and approves.** Every code change flows through
  `CodeEditBlock` with a visible diff.
- **Reuse the spine.** `ProjectMetadata`, RAG retrieval, the clarifying-first
  system prompt, `CodeEditBlock`, and the module shell already encode the
  mentor model — both features are extensions, not rewrites.
- **Be honest about the boundary.** Anything touching real hardware (serial,
  compile, upload, live telemetry) goes through the Forge Local Agent, never
  pretended in the serverless app.
