import { IssueType } from "@prisma/client";
import {
  getConsultantQualitySignals,
  getAnalyticsIssueTypes,
  getAnalyticsKpis,
  getAnalyticsSectionDensity,
  getAnalyticsTrends,
  getRecurringIssueRate,
  parseAnalyticsFilters,
} from "../analyticsService";

jest.mock("../../db/prisma", () => ({
  prisma: {
    report: {
      count: jest.fn(),
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
    issue: {
      groupBy: jest.fn(),
      count: jest.fn(),
    },
  },
}));

const { prisma } = jest.requireMock("../../db/prisma") as {
  prisma: {
    report: {
      count: jest.Mock;
      aggregate: jest.Mock;
      findMany: jest.Mock;
    };
    issue: {
      groupBy: jest.Mock;
      count: jest.Mock;
    };
  };
};

describe("analyticsService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("parses analytics filters from explicit query params", () => {
    const filters = parseAnalyticsFilters({
      dateFrom: "2026-03-01",
      dateTo: "2026-03-10",
      consultantId: "12",
      issueType: "MISSING_INFORMATION",
    });

    expect(filters.consultantId).toBe(12);
    expect(filters.issueType).toBe("MISSING_INFORMATION");
    expect(filters.dateFrom.toISOString()).toBe("2026-03-01T00:00:00.000Z");
    expect(filters.dateTo.toISOString()).toBe("2026-03-10T23:59:59.999Z");
  });

  it("computes v1 KPI cards from report and issue aggregates", async () => {
    prisma.report.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(3);
    prisma.report.aggregate
      .mockResolvedValueOnce({ _avg: { totalIssues: 2.4 } })
      .mockResolvedValueOnce({ _avg: { totalIssues: 3.25 } });
    prisma.issue.groupBy.mockResolvedValueOnce([
      { type: "TEMPLATE_ARTIFACT" },
      { type: "UNREMOVED_GUIDANCE" },
    ]);

    const result = await getAnalyticsKpis({
      dateFrom: new Date("2026-03-01T00:00:00.000Z"),
      dateTo: new Date("2026-03-31T23:59:59.999Z"),
    });

    expect(result).toEqual({
      totalAnalyses: 10,
      analysesWithIssuesPercentage: 60,
      averageIssuesPerAnalysis: 2.4,
      distinctIssueCategories: 2,
      reportsThisMonth: 10,
      reportsLastMonth: 8,
      avgIssuesPerReport: 2.4,
      avgIssuesLastMonth: 3.25,
      passRate: 40,
      passRateLastMonth: 62.5,
      timeSaved: 150,
    });
  });

  it("builds trend points with issue counts filtered by category", async () => {
    prisma.report.findMany.mockResolvedValueOnce([
      {
        analyzedAt: new Date("2026-03-01T10:00:00.000Z"),
        totalIssues: 5,
        issues: [
          { type: IssueType.TEMPLATE_ARTIFACT, reviewStatus: "FALSE_POSITIVE" },
          { type: IssueType.TEMPLATE_ARTIFACT, reviewStatus: "OPEN" },
        ],
      },
      {
        analyzedAt: new Date("2026-03-02T10:00:00.000Z"),
        totalIssues: 3,
        issues: [{ type: IssueType.TEMPLATE_ARTIFACT, reviewStatus: "OPEN" }],
      },
    ]);

    const result = await getAnalyticsTrends({
      dateFrom: new Date("2026-03-01T00:00:00.000Z"),
      dateTo: new Date("2026-03-03T23:59:59.999Z"),
      issueType: IssueType.TEMPLATE_ARTIFACT,
    });

    const activeBuckets = result.filter((point) => point.analyses > 0 || point.issues > 0);

    expect(activeBuckets).toEqual([
      { label: "01 Mar", analyses: 1, issues: 2, falsePositives: 1 },
      { label: "02 Mar", analyses: 1, issues: 1, falsePositives: 0 },
    ]);
  });

  it("returns labelled issue-type distribution and excludes unknown sections from density buckets", async () => {
    prisma.issue.groupBy
      .mockResolvedValueOnce([
        { type: IssueType.TEMPLATE_ARTIFACT, _count: { type: 4 } },
        { type: IssueType.MISSING_INFORMATION, _count: { type: 2 } },
      ])
      .mockResolvedValueOnce([
        { sectionName: "Summary", _count: { sectionName: 3 } },
        { sectionName: null, _count: { sectionName: 1 } },
      ]);
    prisma.report.count.mockResolvedValueOnce(4);

    const issueTypes = await getAnalyticsIssueTypes({
      dateFrom: new Date("2026-03-01T00:00:00.000Z"),
      dateTo: new Date("2026-03-31T23:59:59.999Z"),
    });
    const density = await getAnalyticsSectionDensity({
      dateFrom: new Date("2026-03-01T00:00:00.000Z"),
      dateTo: new Date("2026-03-31T23:59:59.999Z"),
    });

    expect(issueTypes).toEqual([
      { issueType: "TEMPLATE_ARTIFACT", label: "Template Artifact", count: 4 },
      { issueType: "MISSING_INFORMATION", label: "Missing Information", count: 2 },
    ]);
    expect(density).toHaveLength(10);
    expect(density).toContainEqual({ section: "1. Summary", issueCount: 3, issueDensity: 0.75 });
    expect(density).toContainEqual({ section: "2. Competent Persons", issueCount: 0, issueDensity: 0 });
    expect(density.some((bucket) => bucket.section === "Unknown")).toBe(false);
    expect(density.map((bucket) => bucket.section)).toEqual([
      "1. Summary",
      "2. Competent Persons",
      "3. Introduction",
      "4. Terms and Definitions",
      "5. Premises Details",
      "6. Limitations of Report",
      "7. Resume of the brief",
      "8. Fire Risk Assessment",
      "9. Risk Assessment and Action Plan",
      "10. Tenant(s) Monitoring",
    ]);
  });

  it("groups subsection analytics into fixed main-section buckets", async () => {
    prisma.report.count.mockResolvedValueOnce(10);
    prisma.issue.groupBy.mockResolvedValueOnce([
      { sectionName: "### SECTION 0: Section 1", _count: { sectionName: 3 } },
      { sectionName: "SECTION 15: 5.7. Construction Details", _count: { sectionName: 4 } },
      { sectionName: "5.7. Construction Details", _count: { sectionName: 2 } },
      { sectionName: "Multiple Sections Analysis", _count: { sectionName: 5 } },
      { sectionName: "Ambiguous", _count: { sectionName: 2 } },
    ]);

    const density = await getAnalyticsSectionDensity({
      dateFrom: new Date("2026-03-01T00:00:00.000Z"),
      dateTo: new Date("2026-03-31T23:59:59.999Z"),
    });

    expect(density).toHaveLength(10);
    expect(density).toContainEqual({
      section: "5. Premises Details",
      issueCount: 6,
      issueDensity: 0.6,
    });
    expect(density).toContainEqual({
      section: "1. Summary",
      issueCount: 3,
      issueDensity: 0.3,
    });
    expect(density.some((bucket) => bucket.section === "Unknown")).toBe(false);
    expect(density.some((bucket) => bucket.section === "Ambiguous")).toBe(false);
    expect(density.map((bucket) => bucket.section)).toEqual([
      "1. Summary",
      "2. Competent Persons",
      "3. Introduction",
      "4. Terms and Definitions",
      "5. Premises Details",
      "6. Limitations of Report",
      "7. Resume of the brief",
      "8. Fire Risk Assessment",
      "9. Risk Assessment and Action Plan",
      "10. Tenant(s) Monitoring",
    ]);
  });

  it("calculates recurring issue rate from repeated categories within reports", async () => {
    prisma.report.findMany.mockResolvedValueOnce([
      {
        analyzedAt: new Date("2026-03-01T10:00:00.000Z"),
        issues: [
          { type: IssueType.TEMPLATE_ARTIFACT },
          { type: IssueType.TEMPLATE_ARTIFACT },
          { type: IssueType.MISSING_INFORMATION },
        ],
      },
      {
        analyzedAt: new Date("2026-03-01T12:00:00.000Z"),
        issues: [{ type: IssueType.UNREMOVED_GUIDANCE }],
      },
      {
        analyzedAt: new Date("2026-03-02T09:00:00.000Z"),
        issues: [
          { type: IssueType.MISSING_INFORMATION },
          { type: IssueType.MISSING_INFORMATION },
        ],
      },
    ]);

    const result = await getRecurringIssueRate({
      dateFrom: new Date("2026-03-01T00:00:00.000Z"),
      dateTo: new Date("2026-03-03T23:59:59.999Z"),
    });

    const activeBuckets = result.filter((point) => point.analyses > 0);
    expect(activeBuckets).toEqual([
      {
        label: "01 Mar",
        analyses: 2,
        reportsWithRepeatedCategories: 1,
        recurringIssueRate: 50,
      },
      {
        label: "02 Mar",
        analyses: 1,
        reportsWithRepeatedCategories: 1,
        recurringIssueRate: 100,
      },
    ]);
  });

  it("builds consultant quality signals from report and issue data", async () => {
    prisma.report.findMany.mockResolvedValueOnce([
      {
        userAccountId: 5,
        totalIssues: 4,
        issues: [
          { type: IssueType.TEMPLATE_ARTIFACT },
          { type: IssueType.TEMPLATE_ARTIFACT },
          { type: IssueType.UNREMOVED_GUIDANCE },
          { type: IssueType.MISSING_INFORMATION },
        ],
        userAccount: { email: "sarah@ligtas.com" },
      },
      {
        userAccountId: 5,
        totalIssues: 0,
        issues: [],
        userAccount: { email: "sarah@ligtas.com" },
      },
      {
        userAccountId: 8,
        totalIssues: 2,
        issues: [
          { type: IssueType.MISSING_INFORMATION },
          { type: IssueType.MISSING_INFORMATION },
        ],
        userAccount: { email: "james@ligtas.com" },
      },
    ]);

    const result = await getConsultantQualitySignals({
      dateFrom: new Date("2026-03-01T00:00:00.000Z"),
      dateTo: new Date("2026-03-31T23:59:59.999Z"),
    });

    expect(result).toEqual([
      {
        consultantId: 5,
        consultantEmail: "sarah@ligtas.com",
        analysesRun: 2,
        withIssuesPercentage: 50,
        averageIssuesPerReport: 2,
        mostFrequentCategory: "Template Artifact",
      },
      {
        consultantId: 8,
        consultantEmail: "james@ligtas.com",
        analysesRun: 1,
        withIssuesPercentage: 100,
        averageIssuesPerReport: 2,
        mostFrequentCategory: "Missing Information",
      },
    ]);
  });
});
