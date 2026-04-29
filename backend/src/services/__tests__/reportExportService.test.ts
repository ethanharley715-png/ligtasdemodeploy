import {
  buildExportFilename,
  exportReportAsCsv,
  exportReportAsPdf,
  mapReportToExportData,
  type ReportExportRepository,
} from "../reportExportService";

const baseReport = {
  id: "rep_123",
  fileName: "Fire Risk Assessment.pdf",
  status: "COMPLETED" as const,
  uploadedAt: new Date("2026-03-20T09:00:00.000Z"),
  analyzedAt: new Date("2026-03-20T09:05:00.000Z"),
  passedQC: false,
  totalIssues: 2,
  userAccountId: 8,
  userAccount: { email: "consultant@ligtas.com" },
  issues: [
    {
      id: "issue-1",
      type: "TEMPLATE_ARTIFACT",
      ruleKey: "placeholder_value",
      description: "Placeholder value detected.",
      location: "Summary",
      context: "\"Quoted\", placeholder",
      suggestion: "Replace placeholder values with real report details.",
      pageNumber: 1,
      sectionName: "Summary",
    },
    {
      id: "issue-2",
      type: "UNREMOVED_GUIDANCE",
      ruleKey: "template_phrase",
      description: "Template instruction text detected.",
      location: "Fire Risk Assessment",
      context: "The template text is:",
      suggestion: "Remove template instruction text before submission.",
      pageNumber: 2,
      sectionName: "Fire Risk Assessment",
    },
  ],
};

describe("reportExportService", () => {
  it("builds a traceable export filename", () => {
    const fileName = buildExportFilename(
      "Fire Risk Assessment.pdf",
      "rep_123",
      "csv",
      new Date("2026-03-20T12:00:00.000Z"),
    );

    expect(fileName).toBe(
      "Fire-Risk-Assessment__rep_123__qc-results__2026-03-20__generated-2026-03-20T12-00-00Z.csv",
    );
  });

  it("maps persisted report data into export-ready summary and issue details", () => {
    const result = mapReportToExportData(baseReport, new Date("2026-03-20T12:00:00.000Z"));

    expect(result.summary).toEqual({
      totalIssues: 2,
      passedQC: false,
      byType: [
        { type: "TEMPLATE_ARTIFACT", label: "Template Artifact", count: 1 },
        { type: "UNREMOVED_GUIDANCE", label: "Unremoved Guidance", count: 1 },
      ],
    });
    expect(result.issues[0].typeLabel).toBe("Template Artifact");
  });

  it("uses default suggested fixes when stored issue suggestions are missing", () => {
    const result = mapReportToExportData(
      {
        ...baseReport,
        issues: [
          {
            ...baseReport.issues[0],
            suggestion: "",
          },
          {
            ...baseReport.issues[1],
            suggestion: "n/a",
          },
        ],
      },
      new Date("2026-03-20T12:00:00.000Z"),
    );

    expect(result.issues[0].suggestion).toBe(
      "Replace placeholder or template text with the correct final report content.",
    );
    expect(result.issues[1].suggestion).toBe(
      "Remove drafting guidance or instructional text before finalizing the report.",
    );
  });

  it("exports CSV with escaped issue context and summary columns", async () => {
    const repository: ReportExportRepository = {
      findAccessibleReport: jest.fn().mockResolvedValue(baseReport),
    };

    const result = await exportReportAsCsv(
      "rep_123",
      { userAccountId: 8, role: "CONSULTANT" },
      repository,
      new Date("2026-03-20T12:00:00.000Z"),
    );

    const csv = result.buffer.toString("utf-8");

    expect(result.fileName).toBe(
      "Fire-Risk-Assessment__rep_123__qc-results__2026-03-20__generated-2026-03-20T12-00-00Z.csv",
    );
    expect(result.contentType).toContain("text/csv");
    expect(csv).toContain("reportId,reportFileName,reportStatus");
    expect(csv).toContain("\"\"\"Quoted\"\", placeholder\"");
    expect(csv).toContain("Template Artifact: 1; Unremoved Guidance: 1");
  });

  it("exports a single CSV row for a completed report with no issues", async () => {
    const repository: ReportExportRepository = {
      findAccessibleReport: jest.fn().mockResolvedValue({
        ...baseReport,
        passedQC: true,
        totalIssues: 0,
        issues: [],
      }),
    };

    const result = await exportReportAsCsv(
      "rep_123",
      { userAccountId: 8, role: "CONSULTANT" },
      repository,
      new Date("2026-03-20T12:00:00.000Z"),
    );

    const lines = result.buffer.toString("utf-8").trimEnd().split("\r\n");

    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("rep_123");
  });

  it("exports a PDF buffer for a completed report", async () => {
    const repository: ReportExportRepository = {
      findAccessibleReport: jest.fn().mockResolvedValue(baseReport),
    };

    const result = await exportReportAsPdf(
      "rep_123",
      { userAccountId: 8, role: "CONSULTANT" },
      repository,
      new Date("2026-03-20T12:00:00.000Z"),
    );

    expect(result.fileName).toBe(
      "Fire-Risk-Assessment__rep_123__qc-results__2026-03-20__generated-2026-03-20T12-00-00Z.pdf",
    );
    expect(result.contentType).toBe("application/pdf");
    expect(result.buffer.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("rejects export when report analysis is not complete", async () => {
    const repository: ReportExportRepository = {
      findAccessibleReport: jest.fn().mockResolvedValue({
        ...baseReport,
        status: "PROCESSING" as const,
        analyzedAt: null,
      }),
    };

    await expect(
      exportReportAsCsv(
        "rep_123",
        { userAccountId: 8, role: "CONSULTANT" },
        repository,
        new Date("2026-03-20T12:00:00.000Z"),
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: "report_not_ready",
    });
  });
});
