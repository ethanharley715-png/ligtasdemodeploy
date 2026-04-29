import { describe, expect, it, jest } from "@jest/globals";
import {
  analyzeReportSession,
  getSessionQcResults,
  persistReportAnalysisFromText,
  type ReportAnalysisRepository,
} from "../reportAnalysisService";
import { serializeExtractedReportText } from "../../utils/pdf/extractReportText";

function makeActiveSession() {
  return {
    id: "session-1",
    userAccountId: 9,
    filename: "sample-report.pdf",
    text: "The template text is: [XXX]. High risk issue remains unresolved.",
    expiresAt: new Date("2026-03-06T18:00:00.000Z"),
  };
}

function makePersistedReport() {
  return {
    id: "rep-1",
    reportSessionId: "session-1",
    fileName: "sample-report.pdf",
    status: "COMPLETED" as const,
    analyzedAt: new Date("2026-03-06T10:00:00.000Z"),
    processingTimeSeconds: 4,
    totalIssues: 2,
    criticalIssues: 0,
    mediumIssues: 2,
    lowIssues: 0,
    passedQC: true,
    userAccountId: 9,
    issues: [
      {
        id: "issue-1",
        type: "TEMPLATE_ARTIFACT" as const,
        severity: "MEDIUM" as const,
        ruleKey: "placeholder_xxx",
        description: "Template placeholder text detected.",
        suggestion: "Replace placeholders.",
        sectionName: "Fire Risk Assessment",
        context: "The template text is: [XXX]",
        pageNumber: 1,
      },
      {
        id: "issue-2",
        type: "UNREMOVED_GUIDANCE" as const,
        severity: "MEDIUM" as const,
        ruleKey: "template_instruction_phrase",
        description: "Instructional text found.",
        suggestion: "Remove guidance text.",
        sectionName: "Fire Risk Assessment",
        context: "This section should contain...",
        pageNumber: 1,
      },
    ],
  };
}

function makeRepository(overrides: Partial<ReportAnalysisRepository> = {}): ReportAnalysisRepository {
  return {
    cleanupExpiredSessions: jest.fn(async () => undefined),
    findActiveSession: jest.fn(async () => makeActiveSession()),
    findReportBySession: jest.fn(async () => null),
    createCompletedReport: jest.fn(async () => makePersistedReport()),
    ...overrides,
  };
}

describe("analyzeReportSession", () => {
  it("creates persisted QC results on first analysis", async () => {
    const repository = makeRepository();
    const scannerDependencies = {
      runAiAnalysis: jest.fn(async () => [
        {
          type: "TEMPLATE_ARTIFACT" as const,
          description: "Template placeholder text detected.",
          section: "Fire Risk Assessment",
        },
      ]),
      runRuleAnalysis: jest.fn(() => []),
    };

    const response = await analyzeReportSession(
      "session-1",
      { userAccountId: 9, role: "CONSULTANT" },
      repository,
      new Date("2026-03-06T11:00:00.000Z"),
      scannerDependencies,
    );

    expect(response.created).toBe(true);
    expect(response.result.reportSessionId).toBe("session-1");
    expect(response.result.reportId).toBe("rep-1");
    expect(response.result.summary.totalIssues).toBe(2);
    expect(response.result.summary.byType.template_artifact).toBe(1);
    expect(response.result.summary.byType.unremoved_guidance).toBe(1);
    expect(response.result.summary.byType.contradiction).toBe(0);
    expect(response.result.issues[0]?.location.section).toBe("Fire Risk Assessment");
    expect(response.result.issues[0]?.ruleKey).toBe("placeholder_xxx");
    expect(response.result.issues[0]?.section).toBe("Fire Risk Assessment");
    expect((repository.createCompletedReport as jest.Mock).mock.calls.length).toBe(1);
  });

  it("returns existing persisted results on repeated analysis", async () => {
    const existing = makePersistedReport();
    const findActiveSession = jest.fn(async () => makeActiveSession());
    const repository = makeRepository({
      findActiveSession,
      findReportBySession: jest.fn(async () => existing),
    });

    const response = await analyzeReportSession(
      "session-1",
      { userAccountId: 9, role: "CONSULTANT" },
      repository,
      new Date("2026-03-06T11:00:00.000Z"),
    );

    expect(response.created).toBe(false);
    expect(response.result.reportId).toBe("rep-1");
    expect(findActiveSession).not.toHaveBeenCalled();
    expect((repository.createCompletedReport as jest.Mock).mock.calls.length).toBe(0);
  });

  it("throws report_session_not_found when session is missing or expired", async () => {
    const repository = makeRepository({
      findActiveSession: jest.fn(async () => null),
    });

    await expect(
      analyzeReportSession(
        "session-missing",
        { userAccountId: 9, role: "CONSULTANT" },
        repository,
        new Date("2026-03-06T11:00:00.000Z"),
      ),
    ).rejects.toMatchObject({
      code: "report_session_not_found",
      status: 404,
    });
  });

  it("persists only allowed issue categories for session analysis", async () => {
    const repository = makeRepository();
    const scannerDependencies = {
      runAiAnalysis: jest.fn(async () => [
        {
          type: "CONTRADICTION" as const,
          description: "Contradictory statement found.",
          section: "Summary",
        },
      ]),
      runRuleAnalysis: jest.fn(() => []),
    };

    await analyzeReportSession(
      "session-1",
      { userAccountId: 9, role: "CONSULTANT" },
      repository,
      new Date("2026-03-06T11:00:00.000Z"),
      scannerDependencies,
    );

    const createCall = (repository.createCompletedReport as jest.Mock).mock.calls[0]?.[0] as
      | { issues: Array<{ type: string }> }
      | undefined;
    if (!createCall) {
      throw new Error("Expected createCompletedReport to be called with payload.");
    }
    expect(Array.isArray(createCall.issues)).toBe(true);
    expect(createCall.issues).toEqual([
      expect.objectContaining({
        type: "CONTRADICTION",
        ruleKey: null,
        sectionName: "1. Summary",
        location: "1. Summary",
        context: "Contradictory statement found.",
        pageNumber: null,
      }),
    ]);
    expect(scannerDependencies.runRuleAnalysis).not.toHaveBeenCalled();
  });
});

describe("persistReportAnalysisFromText", () => {
  it("persists AI issues when AI scan mode is selected", async () => {
    const repository = makeRepository();

    const result = await persistReportAnalysisFromText(
      {
        reportSessionId: "session-1",
        fileName: "sample-report.pdf",
        userAccountId: 9,
        text: "Placeholder value [XXX] still present.",
        scanMode: "ai",
      },
      repository,
      {
        runAiAnalysis: jest.fn(async () => [
          {
            type: "TEMPLATE_ARTIFACT" as const,
            description: "Placeholder value detected.",
            section: "Summary",
            quote: "[XXX]",
          },
        ]),
        runRuleAnalysis: jest.fn(() => [
          {
            type: "TEMPLATE_ARTIFACT" as const,
            ruleKey: "placeholder_value",
            message: "Placeholder value detected.",
            suggestion: "Replace placeholder values with real report details.",
            sectionName: "Summary",
            context: "[XXX]",
            location: "Approx. page 1",
            pageNumber: 1,
            matchIndex: null,
          },
        ]),
      },
    );

    const createCall = (repository.createCompletedReport as jest.Mock).mock.calls[0]?.[0] as
      | { issues: Array<{ type: string; ruleKey: string | null }> }
      | undefined;

    expect(result.scanSource).toBe("ai");
    expect(createCall?.issues).toEqual([
      expect.objectContaining({
        type: "TEMPLATE_ARTIFACT",
        ruleKey: null,
        context: "[XXX]",
        suggestion: "",
      }),
    ]);
  });

  it("maps AI issues to the exact matching PDF page when a verbatim quote is available", async () => {
    const repository = makeRepository();

    await persistReportAnalysisFromText(
      {
        reportSessionId: "session-1",
        fileName: "sample-report.pdf",
        userAccountId: 9,
        text: serializeExtractedReportText({
          text: "Page 1 text\n\n5.7. Construction Details\nBuilding Size: XXXXX sq. Ft\n\nPage 3 text",
          pages: [
            { pageNumber: 1, text: "Page 1 text" },
            { pageNumber: 2, text: "5.7. Construction Details\nBuilding Size: XXXXX sq. Ft" },
            { pageNumber: 3, text: "Page 3 text" },
          ],
        }),
        scanMode: "ai",
      },
      repository,
      {
        runAiAnalysis: jest.fn(async () => [
          {
            type: "TEMPLATE_ARTIFACT" as const,
            description: "Placeholder building size detected.",
            section: "Construction Details",
            quote: "Building Size: XXXXX sq. Ft",
          },
        ]),
        runRuleAnalysis: jest.fn(() => []),
      },
    );

    expect((repository.createCompletedReport as jest.Mock).mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        issues: [
          expect.objectContaining({
            pageNumber: 2,
            location: "Page 2 - 5.7. Construction Details",
            sectionName: "5.7. Construction Details",
            context: "Building Size: XXXXX sq. Ft",
            suggestion: "",
          }),
        ],
      }),
    );
  });

  it("keeps the AI section label when quote matching cannot verify a nearer heading", async () => {
    const repository = makeRepository();

    await persistReportAnalysisFromText(
      {
        reportSessionId: "session-1",
        fileName: "sample-report.pdf",
        userAccountId: 9,
        text: serializeExtractedReportText({
          text: "Page 1 text\n\nBuilding Size: XXXXX sq. Ft\n\nPage 3 text",
          pages: [
            { pageNumber: 1, text: "Page 1 text" },
            { pageNumber: 2, text: "Building Size: XXXXX sq. Ft" },
            { pageNumber: 3, text: "Page 3 text" },
          ],
        }),
        scanMode: "ai",
      },
      repository,
      {
        runAiAnalysis: jest.fn(async () => [
          {
            type: "TEMPLATE_ARTIFACT" as const,
            description: "Placeholder building size detected.",
            section: "Construction Details",
            quote: "Building Size: XXXXX sq. Ft",
          },
        ]),
        runRuleAnalysis: jest.fn(() => []),
      },
    );

    expect((repository.createCompletedReport as jest.Mock).mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        issues: [
          expect.objectContaining({
            pageNumber: 2,
            location: "Page 2 - 5.7. Construction Details",
            sectionName: "5.7. Construction Details",
          }),
        ],
      }),
    );
  });

  it("canonicalizes shorthand AI section labels to approved titles before persistence", async () => {
    const repository = makeRepository();

    await persistReportAnalysisFromText(
      {
        reportSessionId: "session-1",
        fileName: "sample-report.pdf",
        userAccountId: 9,
        text: serializeExtractedReportText({
          text: "Page 1 text\n\nTemplate text remains.",
          pages: [
            { pageNumber: 1, text: "Page 1 text" },
            { pageNumber: 2, text: "Template text remains." },
          ],
        }),
        scanMode: "ai",
      },
      repository,
      {
        runAiAnalysis: jest.fn(async () => [
          {
            type: "UNREMOVED_GUIDANCE" as const,
            description: "Template guidance phrase detected.",
            section: "9.3ruwihaurawhruaw",
            quote: "Template text remains.",
          },
        ]),
        runRuleAnalysis: jest.fn(() => []),
      },
    );

    expect((repository.createCompletedReport as jest.Mock).mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        issues: [
          expect.objectContaining({
            pageNumber: 2,
            location: "Page 2 - 9.3. Electrical Matters",
            sectionName: "9.3. Electrical Matters",
          }),
        ],
      }),
    );
  });

  it("uses sanitized context to anchor heading-style AI issues to a unique page", async () => {
    const repository = makeRepository();

    await persistReportAnalysisFromText(
      {
        reportSessionId: "session-1",
        fileName: "sample-report.pdf",
        userAccountId: 9,
        text: serializeExtractedReportText({
          text: "9.5. Training (Fire) Existing Controls and Observations\nNo action is required at present.",
          pages: [
            {
              pageNumber: 26,
              text: "9.5. Training (Fire) Existing Controls and Observations\nNo action is required at present.",
            },
          ],
        }),
        scanMode: "ai",
      },
      repository,
      {
        runAiAnalysis: jest.fn(async () => [
          {
            type: "TEMPLATE_ARTIFACT" as const,
            description: "Found placeholder # 9.5.",
            section: "9.5",
            quote:
              "# 9.5. Training (Fire) Existing Controls and Observations",
          },
        ]),
        runRuleAnalysis: jest.fn(() => []),
      },
    );

    expect((repository.createCompletedReport as jest.Mock).mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        issues: [
          expect.objectContaining({
            pageNumber: 26,
            location: "Page 26 - 9.5. Training (Fire)",
            sectionName: "9.5. Training (Fire)",
          }),
        ],
      }),
    );
  });

  it("uses the canonical section page to disambiguate repeated non-filtered tokens", async () => {
    const repository = makeRepository();

    await persistReportAnalysisFromText(
      {
        reportSessionId: "session-1",
        fileName: "sample-report.pdf",
        userAccountId: 9,
        text: serializeExtractedReportText({
          text: [
            "9.3. Electrical Matters\nDRAFT based on ver.0",
            "9.5. Training (Fire)\nDRAFT based on ver.0",
          ].join("\n\n"),
          pages: [
            {
              pageNumber: 24,
              text: "9.3. Electrical Matters\nDRAFT based on ver.0",
            },
            {
              pageNumber: 26,
              text: "9.5. Training (Fire)\nDRAFT based on ver.0",
            },
          ],
        }),
        scanMode: "ai",
      },
      repository,
      {
        runAiAnalysis: jest.fn(async () => [
          {
            type: "TEMPLATE_ARTIFACT" as const,
            description: "Found placeholder DRAFT based on ver.0",
            section: "9.5",
            quote: "DRAFT based on ver.0",
          },
        ]),
        runRuleAnalysis: jest.fn(() => []),
      },
    );

    expect((repository.createCompletedReport as jest.Mock).mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        issues: [
          expect.objectContaining({
            pageNumber: 26,
            location: "Page 26 - 9.5. Training (Fire)",
            sectionName: "9.5. Training (Fire)",
          }),
        ],
      }),
    );
  });

  it("falls back to the canonical section page when no literal text match exists", async () => {
    const repository = makeRepository();

    await persistReportAnalysisFromText(
      {
        reportSessionId: "session-1",
        fileName: "sample-report.pdf",
        userAccountId: 9,
        text: serializeExtractedReportText({
          text: "9.6. Fire Protection Systems - Fire Alarm\nVisible section heading only",
          pages: [
            {
              pageNumber: 27,
              text: "9.6. Fire Protection Systems - Fire Alarm\nVisible section heading only",
            },
          ],
        }),
        scanMode: "ai",
      },
      repository,
      {
        runAiAnalysis: jest.fn(async () => [
          {
            type: "TEMPLATE_ARTIFACT" as const,
            description: "Found placeholder XXX",
            section: "9.6",
            quote: "with the fire alarm control panel located XXX and repeater panels located XXX",
          },
        ]),
        runRuleAnalysis: jest.fn(() => []),
      },
    );

    expect((repository.createCompletedReport as jest.Mock).mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        issues: [
          expect.objectContaining({
            pageNumber: 27,
            location: "Page 27 - 9.6. Fire Protection Systems - Fire Alarm",
            sectionName: "9.6. Fire Protection Systems - Fire Alarm",
          }),
        ],
      }),
    );
  });

  it("supports canonical-only AI location mode for debug runs", async () => {
    const repository = makeRepository();

    await persistReportAnalysisFromText(
      {
        reportSessionId: "session-1",
        fileName: "sample-report.pdf",
        userAccountId: 9,
        text: serializeExtractedReportText({
          text: "5.7. Construction Details\nBuilding Size: XXXXX sq. Ft",
          pages: [
            {
              pageNumber: 2,
              text: "5.7. Construction Details\nBuilding Size: XXXXX sq. Ft",
            },
          ],
        }),
        scanMode: "ai",
      },
      repository,
      {
        runAiAnalysis: jest.fn(async () => [
          {
            type: "TEMPLATE_ARTIFACT" as const,
            description: "Placeholder building size detected.",
            section: "5.7",
            quote: "Building Size: XXXXX sq. Ft",
          },
        ]),
        runRuleAnalysis: jest.fn(() => []),
      },
      {
        aiLocationMode: "canonical_only",
      },
    );

    expect((repository.createCompletedReport as jest.Mock).mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        issues: [
          expect.objectContaining({
            pageNumber: null,
            location: "5.7. Construction Details",
            sectionName: "5.7. Construction Details",
          }),
        ],
      }),
    );
  });

  it("marks the section as ambiguous when the same quote appears in multiple sections", async () => {
    const repository = makeRepository();

    await persistReportAnalysisFromText(
      {
        reportSessionId: "session-1",
        fileName: "sample-report.pdf",
        userAccountId: 9,
        text: serializeExtractedReportText({
          text: "5.8. Building Classification\nThe template text is:\n\n5.9. Fire Evacuation Policy\nThe template text is:",
          pages: [
            {
              pageNumber: 1,
              text: "5.8. Building Classification\nThe template text is:\n\n5.9. Fire Evacuation Policy\nThe template text is:",
            },
          ],
        }),
        scanMode: "ai",
      },
      repository,
      {
        runAiAnalysis: jest.fn(async () => [
          {
            type: "UNREMOVED_GUIDANCE" as const,
            description: "Template guidance phrase detected.",
            section: "5.9. Fire Evacuation Policy",
            quote: "The template text is:",
          },
        ]),
        runRuleAnalysis: jest.fn(() => []),
      },
    );

    expect((repository.createCompletedReport as jest.Mock).mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        issues: [
          expect.objectContaining({
            pageNumber: 1,
            location: "Page 1 - 5.9. Fire Evacuation Policy",
            sectionName: "5.9. Fire Evacuation Policy",
          }),
        ],
      }),
    );
  });

  it("drops synthetic section marker issues before persistence", async () => {
    const repository = makeRepository();

    await persistReportAnalysisFromText(
      {
        reportSessionId: "session-1",
        fileName: "sample-report.pdf",
        userAccountId: 9,
        text: serializeExtractedReportText({
          text: "5.8. Building Classification\nDelete as applicable***",
          pages: [
            {
              pageNumber: 1,
              text: "5.8. Building Classification\nDelete as applicable***",
            },
          ],
        }),
        scanMode: "ai",
      },
      repository,
      {
        runAiAnalysis: jest.fn(async () => [
          {
            type: "TEMPLATE_ARTIFACT" as const,
            description: "### SECTION 23: 6. Limitations of Report",
            section: "SECTION 23",
            quote: "### SECTION 23: 6. Limitations of Report",
          },
          {
            type: "TEMPLATE_ARTIFACT" as const,
            description: "Template placeholder detected.",
            section: "5.8. Building Classification",
            quote: "Delete as applicable***",
          },
        ]),
        runRuleAnalysis: jest.fn(() => []),
      },
    );

    expect((repository.createCompletedReport as jest.Mock).mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        issues: [
          expect.objectContaining({
            description: "Template placeholder detected.",
            sectionName: "5.8. Building Classification",
            context: "Delete as applicable***",
          }),
        ],
      }),
    );
  });

  it("drops standalone table token issues but keeps draft artifact issues", async () => {
    const repository = makeRepository();

    await persistReportAnalysisFromText(
      {
        reportSessionId: "session-1",
        fileName: "sample-report.pdf",
        userAccountId: 9,
        text: serializeExtractedReportText({
          text: "9.5. Training (Fire)\nDRAFT based on ver.0",
          pages: [
            {
              pageNumber: 26,
              text: "9.5. Training (Fire)\nDRAFT based on ver.0",
            },
          ],
        }),
        scanMode: "ai",
      },
      repository,
      {
        runAiAnalysis: jest.fn(async () => [
          {
            type: "TEMPLATE_ARTIFACT" as const,
            description: "Found placeholder L/R",
            section: "9.5",
            quote: "L/R",
          },
          {
            type: "UNREMOVED_GUIDANCE" as const,
            description: "Bracketed text not removed",
            section: "9.5",
            quote: "[Priority]",
          },
          {
            type: "UNREMOVED_GUIDANCE" as const,
            description: "Bracketed text not removed",
            section: "9.5",
            quote: "DRAFT based on ver.0",
          },
        ]),
        runRuleAnalysis: jest.fn(() => []),
      },
    );

    expect((repository.createCompletedReport as jest.Mock).mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        issues: [
          expect.objectContaining({
            description: "Bracketed text not removed",
            sectionName: "9.5. Training (Fire)",
            context: "DRAFT based on ver.0",
          }),
        ],
      }),
    );
  });

  it("falls back to rule issues when AI scan fails and rule fallback is enabled", async () => {
    const repository = makeRepository();

    const result = await persistReportAnalysisFromText(
      {
        reportSessionId: "session-1",
        fileName: "sample-report.pdf",
        userAccountId: 9,
        text: "Placeholder value [XXX] still present.",
        scanMode: "ai",
      },
      repository,
      {
        runAiAnalysis: jest.fn(async () => {
          throw new Error("ollama unavailable");
        }),
        runRuleAnalysis: jest.fn(() => [
          {
            type: "TEMPLATE_ARTIFACT" as const,
            ruleKey: "placeholder_value",
            message: "Placeholder value detected.",
            suggestion: "Replace placeholder values with real report details.",
            sectionName: "Summary",
            context: "[XXX]",
            location: "Approx. page 1",
            pageNumber: 1,
            matchIndex: null,
          },
        ]),
      },
    );

    expect(result.scanSource).toBe("rules");
    expect((repository.createCompletedReport as jest.Mock).mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        issues: [
          expect.objectContaining({
            type: "TEMPLATE_ARTIFACT",
            ruleKey: "placeholder_value",
          }),
        ],
      }),
    );
  });

  it("persists rule-based issues when rule scan mode is selected", async () => {
    const repository = makeRepository();

    const result = await persistReportAnalysisFromText(
      {
        reportSessionId: "session-1",
        fileName: "sample-report.pdf",
        userAccountId: 9,
        text: "Placeholder value [XXX] still present.",
        scanMode: "rules",
      },
      repository,
      {
        runAiAnalysis: jest.fn(async () => []),
        runRuleAnalysis: jest.fn(() => [
          {
            type: "TEMPLATE_ARTIFACT" as const,
            ruleKey: "placeholder_value",
            message: "Placeholder value detected.",
            suggestion: "Replace placeholder values with real report details.",
            sectionName: "Summary",
            context: "[XXX]",
            location: "Approx. page 1",
            pageNumber: 1,
            matchIndex: null,
          },
        ]),
      },
    );

    expect(result.scanSource).toBe("rules");
    expect((repository.createCompletedReport as jest.Mock).mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        issues: [
          expect.objectContaining({
            type: "TEMPLATE_ARTIFACT",
            ruleKey: "placeholder_value",
          }),
        ],
      }),
    );
  });

  it("re-maps rule issues to the exact matching PDF page when page text is stored", async () => {
    const repository = makeRepository();

    await persistReportAnalysisFromText(
      {
        reportSessionId: "session-1",
        fileName: "sample-report.pdf",
        userAccountId: 9,
        text: serializeExtractedReportText({
          text: "Page 1 text\n\nBuilding Size: XXXXX sq. Ft\n\nPage 3 text\n\nPage 4 text\n\nPage 5 text",
          pages: [
            { pageNumber: 1, text: "Page 1 text" },
            { pageNumber: 2, text: "Building Size: XXXXX sq. Ft" },
            { pageNumber: 3, text: "Page 3 text" },
            { pageNumber: 4, text: "Page 4 text" },
            { pageNumber: 5, text: "Page 5 text" },
          ],
        }),
        scanMode: "rules",
      },
      repository,
      {
        runAiAnalysis: jest.fn(async () => []),
        runRuleAnalysis: jest.fn(() => [
          {
            type: "TEMPLATE_ARTIFACT" as const,
            ruleKey: "placeholder_value",
            message: "Placeholder value detected.",
            suggestion: "Replace placeholder values with real report details.",
            sectionName: "Construction Details",
            context: "Building Size: XXXXX sq. Ft",
            location: "Approx. page 1",
            pageNumber: 1,
            matchIndex: null,
          },
        ]),
      },
    );

    expect((repository.createCompletedReport as jest.Mock).mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        issues: [
          expect.objectContaining({
            pageNumber: 2,
            location: "Page 2 - Construction Details",
          }),
        ],
      }),
    );
  });
});

describe("getSessionQcResults", () => {
  it("throws qc_results_not_found when analysis has not been run", async () => {
    const repository = makeRepository({
      findReportBySession: jest.fn(async () => null),
    });

    await expect(
      getSessionQcResults(
        "session-1",
        { userAccountId: 9, role: "CONSULTANT" },
        repository,
        new Date("2026-03-06T11:00:00.000Z"),
      ),
    ).rejects.toMatchObject({
      code: "qc_results_not_found",
      status: 404,
    });
  });

  it("returns persisted QC results even after the report session has been deleted", async () => {
    const repository = makeRepository({
      findActiveSession: jest.fn(async () => null),
      findReportBySession: jest.fn(async () => makePersistedReport()),
    });

    const response = await getSessionQcResults(
      "session-1",
      { userAccountId: 9, role: "CONSULTANT" },
      repository,
      new Date("2026-03-06T11:00:00.000Z"),
    );

    expect(response.reportId).toBe("rep-1");
    expect(response.summary.totalIssues).toBe(2);
  });
});
