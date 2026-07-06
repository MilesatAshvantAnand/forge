# CAD Understanding — Phase 2 design sketch (System Map)

Phase 1 (shipped) gives Forge a *structural* view of a linked Onshape document:
the assembly/part-studio inventory stored in `resources.metadata` at link time,
a refresh path (`POST /api/projects/[id]/onshape` with `resourceId`), and an
"Open in Onshape" viewer fallback (Onshape blocks third-party iframing via
`X-Frame-Options: SAMEORIGIN` / `frame-ancestors`).

Phase 2 moves from "what tabs exist" to "what the robot is made of and how it
maps to code" — while staying a guide, not an author.

## 1. Part-by-part understanding

- Pull the BOM per assembly via Onshape's REST API
  (`/assemblies/d/{did}/w/{wid}/e/{eid}/bom`) and part metadata
  (`/parts/d/{did}/w/{wid}`): part names, quantities, materials, mass properties.
- Persist as a `cad_parts` snapshot (new table or expanded `resources.metadata`)
  keyed by the linked resource, with a `fetchedAt` for staleness.
- Surface in the module: expandable per-assembly part tree with counts.

## 2. VEX catalog matching

- Ship a small static catalog of VEX V5 components (motors, cartridges, wheels,
  sensors, structure) with name/size heuristics.
- Fuzzy-match BOM part names against the catalog ("Motor 11W", "Omni 3.25")
  to tag parts with canonical VEX SKUs and known specs (RPM, torque, dimensions).
- Unmatched parts stay untagged — no guessing; the student confirms matches.

## 3. Code cross-reference

- Reuse the existing subsystem detection (`ProjectMetadata.subsystems`) and the
  RAG index: match tagged motors/sensors to `pros::Motor`/port declarations in
  the indexed code.
- Output *pointers*, in the review-assistant spirit: "Intake motor in CAD has
  no matching motor declaration in code", "CAD has 6 drive motors, code
  configures 4".

## 4. System Map graph

- A graph view (`@xyflow/react` is already a dependency) with node types:
  CAD assembly → component (motor/sensor) → code file/symbol → notebook entry.
- Edges from: catalog matches (CAD↔component), code cross-reference
  (component↔code), and notebook review flags (entry↔component).
- Clicking a node deep-links: Onshape tab (new window), code editor file, or
  notebook section — making the map the navigation hub between modules.

## Sequencing

1. BOM fetch + parts snapshot (server, no UI risk)
2. Catalog + matching (pure TS, unit-testable like `src/lib/review/refine.ts`)
3. Cross-reference pointers in the CAD module
4. System Map graph view
