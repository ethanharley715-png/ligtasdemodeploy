import type { WeeklyDigestData } from "../../services/weeklyDigestService";
import { createPdfLayout } from "./pdfLayout";

export async function buildWeeklyDigestPdf(data: WeeklyDigestData): Promise<Buffer> {
  const layout = await createPdfLayout();

  layout.drawHeader("Weekly QC Digest", "Admin digest for completed QC analyses in the selected calendar week.");
  layout.drawKeyValueList(
    [
      { label: "Week", value: data.week.label },
      { label: "Generated", value: data.generatedAt },
      { label: "Consultant filter", value: data.filters.consultantLabel ?? "All consultants", wrap: true },
      { label: "Issue filter", value: data.filters.issueTypeLabel ?? "All issue categories", wrap: true },
    ],
    { box: true },
  );

  layout.drawSectionHeading("Summary");
  layout.drawMetricCards([
    { label: "Total analyses", value: String(data.summary.totalAnalyses) },
    { label: "With issues", value: `${data.summary.analysesWithIssuesPercentage}%` },
    { label: "Avg issues / analysis", value: String(data.summary.averageIssuesPerAnalysis) },
    { label: "Recurring issue rate", value: `${data.summary.recurringIssueRate}%` },
  ]);
  layout.drawCard(
    "Digest summary",
    [
      { label: "Distinct categories", value: String(data.summary.distinctIssueCategories) },
      { label: "Repeated-category reports", value: String(data.summary.reportsWithRepeatedCategories) },
    ],
  );

  layout.drawSectionHeading("Daily Trend");
  if (data.dailyTrends.length === 0) {
    layout.drawCard("Daily trend", [{ label: "Status", value: "No completed analyses were recorded for this week." }], {
      accent: "success",
    });
  } else {
    layout.drawCard(
      "Daily trend",
      data.dailyTrends.map((trend) => ({
        label: trend.label,
        value: `${trend.analyses} analyses, ${trend.issues} issues`,
        wrap: true,
      })),
    );
  }

  layout.drawSectionHeading("Issue Categories");
  if (data.issueTypes.length === 0) {
    layout.drawCard("Issue categories", [{ label: "Status", value: "No issue categories recorded." }], {
      accent: "success",
    });
  } else {
    layout.drawCard(
      "Issue categories",
      data.issueTypes.map((issueType) => ({
        label: issueType.label,
        value: String(issueType.count),
      })),
    );
  }

  layout.drawSectionHeading("Section Density");
  if (data.sectionDensity.length === 0) {
    layout.drawCard(
      "Section density",
      [{ label: "Status", value: "No section metadata is available for this week.", wrap: true }],
      { accent: "success" },
    );
  } else {
    layout.drawCard(
      "Section density",
      data.sectionDensity.map((section) => ({
        label: section.section,
        value: `${section.issueCount} issues (${section.issueDensity})`,
        wrap: true,
      })),
    );
  }

  layout.drawSectionHeading("Consultant Quality Signals");
  if (data.consultantSignals.length === 0) {
    layout.drawCard(
      "Consultant quality signals",
      [{ label: "Status", value: "No consultant quality signals are available for this week.", wrap: true }],
      { accent: "success" },
    );
  } else {
    data.consultantSignals.forEach((signal) => {
      layout.drawCard(
        signal.consultantEmail,
        [
          { label: "Analyses run", value: String(signal.analysesRun) },
          { label: "% with issues", value: String(signal.withIssuesPercentage) },
          { label: "Avg issues / report", value: String(signal.averageIssuesPerReport) },
          { label: "Most frequent category", value: signal.mostFrequentCategory ?? "No issues", wrap: true },
        ],
      );
    });
  }

  return layout.save();
}
