export type QcIssueTypeKey =
  | "template_artifact"
  | "unremoved_guidance"
  | "missing_information"
  | "contradiction"
  | "limitation_contradiction"
  | "incomplete_limitations";

export type PersistedIssueType =
  | "TEMPLATE_ARTIFACT"
  | "UNREMOVED_GUIDANCE"
  | "MISSING_INFORMATION"
  | "CONTRADICTION"
  | "LIMITATION_CONTRADICTION"
  | "INCOMPLETE_LIMITATIONS";

export type QcIssue = {
  type: PersistedIssueType;
  ruleKey: string;
  message: string;
  suggestion: string;
  location: string;
  sectionName: string | null;
  context: string;
  pageNumber: number | null;
  matchIndex: number | null;
};

export type RuleDetectionResult = {
  issues: QcIssue[];
};

export const ISSUE_TYPE_KEY_MAP: Record<PersistedIssueType, QcIssueTypeKey> = {
  TEMPLATE_ARTIFACT: "template_artifact",
  UNREMOVED_GUIDANCE: "unremoved_guidance",
  MISSING_INFORMATION: "missing_information",
  CONTRADICTION: "contradiction",
  LIMITATION_CONTRADICTION: "limitation_contradiction",
  INCOMPLETE_LIMITATIONS: "incomplete_limitations",
};


