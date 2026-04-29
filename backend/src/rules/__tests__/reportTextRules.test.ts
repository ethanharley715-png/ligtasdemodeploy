import { describe, expect, it } from "@jest/globals";
import { detectQcIssuesFromText } from "../reportTextRules";

describe("detectQcIssuesFromText", () => {
  it("deduplicates identical placeholder matches on same section and page", () => {
    const text = `
      6. Fire Risk Assessment
      [XXX] [XXX] [XXX]
    `;

    const result = detectQcIssuesFromText(text);
    const placeholderIssues = result.issues.filter((issue) => issue.ruleKey === "placeholder_value");

    expect(placeholderIssues).toHaveLength(1);
  });

  it("keeps distinct placeholder contexts in the same section/page", () => {
    const text = `
      6. Summary
      [XXX] [00:00] [X]
    `;

    const result = detectQcIssuesFromText(text);
    const placeholderIssues = result.issues.filter((issue) => issue.ruleKey === "placeholder_value");

    expect(placeholderIssues).toHaveLength(3);
    expect(placeholderIssues.map((issue) => issue.context)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("[XXX]"),
        expect.stringContaining("[00:00]"),
        expect.stringContaining("[X]"),
      ]),
    );
  });

  it("detects broad placeholder variants under placeholder_value", () => {
    const text = `
      4. Summary
      [XXX]
      XXXXX
      XXX
      [00:00]
      [X]
      [XXXX]
      TBC
      N/A
      <placeholder>
    `;

    const result = detectQcIssuesFromText(text);
    const placeholderIssues = result.issues.filter((issue) => issue.ruleKey === "placeholder_value");

    expect(placeholderIssues.map((issue) => issue.context)).toEqual(
      expect.arrayContaining([
        "[XXX]",
        "XXXXX",
        "XXX",
        "[00:00]",
        "[X]",
        "[XXXX]",
        "TBC",
        "N/A",
        "<placeholder>",
      ]),
    );
    expect(placeholderIssues.every((issue) => issue.message === "Placeholder value detected.")).toBe(true);
  });

  it("keeps bracketed options separate from generic placeholders", () => {
    const text = `
      6. Summary
      [available / not available]
      [verbal / written]
      [Retail / Assembly / Industrial / Commercial / Office]
      [addressable ***OR*** conventional]
    `;

    const result = detectQcIssuesFromText(text);
    const optionIssues = result.issues.filter((issue) => issue.ruleKey === "placeholder_bracket_option");

    expect(optionIssues).toHaveLength(4);
    expect(optionIssues.every((issue) => issue.message === "Bracketed template option detected.")).toBe(true);
    expect(result.issues.some((issue) => issue.ruleKey === "placeholder_value")).toBe(false);
  });

  it("uses guidance rules for delete instructions and section instruction phrases", () => {
    const text = `
      Delete as applicable.
      DELETE IN SQUARE BRACKETS AS APPLICABLE
      This section is to describe the site.
      This section should list all findings.
      This section should contain the final values.
    `;

    const result = detectQcIssuesFromText(text);

    expect(result.issues.filter((issue) => issue.ruleKey === "template_delete_guidance")).toHaveLength(2);
    expect(result.issues.filter((issue) => issue.ruleKey === "template_instruction_phrase")).toHaveLength(3);
  });

  it("cleans report reference noise from section headings", () => {
    const text = `
      6. Fire Risk Assessment - 162155
      [XXX]
    `;

    const result = detectQcIssuesFromText(text);
    const issue = result.issues.find((candidate) => candidate.ruleKey === "placeholder_value");

    expect(issue?.sectionName).toBe("6. Fire Risk Assessment");
    expect(issue?.pageNumber).toBe(1);
    expect(issue?.context).toBe("[XXX]");
  });

  it("keeps repeated detections across different sections", () => {
    const text = `
      3. Utilities
      This section should describe utilities.

      4. Construction Details
      This section should describe construction details.

      5. Employed Staff on Site
      This section should list employed staff.

      6. Fire Risk Assessment - 162155
      This section should contain the fire risk assessment.
    `;

    const result = detectQcIssuesFromText(text);
    const guidanceIssues = result.issues.filter((issue) => issue.ruleKey === "template_instruction_phrase");

    expect(guidanceIssues).toHaveLength(4);
    expect(guidanceIssues.map((issue) => issue.sectionName)).toEqual([
      "3. Utilities",
      "4. Construction Details",
      "5. Employed Staff on Site",
      "6. Fire Risk Assessment",
    ]);
  });

  it("keeps missing-information only when placeholder or guidance signals exist", () => {
    const completeLookingText = `
      This report includes site address, date of assessment, and risk to relevant persons.
      It includes recommendations and an action plan summary.
    `;
    const completeLookingResult = detectQcIssuesFromText(completeLookingText);
    expect(completeLookingResult.issues.some((issue) => issue.type === "MISSING_INFORMATION")).toBe(false);

    const templateText = `
      The template text is:
      Insert final details for site address and reference number here.
      This section should contain your significant findings.
    `;
    const templateResult = detectQcIssuesFromText(templateText);
    expect(templateResult.issues.some((issue) => issue.type === "MISSING_INFORMATION")).toBe(true);
  });

  it("allows a template-heavy document to exceed the previous low per-type cap", () => {
    const placeholderLines = Array.from({ length: 16 }, (_, index) => `[XXX-${index}]`).join("\n");
    const text = `
      6. Fire Risk Assessment
      ${placeholderLines}
    `;

    const result = detectQcIssuesFromText(text);
    const placeholderIssues = result.issues.filter((issue) => issue.ruleKey === "placeholder_value");

    expect(placeholderIssues).toHaveLength(16);
  });
});
