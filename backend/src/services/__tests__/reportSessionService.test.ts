import { describe, expect, it, jest } from "@jest/globals";
import {
  createReportSessionFromUpload,
  type ReportSessionRepository,
  type UploadedReportFile,
} from "../reportSessionService";
import { reportUploadConfig } from "../../config/reportUploadConfig";
import { parseStoredExtractedReportText, type ExtractedReportText } from "../../utils/pdf/extractReportText";

jest.mock("../analysis.service", () => ({
  runAnalysis: jest.fn(async () => [
    {
      type: "TEMPLATE_ARTIFACT",
      description: "Placeholder value detected",
      section: "Summary",
    },
  ]),
}));

jest.mock("../../rules/reportTextRules", () => ({
  detectQcIssuesFromText: jest.fn(async () => ({
    issues: [],
  })),
}));

function makePdfFile(overrides: Partial<UploadedReportFile> = {}): UploadedReportFile {
  const buffer = Buffer.from("%PDF-1.4\nDummy PDF content", "ascii");

  return {
    originalname: "sample-report.pdf",
    mimetype: "application/pdf",
    size: buffer.length,
    buffer,
    ...overrides,
  };
}

function makeRepository(): ReportSessionRepository {
  return {
    create: jest.fn(async () => ({
      id: "session-123",
      filename: "sample-report.pdf",
      wordCount: 6,
      estimatedPages: 1,
    })),
    findActiveById: jest.fn(async () => null),
  };
}

function makeNoopDependencies() {
  return {
    repository: makeRepository(),
    cleanupExpiredSessions: jest.fn(async (_now: Date) => undefined),
  };
}

describe("createReportSessionFromUpload", () => {
  it("creates a report session, persists a report, and returns qc issues during upload for AI scans", async () => {
    const repository = makeRepository();
    const extractText = jest.fn<() => Promise<ExtractedReportText>>(async () => ({
      text: "one two three four five six",
      pages: [
        {
          pageNumber: 1,
          text: "one two three four five six",
        },
      ],
    }));
    const cleanupExpiredSessions = jest.fn(async (_now: Date) => undefined);
    const persistCompletedReport = jest.fn(async (_params: {
      reportSessionId: string;
      fileName: string;
      userAccountId: number;
      issues: unknown[];
      scanSource: "ai" | "rules";
      processingTimeSeconds?: number;
    }) => ({
      reportSessionId: "session-123",
      reportId: "report-123",
      filename: "sample-report.pdf",
      scanSource: "ai" as const,
      analysisStatus: "completed" as const,
      summary: {
        totalIssues: 1,
        passedQC: false,
        byType: {
          template_artifact: 1,
          unremoved_guidance: 0,
          missing_information: 0,
          contradiction: 0,
          limitation_contradiction: 0,
          incomplete_limitations: 0,
        },
      },
      issues: [],
      analyzedAt: null,
    }));
    const now = new Date("2026-03-01T12:00:00.000Z");

    const response = await createReportSessionFromUpload(
      {
        userAccountId: 1,
        file: makePdfFile(),
        scanMode: "ai",
      },
      {
        repository,
        extractText,
        cleanupExpiredSessions,
        persistCompletedReport,
        now: () => now,
      },
    );

    expect(response).toEqual({
      reportSessionId: "session-123",
      reportId: "report-123",
      filename: "sample-report.pdf",
      wordCount: 6,
      estimatedPages: 1,
      issues: [
        {
          type: "TEMPLATE_ARTIFACT",
          description: "Placeholder value detected",
          section: "Summary",
        },
      ],
      codeIssues: {
        issues: [],
      },
    });
    expect(cleanupExpiredSessions).toHaveBeenCalledWith(now);
    expect(persistCompletedReport).toHaveBeenCalledWith(
      expect.objectContaining({
        reportSessionId: "session-123",
        fileName: "sample-report.pdf",
        userAccountId: 1,
        scanSource: "ai",
        issues: [
          expect.objectContaining({
            sectionName: "1. Summary",
            location: "1. Summary",
            pageNumber: null,
          }),
        ],
      }),
    );

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userAccountId: 1,
        filename: "sample-report.pdf",
        wordCount: 6,
        estimatedPages: 1,
        expiresAt: new Date(
          now.getTime() + reportUploadConfig.reportSessionTtlHours * 60 * 60 * 1000,
        ),
        text: expect.any(String),
      }),
    );

    const createCall = (repository.create as jest.Mock).mock.calls[0]?.[0] as { text: string };
    const storedText = createCall.text;
    expect(parseStoredExtractedReportText(storedText)).toEqual({
      text: "one two three four five six",
      pages: [
        {
          pageNumber: 1,
          text: "one two three four five six",
        },
      ],
    });
  });

  it("uses canonical section anchors during normal uploads", async () => {
    const repository = makeRepository();
    const extractText = jest.fn<() => Promise<ExtractedReportText>>(async () => ({
      text: "9.3. Electrical Matters\nTemplate text remains.",
      pages: [
        {
          pageNumber: 24,
          text: "9.3. Electrical Matters\nTemplate text remains.",
        },
      ],
    }));
    const persistCompletedReport = jest.fn(async (_params: {
      reportSessionId: string;
      fileName: string;
      userAccountId: number;
      issues: unknown[];
      scanSource: "ai" | "rules";
      processingTimeSeconds?: number;
    }) => ({
      reportSessionId: "session-123",
      reportId: "report-123",
      filename: "sample-report.pdf",
      scanSource: "ai" as const,
      analysisStatus: "completed" as const,
      summary: {
        totalIssues: 1,
        passedQC: false,
        byType: {
          template_artifact: 1,
          unremoved_guidance: 0,
          missing_information: 0,
          contradiction: 0,
          limitation_contradiction: 0,
          incomplete_limitations: 0,
        },
      },
      issues: [],
      analyzedAt: null,
    }));

    const { runAnalysis } = jest.requireMock("../analysis.service") as {
      runAnalysis: jest.Mock;
    };
    runAnalysis.mockImplementationOnce(async () => [
      {
        type: "TEMPLATE_ARTIFACT",
        description: "Placeholder value detected",
        section: "9.3junk",
      },
    ]);

    await createReportSessionFromUpload(
      {
        userAccountId: 1,
        file: makePdfFile(),
        scanMode: "ai",
      },
      {
        repository,
        extractText,
        cleanupExpiredSessions: jest.fn(async (_now: Date) => undefined),
        persistCompletedReport,
      },
    );

    expect(persistCompletedReport).toHaveBeenCalledWith(
      expect.objectContaining({
        scanSource: "ai",
        issues: [
          expect.objectContaining({
            sectionName: "9.3. Electrical Matters",
            location: "9.3. Electrical Matters",
            pageNumber: null,
          }),
        ],
      }),
    );
  });

  it("drops standalone table tokens during normal AI uploads", async () => {
    const repository = makeRepository();
    const extractText = jest.fn<() => Promise<ExtractedReportText>>(async () => ({
      text: "9.5. Training (Fire)\nDRAFT based on ver.0",
      pages: [
        {
          pageNumber: 26,
          text: "9.5. Training (Fire)\nDRAFT based on ver.0",
        },
      ],
    }));
    const persistCompletedReport = jest.fn(async (_params: {
      reportSessionId: string;
      fileName: string;
      userAccountId: number;
      issues: unknown[];
      scanSource: "ai" | "rules";
      processingTimeSeconds?: number;
    }) => ({
      reportSessionId: "session-123",
      reportId: "report-123",
      filename: "sample-report.pdf",
      scanSource: "ai" as const,
      analysisStatus: "completed" as const,
      summary: {
        totalIssues: 1,
        passedQC: false,
        byType: {
          template_artifact: 0,
          unremoved_guidance: 1,
          missing_information: 0,
          contradiction: 0,
          limitation_contradiction: 0,
          incomplete_limitations: 0,
        },
      },
      issues: [],
      analyzedAt: null,
    }));

    const { runAnalysis } = jest.requireMock("../analysis.service") as {
      runAnalysis: jest.Mock;
    };
    runAnalysis.mockImplementationOnce(async () => [
      {
        type: "TEMPLATE_ARTIFACT",
        description: "Found placeholder L/R",
        section: "9.5",
        quote: "L/R",
      },
      {
        type: "UNREMOVED_GUIDANCE",
        description: "Bracketed text not removed",
        section: "9.5",
        quote: "DRAFT based on ver.0",
      },
    ]);

    await createReportSessionFromUpload(
      {
        userAccountId: 1,
        file: makePdfFile(),
        scanMode: "ai",
      },
      {
        repository,
        extractText,
        cleanupExpiredSessions: jest.fn(async (_now: Date) => undefined),
        persistCompletedReport,
      },
    );

    expect(persistCompletedReport).toHaveBeenCalledWith(
      expect.objectContaining({
        scanSource: "ai",
        issues: [
          expect.objectContaining({
            context: "DRAFT based on ver.0",
            sectionName: "9.5. Training (Fire)",
          }),
        ],
      }),
    );
  });

  it("maps generic AI section labels to Unknown during normal AI uploads when no approved heading exists", async () => {
    const repository = makeRepository();
    const extractText = jest.fn<() => Promise<ExtractedReportText>>(async () => ({
      text: "The visit took place on [00:00] and the weather was [XXX].",
      pages: [
        {
          pageNumber: 1,
          text: "The visit took place on [00:00] and the weather was [XXX].",
        },
      ],
    }));
    const persistCompletedReport = jest.fn(async (_params: {
      reportSessionId: string;
      fileName: string;
      userAccountId: number;
      issues: unknown[];
      scanSource: "ai" | "rules";
      processingTimeSeconds?: number;
    }) => ({
      reportSessionId: "session-123",
      reportId: "report-123",
      filename: "sample-report.pdf",
      scanSource: "ai" as const,
      analysisStatus: "completed" as const,
      summary: {
        totalIssues: 1,
        passedQC: false,
        byType: {
          template_artifact: 1,
          unremoved_guidance: 0,
          missing_information: 0,
          contradiction: 0,
          limitation_contradiction: 0,
          incomplete_limitations: 0,
        },
      },
      issues: [],
      analyzedAt: null,
    }));

    const { runAnalysis } = jest.requireMock("../analysis.service") as {
      runAnalysis: jest.Mock;
    };
    runAnalysis.mockImplementationOnce(async () => [
      {
        type: "TEMPLATE_ARTIFACT",
        description: "Placeholder value detected",
        section: "SECTION 0: Section 1",
        quote: "[00:00] and the weather was [XXX].",
      },
    ]);

    await createReportSessionFromUpload(
      {
        userAccountId: 1,
        file: makePdfFile(),
        scanMode: "ai",
        aiLocationMode: "full",
      },
      {
        repository,
        extractText,
        cleanupExpiredSessions: jest.fn(async (_now: Date) => undefined),
        persistCompletedReport,
      },
    );

    expect(persistCompletedReport).toHaveBeenCalledWith(
      expect.objectContaining({
        scanSource: "ai",
        issues: [
          expect.objectContaining({
            sectionName: "Unknown",
            location: "Page 1 - Unknown",
            pageNumber: 1,
          }),
        ],
      }),
    );
  });

  it("throws file_required when the upload has no file", async () => {
    await expect(
      createReportSessionFromUpload(
        { userAccountId: 1, file: undefined },
        makeNoopDependencies(),
      ),
    ).rejects.toMatchObject({
      code: "file_required",
      status: 400,
    });
  });

  it("throws invalid_file_type for non-PDF content", async () => {
    const notPdfFile = makePdfFile({
      mimetype: "text/plain",
      buffer: Buffer.from("plain text", "utf8"),
      size: Buffer.byteLength("plain text"),
    });

    await expect(
      createReportSessionFromUpload(
        { userAccountId: 1, file: notPdfFile },
        makeNoopDependencies(),
      ),
    ).rejects.toMatchObject({
      code: "invalid_file_type",
      status: 415,
    });
  });

  it("throws file_too_large when file exceeds configured size", async () => {
    const tooLargeFile = makePdfFile({
      size: reportUploadConfig.maxReportFileSizeBytes + 1,
    });

    await expect(
      createReportSessionFromUpload(
        { userAccountId: 1, file: tooLargeFile },
        makeNoopDependencies(),
      ),
    ).rejects.toMatchObject({
      code: "file_too_large",
      status: 413,
    });
  });

  it("throws internal_error when extraction fails", async () => {
    const repository = makeRepository();
    const extractText = jest.fn(async () => {
      throw new Error("parse failed");
    });

    await expect(
      createReportSessionFromUpload(
        {
          userAccountId: 1,
          file: makePdfFile(),
        },
        {
          ...makeNoopDependencies(),
          repository,
          extractText,
        },
      ),
    ).rejects.toMatchObject({
      code: "internal_error",
      status: 500,
    });
  });
});
