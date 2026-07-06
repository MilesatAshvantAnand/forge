// Builds a committed, read-only demo seed bundle from a locally-indexed demo
// project. On production (Vercel), the per-instance /tmp filesystem is
// ephemeral, so the demo project created in one request is invisible to the
// next request's serverless instance. Instead of relying on runtime writes,
// we bundle a deterministic snapshot that any instance can seed-on-read.
//
// Usage: node scripts/build-demo-seed.mjs
//   (requires a ready demo project in ./data/forge.db — hit POST /api/demo
//    locally first)

import Database from "better-sqlite3";
import { writeFileSync } from "fs";
import { resolve } from "path";

const DEMO_PROJECT_NAME = "VEX Team 9999X — Demo Robot";
const DEMO_PROJECT_ID = "demo-forge-vex-9999x";
const OUT = resolve("src/lib/demo/demo-seed.json");

const CANNED_SUMMARY = `A VEX V5 competition robot project spanning 8 subsystems and 126 indexed source files. The drivetrain uses odometry feedback (tracking wheels + IMU) with PID motion control; a collection subsystem handles game elements with current-based stall detection; and three autonomous routines are defined for match and skills play. Engineering notebook, game rules, and PID/odometry reference documents are attached as project context.`;

const db = new Database(resolve("data/forge.db"), { readonly: true });

const project = db
  .prepare("SELECT * FROM projects WHERE name = ? ORDER BY updated_at DESC LIMIT 1")
  .get(DEMO_PROJECT_NAME);

if (!project) {
  console.error(
    `No demo project named "${DEMO_PROJECT_NAME}" found in data/forge.db.\n` +
      "Run the dev server and POST /api/demo first, then retry."
  );
  process.exit(1);
}

const srcId = project.id;
const files = db.prepare("SELECT * FROM files WHERE project_id = ?").all(srcId);
const chunks = db.prepare("SELECT * FROM chunks WHERE project_id = ?").all(srcId);
const resources = db
  .prepare("SELECT * FROM resources WHERE project_id = ?")
  .all(srcId);

// Remap everything onto the fixed demo id and make resource files resolvable
// from the committed samples/ directory (bundled read-only with the deploy).
const remap = (rows) =>
  rows.map((r) => ({ ...r, project_id: DEMO_PROJECT_ID }));

const seededResources = resources.map((r) => {
  const base = { ...r, project_id: DEMO_PROJECT_ID };
  if (r.type === "repository") {
    // Repository storage dir is instance-local; editor reads from files table.
    base.storage_path = null;
  } else {
    // Point at the committed sample so any instance can read it.
    base.storage_path = `samples/${r.name}`;
  }
  return base;
});

const seed = {
  projectId: DEMO_PROJECT_ID,
  project: {
    ...project,
    id: DEMO_PROJECT_ID,
    source: "demo",
    status: "ready",
    summary: project.summary || CANNED_SUMMARY,
    index_progress: JSON.stringify({
      stage: "done",
      progress: 100,
      message: "Project indexed",
    }),
  },
  files: remap(files),
  chunks: remap(chunks),
  resources: seededResources,
};

writeFileSync(OUT, JSON.stringify(seed, null, 2));
console.log(
  `Wrote ${OUT}\n  files=${seed.files.length} chunks=${seed.chunks.length} resources=${seed.resources.length}`
);
