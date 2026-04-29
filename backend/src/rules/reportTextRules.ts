import { reportUploadConfig } from "../config/reportUploadConfig";
import { type QcIssue, type RuleDetectionResult } from "./types";
import { collectSectionHeadings, findNearestSectionName } from "../utils/text/sectionLocator";

type DetectionOptions = {
  wordsPerPage?: number;
  maxIssuesPerType?: number;
};

type RequiredFieldRule = {
  key: string;
  label: string;
  patterns: RegExp[];
};

type MatchIssueRule = {
  ruleKey: string;
  type: QcIssue["type"];
  pattern: RegExp;
  message: (matchedText: string) => string;
  suggestion: string;
};

const PLACEHOLDER_RULES: MatchIssueRule[] = [
  {
    ruleKey: "placeholder_value",
    type: "TEMPLATE_ARTIFACT",
    pattern:
      /\[(?![^\]\n]*(?:\/|\bOR\b))(?:[^\]\n]{1,40})\]|\bX{3,}\b|<[^>\n]{1,40}>|\bTBC\b|\bN\/A\b/gi,
    message: () => "Placeholder value detected.",
    suggestion: "Replace placeholder values with real report details.",
  },
  {
    ruleKey: "placeholder_bracket_option",
    type: "TEMPLATE_ARTIFACT",
    pattern: /\[[^\]\n]{1,40}(?:\/|\*{0,3}\s*OR\s*\*{0,3})[^\]\n]{1,40}\]/gi,
    message: () => "Bracketed template option detected.",
    suggestion: "Replace bracketed template options with the correct final value.",
  },
  {
    ruleKey: "template_phrase",
    type: "TEMPLATE_ARTIFACT",
    pattern: /the template text is:?/gi,
    message: () => "Template instruction text detected.",
    suggestion: "Remove template instruction text before submission.",
  },
];

const GUIDANCE_RULES: MatchIssueRule[] = [
  {
    ruleKey: "template_delete_guidance",
    type: "UNREMOVED_GUIDANCE",
    pattern: /delete(?: in square brackets)? as (?:appropriate|applicable)/gi,
    message: () => "Delete-as-applicable guidance detected.",
    suggestion: "Delete drafting guidance text before submission.",
  },
  {
    ruleKey: "template_instruction_phrase",
    type: "UNREMOVED_GUIDANCE",
    pattern:
      /\bthis section should contain\b|\bthis section should list\b|\bthis section should\b|\bthis section is to\b|\bto be completed\b|\binsert\b/gi,
    message: () => "Template guidance phrase detected.",
    suggestion: "Delete drafting guidance text before submission.",
  },
];

const CHECKLIST_PROFILE_PATTERNS: RegExp[] = [
  /check\s*list/gi,
  /appendix d/gi,
  /shall include the following details/gi,
  /internal use only/gi,
  /hse-tgd-f-001/gi,
];

const REQUIRED_FIELD_RULES: RequiredFieldRule[] = [
  {
    key: "assessment_date",
    label: "assessment date",
    patterns: [/visit date/i, /date\(s\)\s+on\s+which\s+the assessment was carried out/i, /date of assessment/i],
  },
  {
    key: "site_address",
    label: "site address",
    patterns: [/site address/i, /location of premises/i, /premises details/i],
  },
  {
    key: "client_identity",
    label: "client identity",
    patterns: [/prepared for/i, /identity of the client/i],
  },
  {
    key: "significant_findings",
    label: "significant findings",
    patterns: [/significant finding/i, /significant findings/i, /\bsummary\b/i],
  },
  {
    key: "overall_risk",
    label: "overall risk assessment",
    patterns: [/overall assessment of risk/i, /risk to relevant persons/i],
  },
  {
    key: "actions",
    label: "action plan",
    patterns: [/action plan/i, /list of actions arising/i, /recommendation/i],
  },
  {
    key: "reference_identifier",
    label: "reference identifier",
    patterns: [/reference number/i, /unique reference identifier/i],
  },
];

function toMatches(text: string, pattern: RegExp): RegExpMatchArray[] {
  return [...text.matchAll(pattern)];
}

function estimatePageNumber(text: string, index: number, wordsPerPage: number): number {
  const wordsUpToMatch = (text.slice(0, index).match(/\S+/g) ?? []).length;
  return Math.max(1, Math.ceil(wordsUpToMatch / wordsPerPage));
}

function contextSnippet(text: string, index: number, radius = 90): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);
  return text
    .slice(start, end)
    .replace(/\s+/g, " ")
    .trim();
}

function lineSnippetAtIndex(text: string, index: number): string {
  const start = text.lastIndexOf("\n", Math.max(0, index - 1)) + 1;
  const nextNewline = text.indexOf("\n", index);
  const end = nextNewline === -1 ? text.length : nextNewline;
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

function isWeakMatchedAnchor(value: string): boolean {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return true;
  }

  if (normalized.length < 12) {
    return true;
  }

  if (/^\[?[Xx]{3,}\]?$/.test(normalized)) {
    return true;
  }

  if (/^(?:delete(?: in square brackets)? as (?:appropriate|applicable)|this section should(?: contain| list)?|this section is to|to be completed|insert)$/i.test(normalized)) {
    return true;
  }

  return false;
}

function normalizeForKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeSnippet(value: string, maxLength = 120): string {
  const collapsed = value.replace(/\s+/g, " ").trim();
  if (collapsed.length <= maxLength) {
    return collapsed;
  }
  return `${collapsed.slice(0, maxLength - 3)}...`;
}

function normalizeRuleSectionHeading(line: string): string | null {
  const normalized = line
    .trim()
    .replace(/\bpage\s+\d+\b/gi, "")
    .replace(/\s+-\s+\d{5,}\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!/^\d+(?:\.\d+)*\.\s+\S/.test(normalized)) {
    return null;
  }

  const headingBody = normalized.replace(/^\d+(?:\.\d+)*\.\s+/, "").trim();
  if (!/[a-z]/i.test(headingBody)) {
    return null;
  }

  return normalized;
}

function collectRuleSectionHeadings(text: string): ReturnType<typeof collectSectionHeadings> {
  const approvedHeadings = collectSectionHeadings(text);
  const headingsByOffset = new Map(approvedHeadings.map((heading) => [heading.startIndex, heading]));

  const lines = text.split("\n");
  let offset = 0;

  for (const line of lines) {
    if (!headingsByOffset.has(offset)) {
      const title = normalizeRuleSectionHeading(line);
      if (title) {
        headingsByOffset.set(offset, {
          startIndex: offset,
          title,
        });
      }
    }

    offset += line.length + 1;
  }

  return [...headingsByOffset.values()].sort((left, right) => left.startIndex - right.startIndex);
}

function buildIssueFromMatch(
  text: string,
  index: number,
  sectionLines: ReturnType<typeof collectSectionHeadings>,
  rule: MatchIssueRule,
  matchedText: string,
  wordsPerPage: number,
): QcIssue {
  const page = estimatePageNumber(text, index, wordsPerPage);
  const safeMatchedText = sanitizeSnippet(matchedText, 80) || sanitizeSnippet(contextSnippet(text, index), 80);
  const lineSnippet = sanitizeSnippet(lineSnippetAtIndex(text, index), 160);
  const issueContext =
    isWeakMatchedAnchor(safeMatchedText) && lineSnippet && lineSnippet !== safeMatchedText
      ? `${safeMatchedText}\n${lineSnippet}`
      : safeMatchedText;

  return {
    type: rule.type,
    ruleKey: rule.ruleKey,
    message: rule.message(safeMatchedText),
    suggestion: rule.suggestion,
    location: `Approx. page ${page}`,
    sectionName: findNearestSectionName(index, sectionLines),
    context: issueContext,
    pageNumber: page,
    matchIndex: index,
  };
}

function appendBoundedIssues(
  target: QcIssue[],
  additions: QcIssue[],
  maxIssuesPerType: number,
  type: QcIssue["type"],
): void {
  const existingCount = target.filter((issue) => issue.type === type).length;
  const remainingSlots = Math.max(0, maxIssuesPerType - existingCount);
  if (remainingSlots === 0) {
    return;
  }

  target.push(...additions.slice(0, remainingSlots));
}

function dedupeIssues(issues: QcIssue[]): QcIssue[] {
  const seen = new Set<string>();
  const deduped: QcIssue[] = [];

  for (const issue of issues) {
    const dedupeKey = [
      issue.type,
      normalizeForKey(issue.sectionName ?? ""),
      String(issue.pageNumber ?? -1),
      normalizeForKey(issue.message),
      normalizeForKey(issue.suggestion),
      normalizeForKey(issue.context),
      normalizeForKey(issue.ruleKey),
    ].join("|");

    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    deduped.push(issue);
  }

  return deduped;
}

export function detectQcIssuesFromText(
  rawText: string,
  options: DetectionOptions = {},
): RuleDetectionResult {
  const text = rawText.replace(/\r/g, "");
  const wordsPerPage = options.wordsPerPage ?? reportUploadConfig.wordsPerPageHeuristic;
  const maxIssuesPerType = options.maxIssuesPerType ?? 25;
  const issues: QcIssue[] = [];

  if (!text.trim()) {
    issues.push({
      type: "MISSING_INFORMATION",
      ruleKey: "missing_information_no_text",
      message: "No readable report text was extracted from this session.",
      suggestion: "Upload a text-based PDF and ensure the document is not corrupted.",
      location: "Whole document",
      sectionName: null,
      context: "No extractable text content.",
      pageNumber: null,
      matchIndex: null,
    });
    return { issues: dedupeIssues(issues) };
  }

  const sectionLines = collectRuleSectionHeadings(text);

  const checklistSignals = CHECKLIST_PROFILE_PATTERNS.reduce((count, pattern) => {
    return count + toMatches(text, pattern).length;
  }, 0);

  if (checklistSignals >= 2) {
    issues.push({
      type: "TEMPLATE_ARTIFACT",
      ruleKey: "template_checklist_profile",
      message: "Checklist/template profile detected in report content.",
      suggestion: "Upload the completed assessment report instead of checklist guidance content.",
      location: "Whole document",
      sectionName: null,
      context: "Checklist/template profile detected from repeated guidance headings.",
      pageNumber: null,
      matchIndex: null,
    });
  }

  const typeMatchCounts: Record<QcIssue["type"], number> = {
    TEMPLATE_ARTIFACT: 0,
    UNREMOVED_GUIDANCE: 0,
    MISSING_INFORMATION: 0,
    CONTRADICTION: 0,
    LIMITATION_CONTRADICTION: 0,
    INCOMPLETE_LIMITATIONS: 0,
  };

  for (const rule of [...PLACEHOLDER_RULES, ...GUIDANCE_RULES]) {
    const matches = toMatches(text, rule.pattern);
    const additions = matches.map((match) =>
      buildIssueFromMatch(
        text,
        match.index ?? 0,
        sectionLines,
        rule,
        match[0] ?? "",
        wordsPerPage,
      ),
    );

    appendBoundedIssues(issues, additions, maxIssuesPerType, rule.type);
    typeMatchCounts[rule.type] += matches.length;
  }

  const allowMissingInfoChecks =
    checklistSignals >= 2 ||
    typeMatchCounts.TEMPLATE_ARTIFACT > 0 ||
    typeMatchCounts.UNREMOVED_GUIDANCE > 0;

  if (allowMissingInfoChecks) {
    for (const fieldRule of REQUIRED_FIELD_RULES) {
      const present = fieldRule.patterns.some((pattern) => pattern.test(text));
      if (present) {
        continue;
      }

      issues.push({
        type: "MISSING_INFORMATION",
        ruleKey: `missing_information_${fieldRule.key}`,
        message: `Missing required information: ${fieldRule.label}.`,
        suggestion: `Add ${fieldRule.label} details before submitting for QC.`,
        location: "Whole document",
        sectionName: null,
        context: `No anchor terms detected for ${fieldRule.label}.`,
        pageNumber: null,
        matchIndex: null,
      });
    }
  }

  return { issues: dedupeIssues(issues) };
}
