import type { ReportExportData } from "../../services/reportExportService";
import { createPdfLayout } from "./pdfLayout";

export async function buildReportExportPdf(data: ReportExportData): Promise<Buffer> {
  const layout = await createPdfLayout();

  layout.drawHeader("QC Results Export", "Structured remediation and record-keeping export for a single analysed report.");
  layout.drawKeyValueList(
    [
      { label: "Report ID", value: data.report.id },
      { label: "Filename", value: data.report.fileName, wrap: true },
      { label: "Generated", value: data.generatedAt },
      { label: "Uploaded", value: data.report.uploadedAt },
      { label: "Analyzed", value: data.report.analyzedAt ?? "Not analyzed" },
      { label: "Analyst", value: data.report.analystEmail ?? "Unknown" },
      { label: "Status", value: data.report.status },
    ],
    { box: true },
  );

  layout.drawSectionHeading("Summary");
  layout.drawMetricCards([
    { label: "Total issues", value: String(data.summary.totalIssues) },
    { label: "QC outcome", value: data.summary.passedQC ? "Passed" : "Needs review" },
  ]);

  if (data.summary.byType.length === 0) {
    layout.drawCard("Issue breakdown", [{ label: "Status", value: "No issue categories recorded." }], {
      accent: "success",
    });
  } else {
    layout.drawCard(
      "Issue breakdown",
      data.summary.byType.map((entry) => ({
        label: entry.label,
        value: String(entry.count),
      })),
      { accent: data.summary.passedQC ? "success" : "warning" },
    );
  }

  layout.drawSectionHeading("Issue Details");
  if (data.issues.length === 0) {
    layout.drawCard(
      "No issues detected",
      [
        {
          label: "Result",
          value: "This report passed QC and no issue records were included in the export.",
          wrap: true,
        },
      ],
      { accent: "success" },
    );
  } else {
    data.issues.forEach((issue, index) => {
      layout.drawCard(
        `${index + 1}. ${issue.typeLabel}${issue.pageNumber != null ? ` • Page ${issue.pageNumber}` : ""}`,
        [
          { label: "Section", value: issue.sectionName ?? "Unknown" },
          { label: "Rule key", value: issue.ruleKey ?? "n/a" },
          { label: "Location", value: issue.location || "Unknown location", wrap: true },
          { label: "Message", value: issue.description || "n/a", wrap: true },
          { label: "Suggestion", value: issue.suggestion || "n/a", wrap: true },
          { label: "Context", value: issue.context || "n/a", wrap: true },
        ],
        { accent: "warning" },
      );
    });
  }

  return layout.save();
}
