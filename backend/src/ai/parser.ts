import { AIResponse, ALLOWED_TYPES, Issue, IssueType } from "./types";

const ALLOWED_TYPE_SET = new Set<string>(ALLOWED_TYPES);

function extractFirstJsonObject(text: string): string | null {
  let open = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{") {
      if (open === 0) {
        start = i;
      }
      open += 1;
    } else if (char === "}") {
      open -= 1;
      if (open === 0 && start !== -1) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeType(value: unknown): IssueType {
  const rawType = asString(value).toUpperCase();

  if (ALLOWED_TYPE_SET.has(rawType)) {
    return rawType as IssueType;
  }

  if (["BRACKETED_TEXT_NOT_REMOVED", "PLACEHOLDER_TEXT", "TEMPLATE_PLACEHOLDER"].includes(rawType)) {
    return "TEMPLATE_ARTIFACT";
  }

  return "MISSING_INFORMATION";
}

function normalizeConfidence(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));

  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return Math.min(Math.max(parsed, 0), 1);
}

function normalizePageNumber(value: unknown): number | null | undefined {
  if (value == null || value === "") {
    return undefined;
  }

  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeIssue(rawIssue: unknown): Issue | null {
  if (!rawIssue || typeof rawIssue !== "object") {
    return null;
  }

  const raw = rawIssue as Record<string, unknown>;
  const quote =
    asString(raw.quote) ||
    asString(raw.evidence) ||
    asString(raw.contextSnippet) ||
    asString(raw.context);
  const description =
    asString(raw.description) ||
    asString(raw.message) ||
    asString(raw.issue) ||
    quote;
  const section =
    asString(raw.section) ||
    asString(raw.sectionName) ||
    asString(raw.location) ||
    "Unknown";

  if (!description && !quote) {
    return null;
  }

  return {
    type: normalizeType(raw.type ?? raw.category),
    description: description || "AI detected issue.",
    section,
    quote: quote || undefined,
    suggestedAction: asString(raw.suggestedAction) || asString(raw.suggestion) || undefined,
    severity: asString(raw.severity) || undefined,
    pageNumber: normalizePageNumber(raw.pageNumber ?? raw.page),
    confidence: normalizeConfidence(raw.confidence),
  };
}

export async function safeParse(raw: string): Promise<AIResponse> {
  const jsonString = extractFirstJsonObject(raw);

  if (!jsonString) {
    return { issues: [] };
  }

  const parsed = JSON.parse(jsonString) as { issues?: unknown };
  if (!Array.isArray(parsed.issues)) {
    return { issues: [] };
  }

  return {
    issues: parsed.issues
      .map(normalizeIssue)
      .filter((issue): issue is Issue => issue != null),
  };
}
