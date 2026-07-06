/**
 * Bot Gateway — the rubric engine.
 *
 * `runGateway(code, profile)` statically checks a piece of C++ against the
 * robot's bot profile and returns a structured GatewayReport. This is
 * deliberately heuristic (regex over comment-stripped source, no compiler):
 * the goal is that code which passes does what it claims on the real robot
 * ~80% of the time, catching the common failure classes of hallucinated
 * code — wrong ports, wrong component types, APIs from the wrong PROS
 * kernel, and obviously broken/truncated output. Real compilation plugs in
 * later via the Forge Local Agent (see docs/robot-deploy-architecture.md).
 */

import {
  API_RULES,
  kernelMajorOf,
  type ProsKernelMajor,
} from "./firmware-registry";
import type {
  BotComponent,
  BotProfile,
  GatewayCheck,
  GatewayReport,
} from "./types";

export const RUBRIC_VERSION = "1";

// ─── Source preprocessing ────────────────────────────────────────────────────

/**
 * Replaces comments and string/char literals with spaces, preserving the
 * exact character offsets and line structure so match positions map back to
 * real line numbers. Also reports whether a comment or string was left open
 * (a strong truncation signal).
 */
function stripCommentsAndStrings(code: string): {
  stripped: string;
  unterminated: "block-comment" | "string" | null;
} {
  const out = code.split("");
  let i = 0;
  let unterminated: "block-comment" | "string" | null = null;
  const n = code.length;

  const blank = (from: number, to: number) => {
    for (let k = from; k < to; k++) if (out[k] !== "\n") out[k] = " ";
  };

  while (i < n) {
    const c = code[i];
    const next = code[i + 1];
    if (c === "/" && next === "/") {
      const end = code.indexOf("\n", i);
      const stop = end === -1 ? n : end;
      blank(i, stop);
      i = stop;
    } else if (c === "/" && next === "*") {
      const end = code.indexOf("*/", i + 2);
      if (end === -1) {
        blank(i, n);
        unterminated = "block-comment";
        i = n;
      } else {
        blank(i, end + 2);
        i = end + 2;
      }
    } else if (c === '"' || c === "'") {
      const quote = c;
      let j = i + 1;
      while (j < n && code[j] !== quote && code[j] !== "\n") {
        if (code[j] === "\\") j++;
        j++;
      }
      if (j >= n || code[j] === "\n") {
        // Unterminated on this line — char literals like 'A' matter to us,
        // so keep single-quoted literals intact instead of blanking.
        if (quote === '"') unterminated = "string";
        i = j;
      } else {
        if (quote === '"') blank(i + 1, j); // keep the quotes, blank contents
        i = j + 1;
      }
    } else {
      i++;
    }
  }

  return { stripped: out.join(""), unterminated };
}

function lineOfIndex(code: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < code.length; i++) {
    if (code[i] === "\n") line++;
  }
  return line;
}

// ─── Device usage extraction ─────────────────────────────────────────────────

/** What kind of device the code treats a port as. */
type UsageKind =
  | "motor"
  | "rotation_sensor"
  | "imu"
  | "distance"
  | "optical"
  | "vision"
  | "gps"
  | "adi";

interface PortUsage {
  port: number | string; // 1–21 or "A"–"H"
  kind: UsageKind;
  /** For ADI: the specific class used, normalized (e.g. "adi_digital_in"). */
  adiType?: string;
  /** Motors: negative port or reversed-bool ctor arg. */
  reversed?: boolean;
  line: number;
  snippet: string;
}

interface Extractor {
  kind: UsageKind;
  regex: RegExp;
  /** Which capture group holds the port (default 1). */
  portGroup?: number;
}

// Smart-port single-device constructors: pros::Motor lf(1); pros::Motor(1, …);
// Motor lf(-3); pros::Rotation rot(7); pros::c::motor_move(2, 127); …
const SMART_EXTRACTORS: Extractor[] = [
  { kind: "motor", regex: /\b(?:pros::)?Motor\s+\w+\s*[({]\s*(-?\d{1,2})\b/g },
  { kind: "motor", regex: /\bpros::Motor\s*\(\s*(-?\d{1,2})\b/g },
  { kind: "motor", regex: /\b(?:pros::c::)?motor_(?:move|move_velocity|move_absolute|move_relative|brake|get_position|get_velocity|set_reversed|set_gearing)\s*\(\s*(-?\d{1,2})\b/g },
  { kind: "rotation_sensor", regex: /\b(?:pros::)?Rotation(?:\s+\w+)?\s*[({]\s*(-?\d{1,2})\b/g },
  { kind: "rotation_sensor", regex: /\b(?:pros::c::)?rotation_(?:get_position|get_angle|reset|set_position|get_velocity)\s*\(\s*(\d{1,2})\b/g },
  { kind: "imu", regex: /\b(?:pros::)?(?:Imu|IMU)(?:\s+\w+)?\s*[({]\s*(\d{1,2})\b/g },
  { kind: "imu", regex: /\b(?:pros::c::)?imu_(?:get_heading|get_rotation|reset|tare|get_yaw|get_pitch|get_roll)\s*\(\s*(\d{1,2})\b/g },
  { kind: "distance", regex: /\b(?:pros::)?Distance(?:\s+\w+)?\s*[({]\s*(\d{1,2})\b/g },
  { kind: "optical", regex: /\b(?:pros::)?Optical(?:\s+\w+)?\s*[({]\s*(\d{1,2})\b/g },
  { kind: "vision", regex: /\b(?:pros::)?Vision(?:\s+\w+)?\s*[({]\s*(\d{1,2})\b/g },
  { kind: "gps", regex: /\b(?:pros::)?(?:Gps|GPS)(?:\s+\w+)?\s*[({]\s*(\d{1,2})\b/g },
];

// Motor groups: pros::MotorGroup left({1, -2, 3}); pros::Motor_Group({-1, 2});
const MOTOR_GROUP_REGEX =
  /\b(?:pros::)?Motor(?:Group|_Group)(?:\s+\w+)?\s*\(?\s*\{([^}]*)\}/g;

// ADI devices: pros::adi::DigitalIn limit('A'); pros::ADIAnalogIn pot('B');
// also numeric ADI ports 1–8.
const ADI_REGEX =
  /\b(?:pros::adi::|pros::ADI)(\w+?)(?:\s+\w+)?\s*[({]\s*(?:'([A-Ha-h])'|([1-8]))\s*[,)]/g;

/** "DigitalIn" | "DigitalOut" | … → "adi_digital_in" etc. */
function normalizeAdiClass(cls: string): string {
  const snake = cls
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase();
  return `adi_${snake}`;
}

function extractPortUsages(stripped: string): PortUsage[] {
  const usages: PortUsage[] = [];
  const push = (u: PortUsage) => usages.push(u);

  for (const ex of SMART_EXTRACTORS) {
    ex.regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = ex.regex.exec(stripped)) !== null) {
      const raw = Number(m[ex.portGroup ?? 1]);
      if (!Number.isFinite(raw) || raw === 0) continue;
      const port = Math.abs(raw);
      if (port > 21) continue;
      // Check for a reversed-bool third arg (PROS 3 style) near the match
      const tail = stripped.slice(m.index, m.index + 120);
      const reversedBool = /\(\s*-?\d{1,2}\s*,[^;)]*,\s*true\s*[,)]/.test(tail);
      push({
        port,
        kind: ex.kind,
        reversed: ex.kind === "motor" ? raw < 0 || reversedBool : undefined,
        line: lineOfIndex(stripped, m.index),
        snippet: m[0].trim(),
      });
    }
  }

  MOTOR_GROUP_REGEX.lastIndex = 0;
  let g: RegExpExecArray | null;
  while ((g = MOTOR_GROUP_REGEX.exec(stripped)) !== null) {
    const line = lineOfIndex(stripped, g.index);
    for (const tok of g[1].split(",")) {
      const raw = Number(tok.trim());
      if (!Number.isFinite(raw) || raw === 0 || Math.abs(raw) > 21) continue;
      push({
        port: Math.abs(raw),
        kind: "motor",
        reversed: raw < 0,
        line,
        snippet: g[0].slice(0, 60).trim(),
      });
    }
  }

  ADI_REGEX.lastIndex = 0;
  let a: RegExpExecArray | null;
  while ((a = ADI_REGEX.exec(stripped)) !== null) {
    const letter = a[2]
      ? a[2].toUpperCase()
      : String.fromCharCode(64 + Number(a[3])); // 1→A … 8→H
    push({
      port: letter,
      kind: "adi",
      adiType: normalizeAdiClass(a[1]),
      line: lineOfIndex(stripped, a.index),
      snippet: a[0].trim(),
    });
  }

  return usages;
}

// ─── Profile lookups ─────────────────────────────────────────────────────────

function normalizePortKey(port: number | string): string {
  const s = String(port).trim().toUpperCase();
  return s;
}

function componentByPort(profile: BotProfile): Map<string, BotComponent> {
  const map = new Map<string, BotComponent>();
  for (const c of profile.components ?? []) {
    map.set(normalizePortKey(c.port), c);
  }
  return map;
}

/** Is the profile component type compatible with how the code uses the port? */
function typeCompatible(usage: PortUsage, component: BotComponent): boolean {
  const t = component.type;
  switch (usage.kind) {
    case "motor":
      return t.startsWith("motor");
    case "adi":
      // Any adi_* profile entry on the right port counts as present; an exact
      // class mismatch (digital vs analog) is still an error.
      if (!t.startsWith("adi_")) return false;
      if (!usage.adiType) return true;
      // Encoders/ultrasonics span two ports; accept the family match.
      return t === usage.adiType || t.split("_")[1] === usage.adiType.split("_")[1];
    default:
      return t === usage.kind;
  }
}

function describeComponent(c: BotComponent): string {
  return `${c.type}${c.label ? ` ("${c.label}")` : ""}`;
}

// ─── The gateway check ───────────────────────────────────────────────────────

export function runGateway(code: string, profile: BotProfile): GatewayReport {
  const checks: GatewayCheck[] = [];

  // ── 1. Basic syntax sanity ────────────────────────────────────────────────
  const { stripped, unterminated } = stripCommentsAndStrings(code);

  if (code.trim().length === 0) {
    checks.push({
      id: "syntax-empty",
      severity: "error",
      message: "The code block is empty.",
    });
    return finalize(checks, profile);
  }

  if (unterminated === "block-comment") {
    checks.push({
      id: "syntax-truncated",
      severity: "error",
      message: "Unterminated block comment — the code appears truncated.",
    });
  } else if (unterminated === "string") {
    checks.push({
      id: "syntax-truncated",
      severity: "error",
      message: "Unterminated string literal — the code appears truncated.",
    });
  }

  for (const [open, close, label] of [
    ["{", "}", "braces"],
    ["(", ")", "parentheses"],
    ["[", "]", "brackets"],
  ] as const) {
    let depth = 0;
    let negative = false;
    for (const ch of stripped) {
      if (ch === open) depth++;
      else if (ch === close) {
        depth--;
        if (depth < 0) negative = true;
      }
    }
    if (depth !== 0 || negative) {
      checks.push({
        id: `syntax-${label}`,
        severity: "error",
        message:
          depth > 0
            ? `Unbalanced ${label}: ${depth} unclosed — the code looks incomplete or truncated.`
            : `Unbalanced ${label}: more closing than opening.`,
      });
    }
  }

  // Ellipsis placeholders LLMs leave behind ("// ..." is stripped as comment,
  // so a bare ... in code is almost always a placeholder, not a real varargs).
  {
    const m = /^\s*\.\.\.\s*$/m.exec(stripped);
    if (m) {
      checks.push({
        id: "syntax-placeholder",
        severity: "warning",
        message:
          "Bare `...` placeholder found — the snippet may be incomplete.",
        line: lineOfIndex(stripped, m.index),
      });
    }
  }

  // ── 2. Port & component validation ───────────────────────────────────────
  const byPort = componentByPort(profile);
  const usages = extractPortUsages(stripped);
  const referencedPorts = new Set<string>();
  // port → kinds seen, to detect in-code conflicts
  const kindsByPort = new Map<string, Map<string, PortUsage>>();

  for (const usage of usages) {
    const key = normalizePortKey(usage.port);
    referencedPorts.add(key);

    const kindKey = usage.kind === "adi" ? usage.adiType ?? "adi" : usage.kind;
    const seen = kindsByPort.get(key) ?? new Map<string, PortUsage>();
    if (!seen.has(kindKey)) seen.set(kindKey, usage);
    kindsByPort.set(key, seen);

    const component = byPort.get(key);
    if (!component) {
      checks.push({
        id: "port-unknown",
        severity: "error",
        line: usage.line,
        message: `Code uses port ${key} as a ${usage.kind === "adi" ? usage.adiType ?? "ADI device" : usage.kind}, but the bot profile has nothing on port ${key}.`,
      });
      continue;
    }

    if (!typeCompatible(usage, component)) {
      checks.push({
        id: "port-type-mismatch",
        severity: "error",
        line: usage.line,
        message: `Code treats port ${key} as a ${usage.kind === "adi" ? usage.adiType ?? "ADI device" : usage.kind}, but the bot profile says port ${key} is a ${describeComponent(component)}.`,
      });
      continue;
    }

    if (
      usage.kind === "motor" &&
      typeof usage.reversed === "boolean" &&
      Boolean(component.reversed) !== usage.reversed
    ) {
      checks.push({
        id: "motor-reversed-mismatch",
        severity: "warning",
        line: usage.line,
        message: usage.reversed
          ? `Code reverses the motor on port ${key}, but the profile says ${describeComponent(component)} is not reversed.`
          : `Profile marks the motor on port ${key} (${component.label}) as reversed, but the code doesn't reverse it.`,
      });
    }
  }

  // In-code conflicts: one port used as two different device kinds
  for (const [key, seen] of kindsByPort) {
    if (seen.size > 1) {
      const kinds = [...seen.keys()].join(" and ");
      const first = [...seen.values()][0];
      checks.push({
        id: "port-conflict",
        severity: "error",
        line: first.line,
        message: `Port ${key} is used as both ${kinds} in this code.`,
      });
    }
  }

  // ── 3. Firmware / kernel API validation ──────────────────────────────────
  const major: ProsKernelMajor | null = kernelMajorOf(profile.prosKernelVersion);
  if (!major) {
    if (profile.prosKernelVersion) {
      checks.push({
        id: "kernel-unknown",
        severity: "info",
        message: `Unrecognized PROS kernel version "${profile.prosKernelVersion}" — kernel API checks were skipped.`,
      });
    } else {
      checks.push({
        id: "kernel-unspecified",
        severity: "info",
        message:
          "No PROS kernel version set in the bot profile — kernel API checks were skipped. Set it in Bot Profile for stronger validation.",
      });
    }
  } else {
    for (const rule of API_RULES) {
      const regex = new RegExp(rule.pattern, "gm");
      const m = regex.exec(stripped);
      if (!m) continue;
      const line = lineOfIndex(stripped, m.index);
      if (!rule.availableIn.includes(major)) {
        checks.push({
          id: `kernel-api:${rule.id}`,
          severity: rule.severity ?? "error",
          line,
          message: `${rule.message}${rule.suggestion ? ` ${rule.suggestion}` : ""} (profile kernel: PROS ${profile.prosKernelVersion})`,
        });
      } else if (rule.deprecatedIn?.includes(major)) {
        checks.push({
          id: `kernel-deprecated:${rule.id}`,
          severity: "warning",
          line,
          message: `${rule.message}${rule.suggestion ? ` ${rule.suggestion}` : ""}`,
        });
      }
    }
  }

  // ── 4. Component sanity (info) ───────────────────────────────────────────
  if (usages.length > 0) {
    const unreferenced = (profile.components ?? []).filter(
      (c) => !referencedPorts.has(normalizePortKey(c.port))
    );
    if (unreferenced.length > 0 && unreferenced.length < (profile.components ?? []).length) {
      const list = unreferenced
        .slice(0, 6)
        .map((c) => `${normalizePortKey(c.port)} (${c.label || c.type})`)
        .join(", ");
      checks.push({
        id: "component-unused",
        severity: "info",
        message: `Profile components not referenced in this code: ${list}${unreferenced.length > 6 ? "…" : ""}.`,
      });
    }
  } else {
    checks.push({
      id: "no-devices-referenced",
      severity: "info",
      message:
        "No device/port references detected in this code — port map checks did not apply.",
    });
  }

  return finalize(checks, profile);
}

function finalize(checks: GatewayCheck[], profile: BotProfile): GatewayReport {
  const errors = checks.filter((c) => c.severity === "error").length;
  const warnings = checks.filter((c) => c.severity === "warning").length;

  const score = Math.max(0, Math.min(100, 100 - errors * 25 - warnings * 10));
  const verdict = errors > 0 ? "fail" : warnings > 0 ? "warn" : "pass";

  return {
    verdict,
    score,
    checks,
    rubricVersion: RUBRIC_VERSION,
    profileName: profile.name,
  };
}
