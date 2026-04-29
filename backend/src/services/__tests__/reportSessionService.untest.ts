/*import { describe, expect, it, jest } from "@jest/globals";
import {
  createReportSessionFromUpload,
  type ReportSessionRepository,
  type UploadedReportFile,
} from "../reportSessionService";
import { reportUploadConfig } from "../../config/reportUploadConfig";

jest.mock("../analysis.service", () => ({
  runAnalysis: jest.fn(async () => []),
}));

jest.mock("../reportAnalysisService", () => ({
  persistReportAnalysisFromText: jest.fn(async () => ({
    reportSessionId: "session-123",
    reportId: "rep-123",
    filename: "sample-report.pdf",
    analysisStatus: "completed",
    summary: {
      totalIssues: 1,
      passedQC: false,
      byType: {
        template_artifact: 1,
        unremoved_guidance: 0,
        missing_information: 0,
      },
    },
    issues: [
      {
        id: "issue-1",
        type: "template_artifact",
        ruleKey: "placeholder_xxx",
        message: "Placeholder value detected.",
        suggestion: "Replace placeholder values.",
        section: "Summary",
        location: {
          page: 1,
          section: "Summary",
        },
        context: "[XXX]",
      },
    ],
    analyzedAt: "2026-03-01T12:00:00.000Z",
  })),
}));

jest.mock("p-limit", () => {
  return () => (fn: any) => fn();
});

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

describe("createReportSessionFromUpload", () => {
   jest.setTimeout(60000); 
  it("creates a report session for a valid upload", async () => {
    const repository = makeRepository();
    const extractText = jest.fn(async () => "one two three four five six");
    const cleanupExpiredSessions = jest.fn(async () => undefined);
    const now = new Date("2026-03-01T12:00:00.000Z");

    const response = await createReportSessionFromUpload(
      {
        userAccountId: 1,
        file: makePdfFile(),
      },
      {
        repository,
        extractText,
        cleanupExpiredSessions,
        now: () => now,
      },
    );

    expect(response).toEqual({
      reportSessionId: expect.any(String),
      reportId: expect.any(String),
      filename: expect.any(String),
      estimatedPages: expect.any(Number),
      wordCount: expect.any(Number),
      issues: expect.any(Array),
      codeIssues: {
        issues: expect.any(Array),
      },
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userAccountId: 1,
        filename: "sample-report.pdf",
        wordCount: 6,
        estimatedPages: 1,
        expiresAt: expect.any(Date),
      }),
    );
    expect(cleanupExpiredSessions).toHaveBeenCalledTimes(1);
  });

  it("throws file_required when the upload has no file", async () => {
    await expect(
      createReportSessionFromUpload({ userAccountId: 1, file: undefined }, { repository: makeRepository() }),
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
      createReportSessionFromUpload({ userAccountId: 1, file: notPdfFile }, { repository: makeRepository() }),
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
      createReportSessionFromUpload({ userAccountId: 1, file: tooLargeFile }, { repository: makeRepository() }),
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
*/