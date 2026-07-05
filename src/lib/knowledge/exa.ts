import Exa from "exa-js";
import type { DetectedLibrary } from "@/lib/types";

export interface WebSource {
  title: string;
  url: string;
  highlights: string[];
}

const LIBRARY_DOMAINS: Record<string, string> = {
  LemLib: "lemlib.readthedocs.io",
  PROS: "pros.cs.purdue.edu",
  OkapiLib: "okapilib.github.io",
  WPILib: "docs.wpilib.org",
};

export async function searchWeb(
  query: string,
  libraries: DetectedLibrary[]
): Promise<WebSource[]> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) return [];

  const exa = new Exa(apiKey);

  // Bias toward detected libraries' docs + VEX forum
  const libNames = libraries.map((l) => l.name).join(" ");
  const enrichedQuery = `${query} ${libNames} competitive robotics`;

  try {
    const result = await exa.search(enrichedQuery, {
      type: "fast",
      numResults: 4,
      contents: { highlights: true },
    });
    return result.results.map((r) => ({
      title: r.title ?? r.url,
      url: r.url,
      highlights: (r.highlights ?? []).slice(0, 3),
    }));
  } catch (err) {
    console.error("Exa search failed:", err);
    return [];
  }
}

/** Search VEX competition products catalog via Exa */
export async function searchVexParts(query: string): Promise<WebSource[]> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) return [];

  const exa = new Exa(apiKey);
  const enrichedQuery = `${query} VEX V5 competition parts site:vexrobotics.com`;

  try {
    const result = await exa.search(enrichedQuery, {
      type: "fast",
      numResults: 5,
      includeDomains: ["vexrobotics.com"],
      contents: { highlights: true },
    });
    return result.results.map((r) => ({
      title: r.title ?? r.url,
      url: r.url,
      highlights: (r.highlights ?? []).slice(0, 3),
    }));
  } catch (err) {
    console.error("Exa VEX parts search failed:", err);
    return [];
  }
}

export function preferredDomains(libraries: DetectedLibrary[]): string[] {
  return libraries
    .map((l) => LIBRARY_DOMAINS[l.name])
    .filter((d): d is string => Boolean(d));
}
