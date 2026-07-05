import { Open } from "unzipper";

/**
 * Text extraction for Office Open XML formats (PPTX, DOCX).
 * Both are ZIP archives of XML — no heavy parser dependency needed:
 * we pull the text runs (<a:t> for slides, <w:t> for documents) directly.
 */

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, "&");
}

function collectRuns(xml: string, tag: "a:t" | "w:t"): string[] {
  // (?:\s[^>]*)? ensures we match <a:t> / <a:t attr> but never <a:tab/> etc.
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "g");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const text = decodeXmlEntities(m[1]);
    if (text.length > 0) out.push(text);
  }
  return out;
}

/** Extract slide text from a PPTX buffer, with per-slide markers for chunking. */
export async function extractPptxText(buffer: Buffer): Promise<string> {
  const archive = await Open.buffer(buffer);
  const slideEntries = archive.files
    .filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f.path))
    .sort((a, b) => {
      const na = Number(a.path.match(/slide(\d+)\.xml/)?.[1] ?? 0);
      const nb = Number(b.path.match(/slide(\d+)\.xml/)?.[1] ?? 0);
      return na - nb;
    });

  const noteEntries = new Map(
    archive.files
      .filter((f) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(f.path))
      .map((f) => [Number(f.path.match(/notesSlide(\d+)\.xml/)?.[1] ?? 0), f])
  );

  const parts: string[] = [];
  for (const entry of slideEntries) {
    const slideNum = Number(entry.path.match(/slide(\d+)\.xml/)?.[1] ?? 0);
    const xml = (await entry.buffer()).toString("utf-8");
    // Group runs by paragraph so bullet items stay on their own lines
    const paragraphs = xml
      .split(/<\/a:p>/)
      .map((p) => collectRuns(p, "a:t").join(""))
      .filter((p) => p.trim().length > 0);
    if (paragraphs.length === 0) continue;

    let slideText = `## Slide ${slideNum}\n${paragraphs.join("\n")}`;

    const notes = noteEntries.get(slideNum);
    if (notes) {
      const notesXml = (await notes.buffer()).toString("utf-8");
      const noteText = collectRuns(notesXml, "a:t").join(" ").trim();
      // Skip placeholder-only notes (slide number etc.)
      if (noteText.length > 10) slideText += `\n[Notes] ${noteText}`;
    }
    parts.push(slideText);
  }
  return parts.join("\n\n");
}

/** Extract paragraph text from a DOCX buffer. */
export async function extractDocxText(buffer: Buffer): Promise<string> {
  const archive = await Open.buffer(buffer);
  const doc = archive.files.find((f) => f.path === "word/document.xml");
  if (!doc) return "";
  const xml = (await doc.buffer()).toString("utf-8");
  const paragraphs = xml
    .split(/<\/w:p>/)
    .map((p) => collectRuns(p, "w:t").join(""))
    .filter((p) => p.trim().length > 0);
  return paragraphs.join("\n");
}

/** Dispatch extraction by filename extension; returns "" for unsupported. */
export async function extractOfficeText(
  filename: string,
  buffer: Buffer
): Promise<string> {
  const ext = filename.slice(filename.lastIndexOf(".") + 1).toLowerCase();
  if (ext === "pptx") return extractPptxText(buffer);
  if (ext === "docx") return extractDocxText(buffer);
  return "";
}
