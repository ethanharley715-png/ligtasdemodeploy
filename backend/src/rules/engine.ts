type RuleInput = Record<string, unknown>;

export type RuleViolation = {
  code: string;
  message: string;
};

export type RuleCheckResult = {
  ok: boolean;
  violations: RuleViolation[];
};

import { detectQcIssuesFromText } from "./reportTextRules";
import { ISSUE_TYPE_KEY_MAP, } from "./types";

export function evaluateRules(input: RuleInput): RuleCheckResult {
  const text = typeof input.text === "string" ? input.text : "";
  const result = detectQcIssuesFromText(text);
  const violations: RuleViolation[] = result.issues.map((issue) => ({
    code: ISSUE_TYPE_KEY_MAP[issue.type].toUpperCase(),
    message: issue.message,
  }));

  return {
    ok: violations.length === 0,
    violations,
  };
}

