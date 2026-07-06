/**
 * Tolerant parser for path.jerryio ("JRERO") exported path files.
 *
 * Format background (verified against the path.jerryio source):
 * - Saved .txt files contain robot-readable data (point lines, library-specific
 *   sections) followed by a final line `#PATH.JERRYIO-DATA {json}` — a JSON
 *   document written by the editor containing the general config (`gc`) and the
 *   full `paths` array (segments → bezier control points → headings).
 * - `gc.uol` is the unit of length; its numeric enum value is the number of
 *   centimeters per unit (Centimeter = 1, Inch = 2.54, Tile = 60.96, ...).
 * - Each segment has 2 control points (straight line) or 4 (cubic bezier).
 *   Shared endpoints (`__type: "end-point"`) carry heading; interior handles
 *   (`__type: "control"`) do not.
 * - `pc.speedLimit` is a range slider — `to` is the selected max speed
 *   (rpm for the native path.jerryio v0.1 format, in/s for LemLib formats).
 *
 * This parser never throws on malformed input — it returns null when nothing
 * usable is found, and fills in whatever it can otherwise.
 */

export interface JerryioPoint {
  x: number;
  y: number;
  heading?: number;
}

export interface JerryioPathSummary {
  name: string;
  segments: number;
  /** End-control (shared endpoint) count — the "waypoints" a student placed. */
  waypoints: number;
  /** Approximate arc length in inches (bezier segments sampled numerically). */
  distanceInches: number;
  /** Selected max speed from the path config, unit depends on export format. */
  maxSpeed?: number;
  start?: JerryioPoint;
  end?: JerryioPoint;
}

export interface JerryioPlanSummary {
  /** e.g. "path.jerryio v0.1", "LemLib v1.0" — from the PDJ JSON when present */
  format?: string;
  appVersion?: string;
  paths: JerryioPathSummary[];
  totalDistanceInches: number;
  /** "pdj-json" when parsed from #PATH.JERRYIO-DATA, "point-lines" fallback */
  parsedFrom: "pdj-json" | "point-lines";
}

const PDJ_MARKER = "#PATH.JERRYIO-DATA";
const POINTS_MARKER = "#PATH-POINTS-START";
const CM_PER_INCH = 2.54;

// ─── Geometry helpers ─────────────────────────────────────────────────────────

interface Vec {
  x: number;
  y: number;
}

function dist(a: Vec, b: Vec): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Numeric arc length of a cubic bezier by chord sampling. */
function cubicLength(p0: Vec, p1: Vec, p2: Vec, p3: Vec, samples = 24): number {
  let length = 0;
  let prev = p0;
  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    const u = 1 - t;
    const pt = {
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
    };
    length += dist(prev, pt);
    prev = pt;
  }
  return length;
}

function asNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function round(n: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

// ─── PDJ JSON parsing ─────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

function parsePdjJson(text: string): JerryioPlanSummary | null {
  let data: any = null;

  const markerIdx = text.lastIndexOf(PDJ_MARKER);
  if (markerIdx >= 0) {
    const jsonStart = text.indexOf("{", markerIdx);
    if (jsonStart >= 0) {
      // The JSON runs to the end of the line (it is the last line of the file,
      // but tolerate trailing content, e.g. when embedded in a tarball entry).
      const lineEnd = text.indexOf("\n", jsonStart);
      const raw = (lineEnd >= 0 ? text.slice(jsonStart, lineEnd) : text.slice(jsonStart)).trim();
      data = tryJson(raw) ?? tryJson(text.slice(jsonStart).trim());
    }
  }
  // Some users save the PDJ document directly as .json
  if (!data) data = tryJson(text.trim());

  if (!data || typeof data !== "object" || !Array.isArray(data.paths)) return null;

  // gc.uol enum value == centimeters per unit (Inch = 2.54, Tile = 60.96, ...)
  const cmPerUnit = asNumber(data.gc?.uol) ?? 1;
  const toInches = (v: number) => (v * cmPerUnit) / CM_PER_INCH;

  const paths: JerryioPathSummary[] = [];

  for (const p of data.paths) {
    if (!p || typeof p !== "object") continue;
    const segments: any[] = Array.isArray(p.segments) ? p.segments : [];

    let lengthUol = 0;
    const endControls: JerryioPoint[] = [];

    for (const seg of segments) {
      const controls: any[] = Array.isArray(seg?.controls) ? seg.controls : [];
      const pts = controls
        .map((c) => ({
          x: asNumber(c?.x),
          y: asNumber(c?.y),
          heading: asNumber(c?.heading),
          isEnd: c?.__type === "end-point" || asNumber(c?.heading) !== undefined,
        }))
        .filter((c) => c.x !== undefined && c.y !== undefined) as {
        x: number;
        y: number;
        heading?: number;
        isEnd: boolean;
      }[];

      if (pts.length >= 2) {
        if (pts.length >= 4) {
          lengthUol += cubicLength(pts[0], pts[1], pts[2], pts[3]);
        } else {
          lengthUol += dist(pts[0], pts[pts.length - 1]);
        }
      }

      // Collect shared endpoints once (first of the first segment, then lasts)
      const first = pts[0];
      const last = pts[pts.length - 1];
      if (first && endControls.length === 0) {
        endControls.push({ x: first.x, y: first.y, heading: first.heading });
      }
      if (last) endControls.push({ x: last.x, y: last.y, heading: last.heading });
    }

    const start = endControls[0];
    const end = endControls[endControls.length - 1];

    paths.push({
      name: typeof p.name === "string" && p.name ? p.name : `Path ${paths.length + 1}`,
      segments: segments.length,
      waypoints: endControls.length,
      distanceInches: round(toInches(lengthUol)),
      maxSpeed: asNumber(p.pc?.speedLimit?.to),
      start: start
        ? {
            x: round(toInches(start.x)),
            y: round(toInches(start.y)),
            heading: start.heading,
          }
        : undefined,
      end: end
        ? { x: round(toInches(end.x)), y: round(toInches(end.y)), heading: end.heading }
        : undefined,
    });
  }

  if (paths.length === 0) return null;

  return {
    format: typeof data.format === "string" ? data.format : undefined,
    appVersion: typeof data.appVersion === "string" ? data.appVersion : undefined,
    paths,
    totalDistanceInches: round(paths.reduce((s, p) => s + p.distanceInches, 0)),
    parsedFrom: "pdj-json",
  };
}

function tryJson(raw: string): any | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/* eslint-enable @typescript-eslint/no-explicit-any */

// ─── Point-line fallback ──────────────────────────────────────────────────────

/**
 * Fallback for files whose PDJ JSON is missing/corrupt: the path.jerryio v0.1
 * robot-readable section is `#PATH-POINTS-START <name>` followed by
 * `x,y,speed[,heading]` lines in centimeters.
 */
function parsePointLines(text: string): JerryioPlanSummary | null {
  if (!text.includes(POINTS_MARKER)) return null;

  const paths: JerryioPathSummary[] = [];
  let current: { name: string; points: JerryioPoint[]; maxSpeed: number } | null = null;

  const flush = () => {
    if (!current || current.points.length < 2) {
      current = null;
      return;
    }
    // Points are already converted to inches when collected below
    let lengthInches = 0;
    for (let i = 1; i < current.points.length; i++) {
      lengthInches += dist(current.points[i - 1], current.points[i]);
    }
    paths.push({
      name: current.name,
      // Sampled points, not editor segments — report what we actually know
      segments: current.points.length - 1,
      waypoints: current.points.length,
      distanceInches: round(lengthInches),
      maxSpeed: current.maxSpeed > 0 ? round(current.maxSpeed) : undefined,
      start: current.points[0],
      end: current.points[current.points.length - 1],
    });
    current = null;
  };

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith(POINTS_MARKER)) {
      flush();
      current = {
        name: trimmed.slice(POINTS_MARKER.length).trim() || `Path ${paths.length + 1}`,
        points: [],
        maxSpeed: 0,
      };
      continue;
    }
    if (trimmed.startsWith("#") || !current) continue;
    const parts = trimmed.split(",").map((s) => Number(s.trim()));
    if (parts.length >= 2 && parts.slice(0, 2).every(Number.isFinite)) {
      current.points.push({
        x: round(parts[0] / CM_PER_INCH),
        y: round(parts[1] / CM_PER_INCH),
        heading: Number.isFinite(parts[3]) ? parts[3] : undefined,
      });
      if (Number.isFinite(parts[2])) current.maxSpeed = Math.max(current.maxSpeed, parts[2]);
    }
  }
  flush();

  if (paths.length === 0) return null;
  return {
    paths,
    totalDistanceInches: round(paths.reduce((s, p) => s + p.distanceInches, 0)),
    parsedFrom: "point-lines",
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Parse a path.jerryio export. Returns null if nothing usable is found. */
export function parseJerryioFile(text: string): JerryioPlanSummary | null {
  return parsePdjJson(text) ?? parsePointLines(text);
}

function fmtPoint(p?: JerryioPoint): string {
  if (!p) return "unknown";
  const heading = p.heading !== undefined ? `, heading ${round(p.heading)}°` : "";
  return `(${p.x}, ${p.y}) in${heading}`;
}

/** Human-readable one-paragraph summary, used for the resource + reflection. */
export function describeAutonPlan(plan: JerryioPlanSummary): string {
  const pathDescriptions = plan.paths.map((p) => {
    const speed = p.maxSpeed !== undefined ? `, max speed ${p.maxSpeed}` : "";
    return `"${p.name}": starts at ${fmtPoint(p.start)}, ${p.segments} segment${
      p.segments === 1 ? "" : "s"
    } covering ~${p.distanceInches} in, ending near ${fmtPoint(p.end)}${speed}`;
  });
  const header = `${plan.paths.length} path${plan.paths.length === 1 ? "" : "s"}, ~${
    plan.totalDistanceInches
  } inches of driving total${plan.format ? ` (${plan.format} format)` : ""}.`;
  return `${header} ${pathDescriptions.join("; ")}.`;
}
