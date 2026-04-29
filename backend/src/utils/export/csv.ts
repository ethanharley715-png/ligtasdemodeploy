import type { ReportExportData } from "../../services/reportExportService";
import { sanitizeCsvCell } from "./csvCell";

export function buildReportExportCsv(data: ReportExportData): string {
  const headers = [
    "reportId",
    "reportFileName",
    "reportStatus",
    "generatedAt",
    "uploadedAt",
    "analyzedAt",
    "analystEmail",
    "passedQc",
    "totalIssues",
    "issueBreakdown",
    "issueId",
    "issueType",
    "ruleKey",
    "section",
    "pageNumber",
    "location",
    "message",
    "suggestion",
    "context",
  ];

  const issueBreakdown = data.summary.byType
    .map((entry) => `${entry.label}: ${entry.count}`)
    .join("; ");

  const baseRow = {
    reportId: data.report.id,
    reportFileName: data.report.fileName,
    reportStatus: data.report.status,
    generatedAt: data.generatedAt,
    uploadedAt: data.report.uploadedAt,
    analyzedAt: data.report.analyzedAt ?? "",
    analystEmail: data.report.analystEmail ?? "",
    passedQc: String(data.summary.passedQC),
    totalIssues: String(data.summary.totalIssues),
    issueBreakdown,
  };

  const issueRows = data.issues.length > 0
    ? data.issues.map((issue) => ({
        ...baseRow,
        issueId: issue.id,
        issueType: issue.typeLabel,
        ruleKey: issue.ruleKey ?? "",
        section: issue.sectionName ?? "",
        pageNumber: issue.pageNumber != null ? String(issue.pageNumber) : "",
        location: issue.location,
        message: issue.description,
        suggestion: issue.suggestion,
        context: issue.context,
      }))
    : [
        {
          ...baseRow,
          issueId: "",
          issueType: "",
          ruleKey: "",
          section: "",
          pageNumber: "",
          location: "",
          message: "",
          suggestion: "",
          context: "",
        },
      ];

  const lines = [
    headers.join(","),
    ...issueRows.map((row) =>
      headers
        .map((header) => sanitizeCsvCell(String(row[header as keyof typeof row] ?? "")))
        .join(","),
    ),
  ];

  return `${lines.join("\r\n")}\r\n`;
}
