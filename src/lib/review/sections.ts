import type { ReviewLocationKind } from "./refine";

/**
 * Sectioning for document review — splits extracted text into locatable
 * units (pages / slides / sections) so the LLM can point at a spot the UI
 * can jump to. Pure text functions; PDF per-page extraction happens in the
 * API route (it needs the raw buffer).
 */

export interface DocSection {
  kind: ReviewLocationKind;
  number?: number;
  label: string;
  text: string;
}

/** Split PPTX-extracted text on its "## Slide N" markers. */
export function sectionsFromSlides(text: string): DocSection[] {
  const parts = text.split(/\n\n(?=## Slide )/).filter((s) => s.trim());
  return parts.map((part, i) => {
    const match = part.match(/^## Slide (\d+)/);
    const number = match ? Number(match[1]) : i + 1;
    return {
      kind: "slide",
      number,
      label: `Slide ${number}`,
      text: part.trim(),
    };
  });
}

/**
 * Split plain/markdown text on headings into numbered sections. Falls back
 * to fixed-size blocks when the document has no headings.
 */
export function sectionsFromHeadings(text: string): DocSection[] {
  const clean = text.replace(/\r\n/g, "\n").trim();
  const parts = clean.split(/\n(?=#{1,3} )/).filter((s) => s.trim());

  if (parts.length > 1) {
    return parts.map((part, i) => {
      const heading = part.split("\n")[0].replace(/^#{1,3}\s*/, "").trim();
      return {
        kind: "section",
        number: i + 1,
        label: heading ? heading.slice(0, 60) : `Section ${i + 1}`,
        text: part.trim(),
      };
    });
  }

  // No headings — fixed-size blocks so flags still have an anchor
  const BLOCK = 2400;
  const sections: DocSection[] = [];
  for (let i = 0; i < clean.length; i += BLOCK) {
    sections.push({
      kind: "section",
      number: sections.length + 1,
      label: `Section ${sections.length + 1}`,
      text: clean.slice(i, i + BLOCK).trim(),
    });
  }
  return sections;
}

const MAX_SECTION_CHARS = 3000;
const MAX_BATCH_CHARS = 16000;
const MAX_BATCHES = 4;

/**
 * Group sections into prompt-sized batches. Each section is truncated and
 * prefixed with an explicit location tag the model must echo back. Very
 * long documents are truncated to MAX_BATCHES batches (~64k chars).
 */
export function batchSections(sections: DocSection[]): string[] {
  const batches: string[] = [];
  let current = "";

  for (const s of sections) {
    const tag = s.number !== undefined ? `${s.kind} ${s.number}` : s.kind;
    const block = `=== [${tag}] ${s.label} ===\n${s.text.slice(0, MAX_SECTION_CHARS)}\n\n`;
    if (current.length + block.length > MAX_BATCH_CHARS && current) {
      batches.push(current);
      if (batches.length >= MAX_BATCHES) return batches;
      current = "";
    }
    current += block;
  }
  if (current.trim() && batches.length < MAX_BATCHES) batches.push(current);
  return batches;
}
