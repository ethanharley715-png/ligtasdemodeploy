export type SectionHeading = {
  startIndex: number;
  title: string;
};

const APPROVED_SECTION_HEADINGS = [
  "1. Summary",
  "2. Competent Persons",
  "3. Introduction",
  "4. Terms and Definitions",
  "4.1. Fire Safety Order",
  "4.2. Fire Safety Arrangements",
  "4.3. Standards/Approved Codes of Practices and European Norms",
  "5. Premises Details",
  "5.1. On-site Contacts",
  "5.2. Clients Nominated Responsible Person(s) For Fire Safety",
  "5.3. Location of Premises",
  "5.4. Owner",
  "5.5. Managing Agent",
  "5.6. Description of Undertakings",
  "5.7. Construction Details",
  "5.8. Building Classification",
  "5.9. Fire Evacuation Policy",
  "5.10. Utilities",
  "5.11. Usage",
  "5.12. Enforcement",
  "5.13. Employed Staff on Site",
  "5.14. Persons at Risk",
  "6. Limitations of Report",
  "7. Resume of the brief",
  "8. Fire Risk Assessment",
  "9. Risk Assessment and Action Plan",
  "9.1. Fire Safety Management",
  "9.2. Site Security",
  "9.3. Electrical Matters",
  "9.4. Deliberate or Malicious Ignition",
  "9.5. Training (Fire)",
  "9.6. Fire Protection Systems - Fire Alarm",
  "9.7. Compartmentation",
  "9.8. Fire Extinguishers",
  "9.9. Hose Reels",
  "9.10. Smoke Control Systems",
  "9.11. Dry/Wet Riser",
  "9.12. Sprinkler System",
  "9.13. Gaseous Suppression Systems",
  "9.14. Fire Hydrants",
  "9.15. Emergency Procedures",
  "9.16. Means of Escape",
  "9.17. Emergency Lighting",
  "9.18. Highly Flammable Liquids",
  "9.19. Liquefied Petroleum Gas",
  "9.20. General Fire Safety",
  "9.21. Grainger PLC - Fire Safety Management",
  "10. Tenant(s) Monitoring",
] as const;

function normalizeSectionLookupKey(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function removeSectionNumberPrefix(value: string): string {
  return value.replace(/^\d+(?:\.\d+)*\.\s*/, "").trim();
}

const APPROVED_SECTION_HEADING_LOOKUP = new Map<string, string>(
  APPROVED_SECTION_HEADINGS.flatMap((heading) => {
    const bareHeading = removeSectionNumberPrefix(heading);
    return [
      [normalizeSectionLookupKey(heading), heading],
      [normalizeSectionLookupKey(bareHeading), heading],
    ] as const;
  }),
);

const APPROVED_EXTRACTED_SECTION_HEADING_LOOKUP = new Map<string, string>(
  APPROVED_SECTION_HEADINGS.map((heading) => [normalizeSectionLookupKey(heading), heading] as const),
);

const APPROVED_SECTION_HEADING_BY_NUMBER = new Map(
  APPROVED_SECTION_HEADINGS.map((heading) => {
    const numberMatch = heading.match(/^(\d+(?:\.\d+)*)\.\s/);
    if (!numberMatch) {
      throw new Error(`Approved section heading is missing its numeric prefix: ${heading}`);
    }

    return [numberMatch[1], heading] as const;
  }),
);

export function normalizeApprovedSectionHeading(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  return APPROVED_SECTION_HEADING_LOOKUP.get(normalizeSectionLookupKey(normalized)) ?? null;
}

export function normalizeApprovedSectionReference(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  const canonicalHeading = normalizeApprovedSectionHeading(normalized);
  if (canonicalHeading) {
    return canonicalHeading;
  }

  const numericPrefixMatch = normalized.match(/^(\d+(?:\.\d+)*)(?:\.)?(?=$|[^0-9])/);
  if (!numericPrefixMatch) {
    return null;
  }

  return APPROVED_SECTION_HEADING_BY_NUMBER.get(numericPrefixMatch[1]) ?? null;
}

const IGNORED_SECTION_HEADING_PATTERNS = [
  /^item description$/i,
  /^completion notes$/i,
  /^tenantexisting control measure/i,
  /^tenant existing control measure/i,
  /^existing control measure/i,
  /remarksaction required/i,
  /action requiredl\/r/i,
  /^fire risk assessment\s*-\s*\d+$/i,
] as const;

function isIgnoredSectionHeading(line: string): boolean {
  const trimmed = line.trim();
  return IGNORED_SECTION_HEADING_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function normalizeExtractedSectionHeading(line: string): string | null {
  if (isIgnoredSectionHeading(line)) {
    return null;
  }

  const normalized = line
    .trim()
    .replace(/\bpage\s+\d+\b/gi, "")
    .replace(/\s+-\s+\d{5,}\b/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);

  return APPROVED_EXTRACTED_SECTION_HEADING_LOOKUP.get(normalizeSectionLookupKey(normalized)) ?? null;
}

export function collectSectionHeadings(text: string): SectionHeading[] {
  const lines = text.split("\n");
  const sections: SectionHeading[] = [];
  let offset = 0;

  for (const line of lines) {
    const title = normalizeExtractedSectionHeading(line);
    if (title) {
      sections.push({
        startIndex: offset,
        title,
      });
    }

    offset += line.length + 1;
  }

  return sections;
}

export function findNearestSectionName(
  index: number,
  sectionHeadings: SectionHeading[],
): string | null {
  for (let headingIndex = sectionHeadings.length - 1; headingIndex >= 0; headingIndex -= 1) {
    if (sectionHeadings[headingIndex].startIndex <= index) {
      return sectionHeadings[headingIndex].title;
    }
  }

  return null;
}

function buildNormalizedSearchIndex(value: string): {
  normalized: string;
  originalIndices: number[];
} {
  // Keep a map back to source offsets so whitespace-normalized matches still anchor to original text.
  let normalized = "";
  const originalIndices: number[] = [];
  let pendingSpace = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];

    if (/\s/.test(char)) {
      pendingSpace = normalized.length > 0;
      continue;
    }

    if (pendingSpace) {
      normalized += " ";
      originalIndices.push(index);
      pendingSpace = false;
    }

    normalized += char.toLowerCase();
    originalIndices.push(index);
  }

  return { normalized, originalIndices };
}

export function findNormalizedTextMatchIndex(text: string, candidate: string): number | null {
  return findNormalizedTextMatchIndices(text, candidate)[0] ?? null;
}

export function findNormalizedTextMatchIndices(text: string, candidate: string): number[] {
  const trimmedCandidate = candidate.trim();
  if (!trimmedCandidate) {
    return [];
  }

  const normalizedText = buildNormalizedSearchIndex(text);
  const normalizedCandidate = buildNormalizedSearchIndex(trimmedCandidate);
  if (!normalizedCandidate.normalized) {
    return [];
  }

  const indices: number[] = [];
  let fromIndex = 0;

  while (fromIndex < normalizedText.normalized.length) {
    const normalizedIndex = normalizedText.normalized.indexOf(
      normalizedCandidate.normalized,
      fromIndex,
    );

    if (normalizedIndex === -1) {
      break;
    }

    const originalIndex = normalizedText.originalIndices[normalizedIndex];
    if (originalIndex != null) {
      indices.push(originalIndex);
    }

    fromIndex = normalizedIndex + 1;
  }

  return indices;
}
