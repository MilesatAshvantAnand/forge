/**
 * Bot Gateway — firmware / kernel registry.
 *
 * A static, data-driven registry of known PROS kernel majors and VEXos
 * releases, with the API differences that matter for validating generated
 * C++ against the robot's actual firmware. This is deliberately plain data
 * (no logic) so entries can be enriched later from the official PROS docs
 * (https://pros.cs.purdue.edu) or the VEXos changelog without touching the
 * rubric engine — and eventually generated/updated automatically by the
 * docs-ingestion pipeline.
 */

export type ProsKernelMajor = "3" | "4";

/** A single API symbol/pattern with the kernel majors it exists in. */
export interface ApiAvailabilityRule {
  id: string;
  /** Regex source matched against code (applied with "g" + multiline). */
  pattern: string;
  /** Kernel majors where this API is available. */
  availableIn: ProsKernelMajor[];
  /** Kernel majors where the API still works but is deprecated (warning). */
  deprecatedIn?: ProsKernelMajor[];
  /** Human explanation shown when used on an incompatible kernel. */
  message: string;
  /** Suggested replacement, if any. */
  suggestion?: string;
  severity?: "error" | "warning";
}

export interface ProsKernelInfo {
  major: ProsKernelMajor;
  label: string;
  /** Example full versions users may pick. */
  knownVersions: string[];
  /** Minimum VEXos this kernel line expects. */
  minVexos?: string;
  notes: string[];
}

export interface VexosInfo {
  version: string;
  label: string;
  notes?: string;
}

// ─── Known PROS kernels ──────────────────────────────────────────────────────

export const PROS_KERNELS: ProsKernelInfo[] = [
  {
    major: "3",
    label: "PROS 3.x",
    knownVersions: ["3.8.3", "3.8.2", "3.8.0", "3.7.3", "3.6.2"],
    notes: [
      "Ships with the OkapiLib chassis/controller library (okapi::).",
      "pros::Motor constructor takes (port, gearset, reversed, encoder_units).",
      "Motor groups are pros::Motor_Group (underscore).",
      "ADI classes are flat: pros::ADIDigitalIn, pros::ADIAnalogIn, pros::ADIEncoder…",
      "Gearsets are C enums: pros::E_MOTOR_GEARSET_06 / _18 / _36.",
    ],
  },
  {
    major: "4",
    label: "PROS 4.x",
    knownVersions: ["4.2.1", "4.1.1", "4.1.0", "4.0.7"],
    minVexos: "1.1.0",
    notes: [
      "OkapiLib is removed — okapi:: does not exist in PROS 4 templates.",
      "pros::Motor constructor takes (signed port, gearset?) — reversal is a negative port, not a bool argument.",
      "Motor groups are pros::MotorGroup, constructed from a signed-port initializer list.",
      "ADI classes moved into pros::adi:: (pros::adi::DigitalIn…); the old flat names are deprecated aliases.",
      "Gearsets use pros::v5::MotorGears (green/red/blue); the C enums remain only in the C API.",
    ],
  },
];

// ─── Known VEXos releases ────────────────────────────────────────────────────

export const VEXOS_VERSIONS: VexosInfo[] = [
  { version: "1.1.5", label: "VEXos 1.1.5 (current)" },
  { version: "1.1.4", label: "VEXos 1.1.4" },
  { version: "1.1.3", label: "VEXos 1.1.3" },
  { version: "1.1.2", label: "VEXos 1.1.2" },
  { version: "1.1.0", label: "VEXos 1.1.0", notes: "Minimum for PROS 4 kernels." },
  { version: "1.0.13", label: "VEXos 1.0.13", notes: "Last 1.0.x line; PROS 3 only." },
];

// ─── API availability rules ──────────────────────────────────────────────────
//
// Each rule states where an API surface exists. The rubric flags a rule when
// the profile's kernel major is NOT in `availableIn` but the pattern matches.
// Patterns are heuristics over source text, not a parser — they're tuned to
// catch the common hallucinations (okapi on v4, bool-reversed Motor ctor on
// v4, pros::adi:: on v3, MotorGroup naming) rather than to be exhaustive.

export const API_RULES: ApiAvailabilityRule[] = [
  {
    id: "okapi-removed-v4",
    pattern: "\\bokapi::",
    availableIn: ["3"],
    message:
      "OkapiLib (okapi::) was removed in PROS 4 — this code only compiles on PROS 3.",
    suggestion: "Use the PROS 4 native APIs (pros::MotorGroup, pros::Imu) or LemLib.",
    severity: "error",
  },
  {
    id: "motor-group-underscore-v3-only",
    pattern: "\\bpros::Motor_Group\\b",
    availableIn: ["3"],
    message:
      "pros::Motor_Group (with underscore) is the PROS 3 name; PROS 4 renamed it to pros::MotorGroup.",
    suggestion: "Use pros::MotorGroup on PROS 4.",
    severity: "error",
  },
  {
    id: "motor-group-camel-v4-only",
    pattern: "\\bpros::MotorGroup\\b",
    availableIn: ["4"],
    message:
      "pros::MotorGroup is a PROS 4 API; PROS 3 uses pros::Motor_Group (with underscore).",
    suggestion: "Use pros::Motor_Group on PROS 3.",
    severity: "error",
  },
  {
    id: "adi-namespace-v4-only",
    pattern: "\\bpros::adi::\\w+",
    availableIn: ["4"],
    message:
      "The pros::adi:: namespace (e.g. pros::adi::DigitalIn) was introduced in PROS 4; PROS 3 uses flat names like pros::ADIDigitalIn.",
    suggestion: "Use pros::ADIDigitalIn / pros::ADIAnalogIn on PROS 3.",
    severity: "error",
  },
  {
    id: "adi-flat-deprecated-v4",
    pattern: "\\bpros::ADI[A-Z]\\w+",
    availableIn: ["3", "4"],
    deprecatedIn: ["4"],
    message:
      "Flat ADI classes (pros::ADIDigitalIn…) are deprecated aliases in PROS 4 — prefer pros::adi::.",
    suggestion: "Use pros::adi::DigitalIn etc. on PROS 4.",
    severity: "warning",
  },
  {
    id: "motor-gears-v4-only",
    pattern: "\\bpros::(v5::)?MotorGears?::",
    availableIn: ["4"],
    message:
      "pros::v5::MotorGears is a PROS 4 enum; PROS 3 uses pros::E_MOTOR_GEARSET_06/_18/_36.",
    suggestion: "Use pros::E_MOTOR_GEARSET_* on PROS 3.",
    severity: "error",
  },
  {
    id: "motor-ctor-bool-reversed-v3-only",
    // Motor(port, GEARSET, true/false ...) — the 3-arg reversed-bool form
    pattern:
      "\\bMotor\\s*(?:\\w+)?\\s*\\(\\s*-?\\d+\\s*,[^;)]*,\\s*(?:true|false)\\s*[,)]",
    availableIn: ["3"],
    message:
      "The pros::Motor constructor with a reversed bool argument is PROS 3 only — PROS 4 reverses motors with a negative port number.",
    suggestion: "On PROS 4 write pros::Motor(-5, …) instead of pros::Motor(5, …, true).",
    severity: "error",
  },
  {
    id: "motor-encoder-units-enum",
    pattern: "\\bpros::E_MOTOR_ENCODER_\\w+",
    availableIn: ["3", "4"],
    deprecatedIn: ["4"],
    message:
      "pros::E_MOTOR_ENCODER_* enums are the C API; PROS 4 C++ prefers pros::v5::MotorUnits.",
    severity: "warning",
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** "4.1.1" → "4"; unknown/empty → null. */
export function kernelMajorOf(version: string | null | undefined): ProsKernelMajor | null {
  if (!version) return null;
  const major = version.trim().split(".")[0];
  return major === "3" || major === "4" ? major : null;
}

export function kernelInfo(major: ProsKernelMajor): ProsKernelInfo | undefined {
  return PROS_KERNELS.find((k) => k.major === major);
}
