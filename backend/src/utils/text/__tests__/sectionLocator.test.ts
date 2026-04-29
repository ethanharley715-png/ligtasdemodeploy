import { describe, expect, it } from "@jest/globals";
import {
  collectSectionHeadings,
  findNearestSectionName,
  findNormalizedTextMatchIndex,
  findNormalizedTextMatchIndices,
  normalizeApprovedSectionHeading,
  normalizeApprovedSectionReference,
} from "../sectionLocator";

describe("sectionLocator", () => {
  it("collects cleaned report section headings", () => {
    const headings = collectSectionHeadings(`
1. Summary
Body text
5.7. Construction Details - 162155
More body text
9.6. Fire Protection Systems - Fire Alarm
    `);

    expect(headings.map((heading) => heading.title)).toEqual([
      "1. Summary",
      "5.7. Construction Details",
      "9.6. Fire Protection Systems - Fire Alarm",
    ]);
  });

  it("finds the nearest heading before a text match", () => {
    const text = `
5.7. Construction Details
Building Size: XXXXX sq. Ft

5.8. Building Classification
Commercial
    `.trim();
    const headings = collectSectionHeadings(text);
    const matchIndex = text.indexOf("Building Size: XXXXX sq. Ft");

    expect(findNearestSectionName(matchIndex, headings)).toBe("5.7. Construction Details");
  });

  it("matches text across whitespace differences like a ctrl+f fallback", () => {
    const text = "Ligtas Limited - Internal Use Only\nLatest version is available on Sharepoint";
    const candidate = "Ligtas Limited - Internal Use Only Latest version is available on Sharepoint";

    expect(findNormalizedTextMatchIndex(text, candidate)).toBe(0);
  });

  it("returns every matching occurrence for repeated quote anchors", () => {
    const text = `
5.8. Building Classification
The template text is:

5.9. Fire Evacuation Policy
The template text is:
    `.trim();

    expect(findNormalizedTextMatchIndices(text, "The template text is:")).toHaveLength(2);
  });

  it("ignores merged table headers when collecting section headings", () => {
    const headings = collectSectionHeadings(`
10. Tenant(s) Monitoring
TenantExisting Control Measure / RemarksAction RequiredL/R
Item Description
[XXXX] people are employed on site by the tenant.
    `);

    expect(headings.map((heading) => heading.title)).toEqual(["10. Tenant(s) Monitoring"]);
  });

  it("only keeps exact numbered approved headings from extracted page text", () => {
    const headings = collectSectionHeadings(`
8. Fire Risk Assessment
High Risk Action(s) requiring immediate attention are as follows:
Fire Evacuation Policy
    `);

    expect(headings.map((heading) => heading.title)).toEqual(["8. Fire Risk Assessment"]);
  });

  it("normalizes approved headings to canonical numbered titles", () => {
    expect(normalizeApprovedSectionHeading("Fire Risk Assessment")).toBe("8. Fire Risk Assessment");
    expect(normalizeApprovedSectionHeading("5.9. Fire Evacuation Policy")).toBe(
      "5.9. Fire Evacuation Policy",
    );
    expect(normalizeApprovedSectionHeading("High Risk Action(s) requiring immediate attention")).toBeNull();
  });

  it("expands shorthand or noisy approved section references to canonical titles", () => {
    expect(normalizeApprovedSectionReference("9.5")).toBe("9.5. Training (Fire)");
    expect(normalizeApprovedSectionReference("9.5.")).toBe("9.5. Training (Fire)");
    expect(normalizeApprovedSectionReference("9.3ruwihaurawhruaw")).toBe(
      "9.3. Electrical Matters",
    );
    expect(normalizeApprovedSectionReference("10.")).toBe("10. Tenant(s) Monitoring");
    expect(normalizeApprovedSectionReference("1. summary")).toBe("1. Summary");
  });

  it("ignores footer lines that look like report title headings", () => {
    const headings = collectSectionHeadings(`
10. Tenant(s) Monitoring
Tenant row content
Fire Risk Assessment - 162155
    `);

    expect(headings.map((heading) => heading.title)).toEqual(["10. Tenant(s) Monitoring"]);
  });
});
