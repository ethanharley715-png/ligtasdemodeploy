import { buildReportExportCsv } from "../csv";
import { buildWeeklyDigestCsv } from "../weeklyDigestCsv";
import type { ReportExportData } from "../../../services/reportExportService";
import type { WeeklyDigestData } from "../../../services/weeklyDigestService";

describe("CSV export builders", () => {
  it("sanitizes report export issue cells that start with spreadsheet formulas", () => {
    const csv = buildReportExportCsv({
      report: {
        id: "rep_1",
        fileName: "Test.pdf",
        status: "COMPLETED",
        uploadedAt: "2026-03-23T10:00:00.000Z",
        analyzedAt: "2026-03-23T10:01:00.000Z",
        analystEmail: "consultant@example.com",
      },
      generatedAt: "2026-03-23T10:05:00.000Z",
      summary: {
        totalIssues: 1,
        passedQC: false,
        byType: [{ type: "TEMPLATE_ARTIFACT", label: "Template Artifact", count: 1 }],
      },
      issues: [
        {
          id: "issue_1",
          type: "TEMPLATE_ARTIFACT",
          typeLabel: "Template Artifact",
          ruleKey: "placeholder_value",
          description: "=HYPERLINK(\"http://bad\")",
          location: "Summary",
          context: "+cmd",
          suggestion: "Replace it",
          pageNumber: 1,
          sectionName: "Summary",
        },
      ],
    } satisfies ReportExportData);

    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'+cmd");
  });

  it("sanitizes weekly digest cells that start with spreadsheet formulas", () => {
    const csv = buildWeeklyDigestCsv({
      generatedAt: "2026-03-23T10:05:00.000Z",
      week: {
        start: "2026-03-16",
        end: "2026-03-22",
        label: "2026-03-16 to 2026-03-22",
      },
      filters: {
        consultantId: 7,
        consultantLabel: "=Admin",
        issueType: null,
        issueTypeLabel: null,
      },
      summary: {
        totalAnalyses: 4,
        analysesWithIssuesPercentage: 50,
        averageIssuesPerAnalysis: 1.5,
        distinctIssueCategories: 2,
        reportsThisMonth: 4,
        reportsLastMonth: 2,
        avgIssuesPerReport: 1.5,
        avgIssuesLastMonth: 1,
        passRate: 50,
        passRateLastMonth: 75,
        timeSaved: 60,
        recurringIssueRate: 25,
        reportsWithRepeatedCategories: 1,
      },
      dailyTrends: [],
      issueTypes: [],
      sectionDensity: [],
      consultantSignals: [
        {
          consultantId: 7,
          consultantEmail: "+consultant@example.com",
          analysesRun: 4,
          withIssuesPercentage: 50,
          averageIssuesPerReport: 1.5,
          mostFrequentCategory: "Template Artifact",
        },
      ],
      recurringIssueRateByDay: [],
    } satisfies WeeklyDigestData);

    expect(csv).toContain("'=Admin");
    expect(csv).toContain("'+consultant@example.com");
  });
});
