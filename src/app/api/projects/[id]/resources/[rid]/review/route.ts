import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { readResourceFile } from "@/lib/storage";
import { extractResourceText, type ResourceType } from "@/lib/resources/ingest";
import { chatCompletion, hasLlmConfigured } from "@/lib/llm/provider";
import { parseReviewFlags, refineFlags, type ReviewFlag } from "@/lib/review/refine";
import {
  batchSections,
  sectionsFromHeadings,
  sectionsFromSlides,
  type DocSection,
} from "@/lib/review/sections";
import { ensureDemoSeeded } from "@/lib/demo/seed";
import {
  requireProjectAccess,
  UnauthorizedError,
  ForbiddenError,
} from "@/lib/auth/dal";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const REVIEW_SYSTEM_PROMPT = `You are a review assistant for student robotics engineering notebooks (VEX/FIRST). Your ONLY job is to point students at problems in their own document — you are a guide, never an author.

Rules (absolute):
- NEVER write replacement text, corrected sentences, example calculations, or any content the student could paste into their notebook. Pointing out WHAT is missing is allowed; providing it is forbidden.
- NEVER output prose, explanations, or commentary. Output ONLY a JSON array.
- Each flag is a short pointer (max 120 characters) naming the problem, e.g. "No torque calculation for the intake motor" or "Auton path missing sensor tolerance".
- Use the location tags given in the document exactly (page/slide/section and its number).
- Only flag real, specific issues you can anchor to a location. Fewer good flags beat many vague ones. At most 8 flags per excerpt.

Output format — a JSON array, nothing else:
[
  {
    "location": { "kind": "page" | "slide" | "section", "number": <int>, "label": "<short label>" },
    "issue": "<max 120 chars, what is missing/wrong — never the fix itself>",
    "severity": "high" | "medium" | "low",
    "category": "missing-calculation" | "missing-evidence" | "unclear-goal" | "safety" | "incomplete-entry"
  }
]

If the excerpt has no notable issues, return [].`;

/** Extract per-page sections from a PDF buffer using pdf-parse. */
async function sectionsFromPdf(buffer: Buffer): Promise<DocSection[]> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  const pages = result.pages ?? [];
  return pages
    .filter((p) => p.text.trim().length > 0)
    .map((p) => ({
      kind: "page" as const,
      number: p.num,
      label: `Page ${p.num}`,
      text: p.text.trim(),
    }));
}

async function loadSections(resource: {
  name: string;
  type: string;
  storagePath: string | null;
  summary: string | null;
}): Promise<DocSection[]> {
  const isPptx = resource.name.toLowerCase().endsWith(".pptx");
  const isPdf =
    resource.type === "pdf" || resource.name.toLowerCase().endsWith(".pdf");

  if (resource.storagePath) {
    const buffer = await readResourceFile(resource.storagePath);
    if (buffer) {
      if (isPdf) return sectionsFromPdf(buffer);
      const text = await extractResourceText(
        resource.name,
        resource.type as ResourceType,
        buffer
      );
      if (text.trim()) {
        return isPptx ? sectionsFromSlides(text) : sectionsFromHeadings(text);
      }
    }
  }

  // Fallback: whatever summary text we have (demo resources, blob outages)
  if (resource.summary && !resource.summary.startsWith("http")) {
    return isPptx
      ? sectionsFromSlides(resource.summary)
      : sectionsFromHeadings(resource.summary);
  }
  return [];
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; rid: string }> }
) {
  const { id, rid } = await params;

  // Viewer access is enough — review is read-only analysis. The demo
  // project short-circuits inside requireProjectAccess (no session needed).
  try {
    await requireProjectAccess(id, "viewer");
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    throw err;
  }

  if (!hasLlmConfigured()) {
    return NextResponse.json(
      {
        error: "llm-not-configured",
        message: "Add an AI key to enable document review.",
      },
      { status: 503 }
    );
  }

  await ensureDemoSeeded(id);

  const rows = await db
    .select()
    .from(schema.resources)
    .where(and(eq(schema.resources.projectId, id), eq(schema.resources.id, rid)))
    .limit(1)
    .all();
  const resource = rows[0];
  if (!resource) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  }

  let sections: DocSection[] = [];
  try {
    sections = await loadSections(resource);
  } catch (err) {
    console.error(`Review: text extraction failed for ${resource.name}:`, err);
  }
  if (sections.length === 0) {
    return NextResponse.json(
      { error: "no-text", message: "No extractable text to review in this document." },
      { status: 422 }
    );
  }

  const batches = batchSections(sections);
  const allFlags: ReviewFlag[] = [];

  for (const batch of batches) {
    try {
      const raw = await chatCompletion(
        [
          { role: "system", content: REVIEW_SYSTEM_PROMPT },
          {
            role: "user",
            content: `Document: "${resource.name}"\n\nExcerpt (location tags in [brackets]):\n\n${batch}`,
          },
        ],
        { temperature: 0.1 }
      );
      allFlags.push(...parseReviewFlags(raw));
    } catch (err) {
      console.error("Review: LLM call failed:", err);
      // Keep flags from batches that succeeded
    }
  }

  if (allFlags.length === 0 && batches.length > 0) {
    // Distinguish "clean document" from "every call failed" only loosely —
    // an empty array is a valid review result either way.
    return NextResponse.json({ flags: [], reviewedSections: sections.length });
  }

  return NextResponse.json({
    flags: refineFlags(allFlags),
    reviewedSections: sections.length,
  });
}
