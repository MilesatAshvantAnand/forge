/**
 * Document review refinement — pure functions, no I/O.
 *
 * The LLM returns a raw list of review flags (pointers to problems in a
 * notebook/document). This module defensively parses that output, dedupes
 * near-identical flags, ranks them (severity, then category relevance,
 * then document order), and caps the list so the UI stays a short punch
 * list rather than an overwhelming audit report.
 */

export type ReviewLocationKind = "page" | "slide" | "section";
export type ReviewSeverity = "high" | "medium" | "low";

export interface ReviewLocation {
  kind: ReviewLocationKind;
  number?: number;
  label: string;
}

export interface ReviewFlag {
  location: ReviewLocation;
  issue: string;
  severity: ReviewSeverity;
  category: string;
}

const MAX_FLAGS = 12;
const MAX_ISSUE_CHARS = 120;

const SEVERITY_RANK: Record<ReviewSeverity, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

/** Higher = more relevant to the "guide, don't author" review philosophy. */
const CATEGORY_WEIGHT: Record<string, number> = {
  safety: 5,
  "missing-calculation": 4,
  "missing-evidence": 3,
  "unclear-goal": 2,
  "incomplete-entry": 2,
};

const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "for", "of",
  "to", "in", "on", "at", "and", "or", "no", "not", "with", "this", "that",
  "there", "it", "its", "has", "have", "had",
]);

function normalizeTokens(issue: string): Set<string> {
  return new Set(
    issue
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1 && !STOPWORDS.has(t))
  );
}

/** Jaccard similarity of normalized issue token sets (0..1). */
export function issueSimilarity(a: string, b: string): number {
  const ta = normalizeTokens(a);
  const tb = normalizeTokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

function sameLocation(a: ReviewLocation, b: ReviewLocation): boolean {
  return a.kind === b.kind && a.number !== undefined && a.number === b.number;
}

function severityRank(f: ReviewFlag): number {
  return SEVERITY_RANK[f.severity] ?? 0;
}

function categoryWeight(f: ReviewFlag): number {
  return CATEGORY_WEIGHT[f.category] ?? 1;
}

/**
 * Dedupe near-identical flags, rank by severity → category relevance →
 * document order, and cap the result. Pure and deterministic.
 */
export function refineFlags(
  flags: ReviewFlag[],
  maxFlags: number = MAX_FLAGS
): ReviewFlag[] {
  // Dedupe: a flag is a duplicate when its issue text is very similar to an
  // already-kept flag — or moderately similar AND pointing at the same spot.
  const kept: ReviewFlag[] = [];
  const sortedBySeverity = [...flags].sort(
    (a, b) => severityRank(b) - severityRank(a)
  );
  for (const flag of sortedBySeverity) {
    const isDup = kept.some((k) => {
      const sim = issueSimilarity(k.issue, flag.issue);
      return sim >= 0.75 || (sim >= 0.45 && sameLocation(k.location, flag.location));
    });
    if (!isDup) kept.push(flag);
  }

  kept.sort((a, b) => {
    const sev = severityRank(b) - severityRank(a);
    if (sev !== 0) return sev;
    const cat = categoryWeight(b) - categoryWeight(a);
    if (cat !== 0) return cat;
    return (a.location.number ?? Infinity) - (b.location.number ?? Infinity);
  });

  return kept.slice(0, maxFlags);
}

// ─── Defensive parsing of raw LLM output ────────────────────────────────────

function coerceKind(v: unknown): ReviewLocationKind {
  return v === "page" || v === "slide" || v === "section" ? v : "section";
}

function coerceSeverity(v: unknown): ReviewSeverity {
  return v === "high" || v === "medium" || v === "low" ? v : "medium";
}

function defaultLabel(kind: ReviewLocationKind, number?: number): string {
  const noun = kind === "page" ? "Page" : kind === "slide" ? "Slide" : "Section";
  return number !== undefined ? `${noun} ${number}` : noun;
}

/**
 * Parse the raw LLM response into ReviewFlags. Tolerates markdown code
 * fences, leading prose, and partially malformed entries (which are dropped).
 * Returns [] when nothing salvageable is found.
 */
export function parseReviewFlags(raw: string): ReviewFlag[] {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const flags: ReviewFlag[] = [];
  for (const item of parsed) {
    if (typeof item !== "object" || item === null) continue;
    const rec = item as Record<string, unknown>;
    const issue = typeof rec.issue === "string" ? rec.issue.trim() : "";
    if (!issue) continue;

    const locRec =
      typeof rec.location === "object" && rec.location !== null
        ? (rec.location as Record<string, unknown>)
        : {};
    const kind = coerceKind(locRec.kind);
    const number =
      typeof locRec.number === "number" && Number.isFinite(locRec.number)
        ? Math.max(1, Math.round(locRec.number))
        : undefined;
    const label =
      typeof locRec.label === "string" && locRec.label.trim()
        ? locRec.label.trim().slice(0, 60)
        : defaultLabel(kind, number);

    flags.push({
      location: { kind, number, label },
      issue: issue.slice(0, MAX_ISSUE_CHARS),
      severity: coerceSeverity(rec.severity),
      category:
        typeof rec.category === "string" && rec.category.trim()
          ? rec.category.trim().toLowerCase().slice(0, 40)
          : "incomplete-entry",
    });
  }
  return flags;
}
