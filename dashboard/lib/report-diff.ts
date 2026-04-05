import { diffWords } from "diff";

export interface ReportSection {
  heading: string;
  normalizedHeading: string;
  content: string;
}

export interface DiffSegment {
  text: string;
  type: "equal" | "added" | "removed";
}

export interface SectionDiff {
  heading: string;
  leftHeading: string;
  rightHeading: string;
  leftSegments: DiffSegment[];
  rightSegments: DiffSegment[];
  changeLevel: "identical" | "stylistic" | "minor" | "significant";
}

// Known section heading synonyms for fuzzy matching
const HEADING_GROUPS: [string, RegExp][] = [
  ["indication", /indication/i],
  ["comparison", /comparison/i],
  ["technique", /technique/i],
  ["radiation", /radiation\s*dose/i],
  ["prior_studies", /prior\s+known/i],
  ["findings_header", /^findings$/i],
  ["lungs", /lung/i],
  ["mediastinum", /mediastin/i],
  ["heart", /^heart$|^cardiac$/i],
  ["vessels", /great\s+vessels|thoracic\s+aorta/i],
  ["osseous", /osseous|skeletal|bone/i],
  ["abdomen", /abdomen/i],
  ["impression", /impression/i],
  ["disclaimer", /disclaimer/i],
];

function normalizeHeading(heading: string): string {
  for (const [key, regex] of HEADING_GROUPS) {
    if (regex.test(heading)) return key;
  }
  return heading.toLowerCase().replace(/[^a-z]/g, "");
}

// Only these headings are recognized as section boundaries
const KNOWN_HEADINGS = [
  /^INDICATION$/i,
  /^COMPARISON$/i,
  /^TECHNIQUE$/i,
  /^RADIATION DOSE$/i,
  /^Prior known CT/i,
  /^FINDINGS$/i,
  /^Lungs and pleura$/i,
  /^Lungs$/i,
  /^Mediastinum/i,
  /^Heart$/i,
  /^Cardiac$/i,
  /^Great vessels$/i,
  /^Thoracic aorta$/i,
  /^Osseous structures/i,
  /^Skeletal structures/i,
  /^Bones$/i,
  /^Included.*abdomen$/i,
  /^Upper abdomen$/i,
  /^IMPRESSION$/i,
  /^DISCLAIMER$/i,
];

function isKnownHeading(heading: string): boolean {
  return KNOWN_HEADINGS.some((re) => re.test(heading.trim()));
}

export function parseReportSections(text: string): ReportSection[] {
  if (!text || !text.trim()) return [];

  const regex = /^([A-Z][A-Za-z\s/,()]+?):\s/gm;
  const matches: { index: number; heading: string; contentStart: number }[] = [];

  let match;
  while ((match = regex.exec(text)) !== null) {
    if (isKnownHeading(match[1].trim())) {
      matches.push({
        index: match.index,
        heading: match[1].trim(),
        contentStart: match.index + match[0].length,
      });
    }
  }

  if (matches.length === 0) {
    return [{ heading: "Full Text", normalizedHeading: "full", content: text.trim() }];
  }

  const sections: ReportSection[] = [];

  // Preamble before first section
  const preamble = text.slice(0, matches[0].index).trim();
  if (preamble) {
    sections.push({ heading: "Preamble", normalizedHeading: "preamble", content: preamble });
  }

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].contentStart;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const content = text.slice(start, end).trim();
    const heading = matches[i].heading;

    sections.push({
      heading,
      normalizedHeading: normalizeHeading(heading),
      content,
    });
  }

  return sections;
}

export function matchSections(
  leftSections: ReportSection[],
  rightSections: ReportSection[]
): { left: ReportSection | null; right: ReportSection | null; heading: string }[] {
  const result: { left: ReportSection | null; right: ReportSection | null; heading: string }[] = [];
  const usedRight = new Set<number>();

  for (const left of leftSections) {
    const rightIdx = rightSections.findIndex(
      (r, i) => !usedRight.has(i) && r.normalizedHeading === left.normalizedHeading
    );
    if (rightIdx >= 0) {
      usedRight.add(rightIdx);
      result.push({
        left,
        right: rightSections[rightIdx],
        heading: left.heading,
      });
    } else {
      result.push({ left, right: null, heading: left.heading });
    }
  }

  for (let i = 0; i < rightSections.length; i++) {
    if (!usedRight.has(i)) {
      result.push({ left: null, right: rightSections[i], heading: rightSections[i].heading });
    }
  }

  return result;
}

function classifyChangeLevel(leftText: string, rightText: string): SectionDiff["changeLevel"] {
  if (!leftText && !rightText) return "identical";
  if (leftText.trim() === rightText.trim()) return "identical";

  const normL = leftText.toLowerCase().replace(/\s+/g, " ").trim();
  const normR = rightText.toLowerCase().replace(/\s+/g, " ").trim();
  if (normL === normR) return "stylistic";

  const changes = diffWords(leftText.trim(), rightText.trim(), { ignoreCase: false });
  const totalWords = changes.reduce((sum, c) => sum + c.value.split(/\s+/).filter(Boolean).length, 0);
  const changedWords = changes
    .filter((c) => c.added || c.removed)
    .reduce((sum, c) => sum + c.value.split(/\s+/).filter(Boolean).length, 0);

  const changeRatio = changedWords / Math.max(totalWords, 1);

  if (changeRatio < 0.15) return "stylistic";
  if (changeRatio < 0.4) return "minor";
  return "significant";
}

export function computeSectionDiff(leftText: string, rightText: string): SectionDiff[] {
  const leftSections = parseReportSections(leftText);
  const rightSections = parseReportSections(rightText);
  const matched = matchSections(leftSections, rightSections);

  return matched.map(({ left, right, heading }) => {
    const lContent = left?.content ?? "";
    const rContent = right?.content ?? "";

    const changes = diffWords(lContent, rContent, { ignoreCase: false });

    const leftSegments: DiffSegment[] = [];
    const rightSegments: DiffSegment[] = [];

    for (const change of changes) {
      if (change.added) {
        rightSegments.push({ text: change.value, type: "added" });
      } else if (change.removed) {
        leftSegments.push({ text: change.value, type: "removed" });
      } else {
        leftSegments.push({ text: change.value, type: "equal" });
        rightSegments.push({ text: change.value, type: "equal" });
      }
    }

    return {
      heading,
      leftHeading: left?.heading ?? "",
      rightHeading: right?.heading ?? "",
      leftSegments,
      rightSegments,
      changeLevel: classifyChangeLevel(lContent, rContent),
    };
  });
}
