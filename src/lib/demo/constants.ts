/** Fixed name so we reuse the same demo project across sessions */
export const DEMO_PROJECT_NAME = "VEX Team 9999X — Demo Robot";

/**
 * Fixed, deterministic id for the seeded demo project. Because the demo is
 * identical for everyone and seeded from a committed bundle, the id is stable
 * so any serverless instance serves the same URL (see src/lib/demo/seed.ts).
 */
export const DEMO_PROJECT_ID = "demo-forge-vex-9999x";

/** Display stats for judge demo — no framework/library names */
export const DEMO_PROJECT_STATS = {
  fileCount: 126,
  subsystems: 8,
  attachedResources: ["CAD model", "Engineering notebook", "Game rules PDF"],
  hasCad: true,
  hasNotebook: true,
};

export const KNOWLEDGE_GRAPH_NODES = [
  { id: "project", label: "Project" },
  { id: "code", label: "Code" },
  { id: "subsystems", label: "Subsystems" },
  { id: "libraries", label: "Libraries" },
  { id: "constants", label: "Constants" },
  { id: "autonomous", label: "Autonomous" },
  { id: "knowledge", label: "Engineering Knowledge" },
  { id: "ready", label: "Forge Ready" },
];

export const DEMO_DISCOVERIES = [
  "Mechanical subsystems",
  "Motion control parameters",
  "Sensor configurations",
  "Autonomous sequences",
  "Design documentation",
  "CAD assembly links",
];

export const DEMO_EXPLAIN_RESPONSE = `## Project Architecture — Demo Robot

Forge indexed **126 source files** across **8 subsystems** before you asked this question.

### Subsystems detected
| Subsystem | Source | Role |
|-----------|--------|------|
| **Drive** | \`src/main.cpp\` | Locomotion with odometry feedback |
| **Collection** | \`src/intake.cpp\` | Load handling with stall detection |
| **Autonomous** | \`src/autons.cpp\` | 3 pre-match sequences |

### Control parameters
- Lateral motion: kP=10.0, kD=3.0 (\`robotconfig.hpp\`)
- Angular motion: kP=2.0, kD=10.0
- Position feedback: tracking wheels + IMU

### Attached context
- Engineering notebook and project scope indexed
- Game rules PDF available for constraint questions

*Confidence: **high** — based on indexed source files and design documentation.*`;

export const DEMO_INTAKE_RESPONSE = `Before I answer — a few quick questions so I don't guess wrong:

1. **Has this always happened**, or did it start after a recent mechanical or software change?
2. **Does it fail during teleoperation, autonomous mode, or both?**
3. Do you have **photos or match footage** of the failure?

---

**Preliminary hypothesis** (medium confidence):

The collection control code (\`intake.cpp\`) reverses the motor when current exceeds **2200 mA**. Your engineering notebook notes a recent gear-ratio change and compression adjustment during physical testing.

Possible causes:
- **Mechanical compression too high** — gap tightened beyond design spec
- **Stall threshold too low** — false triggers under normal load
- **Geometry shift under load** — CAD notes a tipping issue when the arm extends; assembly alignment may change

Would you like me to inspect the **CAD assembly** for the roller path, or walk through the control code line by line?`;

export const FUTURE_MODULES = [
  { name: "Engineering Assistant", status: "live" as const },
  { name: "Onshape CAD", status: "live" as const },
  { name: "Engineering Notebook", status: "live" as const },
  { name: "Build Log", status: "live" as const },
  { name: "Match Intelligence", status: "live" as const },
  { name: "Autonomous Planner", status: "live" as const },
];

export const VISION_STEPS = [
  { label: "Today", text: "One assistant that already understands your entire project." },
  { label: "", text: "CAD linked to code and design documentation." },
  { label: "", text: "Build sessions captured hands-free into log.md." },
  { label: "", text: "Match footage cross-referenced with source and CAD." },
  { label: "", text: "Autonomous paths planned and implemented in one workspace." },
];
