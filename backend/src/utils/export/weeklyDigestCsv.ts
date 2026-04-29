import type { WeeklyDigestData } from "../../services/weeklyDigestService";
import { sanitizeCsvCell } from "./csvCell";

export function buildWeeklyDigestCsv(data: WeeklyDigestData): string {
  const headers = [
    "section",
    "generatedAt",
    "weekStart",
    "weekEnd",
    "consultantId",
    "consultantLabel",
    "issueType",
    "issueTypeLabel",
    "key",
    "label",
    "value",
    "secondaryValue",
    "tertiaryValue",
    "details",
  ];

  const baseRow = {
    generatedAt: data.generatedAt,
    weekStart: data.week.start,
    weekEnd: data.week.end,
    consultantId: data.filters.consultantId != null ? String(data.filters.consultantId) : "",
    consultantLabel: data.filters.consultantLabel ?? "",
    issueType: data.filters.issueType ?? "",
    issueTypeLabel: data.filters.issueTypeLabel ?? "",
  };

  const rows: Array<Record<string, string>> = [
    {
      section: "summary",
      ...baseRow,
      key: "total_analyses",
      label: "Total analyses",
      value: String(data.summary.totalAnalyses),
      secondaryValue: "",
      tertiaryValue: "",
      details: "",
    },
    {
      section: "summary",
      ...baseRow,
      key: "analyses_with_issues_percentage",
      label: "Analyses with issues (%)",
      value: String(data.summary.analysesWithIssuesPercentage),
      secondaryValue: "",
      tertiaryValue: "",
      details: "",
    },
    {
      section: "summary",
      ...baseRow,
      key: "average_issues_per_analysis",
      label: "Average issues per analysis",
      value: String(data.summary.averageIssuesPerAnalysis),
      secondaryValue: "",
      tertiaryValue: "",
      details: "",
    },
    {
      section: "summary",
      ...baseRow,
      key: "distinct_issue_categories",
      label: "Distinct issue categories",
      value: String(data.summary.distinctIssueCategories),
      secondaryValue: "",
      tertiaryValue: "",
      details: "",
    },
    {
      section: "summary",
      ...baseRow,
      key: "recurring_issue_rate",
      label: "Recurring issue rate (%)",
      value: String(data.summary.recurringIssueRate),
      secondaryValue: String(data.summary.reportsWithRepeatedCategories),
      tertiaryValue: "",
      details: "secondaryValue = reportsWithRepeatedCategories",
    },
  ];

  rows.push(
    ...data.dailyTrends.map((trend) => ({
      section: "daily_trend",
      ...baseRow,
      key: "trend",
      label: trend.label,
      value: String(trend.analyses),
      secondaryValue: String(trend.issues),
      tertiaryValue: "",
      details: "value = analyses, secondaryValue = issues",
    })),
  );

  rows.push(
    ...data.issueTypes.map((issueType) => ({
      section: "issue_category",
      ...baseRow,
      key: issueType.issueType,
      label: issueType.label,
      value: String(issueType.count),
      secondaryValue: "",
      tertiaryValue: "",
      details: "",
    })),
  );

  rows.push(
    ...data.sectionDensity.map((section) => ({
      section: "section_density",
      ...baseRow,
      key: "section_density",
      label: section.section,
      value: String(section.issueCount),
      secondaryValue: String(section.issueDensity),
      tertiaryValue: "",
      details: "secondaryValue = issueDensity",
    })),
  );

  rows.push(
    ...data.consultantSignals.map((signal) => ({
      section: "consultant_signal",
      ...baseRow,
      key: "consultant_signal",
      label: signal.consultantEmail,
      value: String(signal.analysesRun),
      secondaryValue: String(signal.withIssuesPercentage),
      tertiaryValue: String(signal.averageIssuesPerReport),
      details: signal.mostFrequentCategory ?? "",
    })),
  );

  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((header) => sanitizeCsvCell(String(row[header] ?? ""))).join(","),
    ),
  ];

  return `${lines.join("\r\n")}\r\n`;
}
