import { describe, expect, it, jest } from "@jest/globals";
import {
  uploadTrainingExample,
  listTrainingExamples,
  deleteTrainingExample,
  submitFeedback,
  getStats,
  getFeedbackStats,
  getPendingReviewReport,
  type TrainingExampleRepository,
  type FeedbackRepository,
  type TrainingRunRepository,
  type ReportRepository,
  type UploadedTrainingFile,
} from "../aiLearningService";
import { reportUploadConfig } from "../../config/reportUploadConfig";

// --- Test Helpers ---

function makePdfFile(overrides: Partial<UploadedTrainingFile> = {}): UploadedTrainingFile {
  const buffer = Buffer.from("%PDF-1.4\nDummy PDF content", "ascii");
  return {
    originalname: "example-report.pdf",
    mimetype: "application/pdf",
    size: buffer.length,
    buffer,
    ...overrides,
  };
}

function makeTrainingExampleRepo(overrides: Partial<TrainingExampleRepository> = {}): TrainingExampleRepository {
  return {
    create: jest.fn(async () => ({
      id: "te-123",
      fileName: "example-report.pdf",
      type: "GOOD",
      status: "PENDING",
      uploadedAt: new Date("2026-03-10T12:00:00.000Z"),
    })),
    findAll: jest.fn(async () => [
      { id: "te-1", fileName: "good.pdf", type: "GOOD", status: "TRAINED", issueCount: 0, uploadedAt: new Date("2026-01-15T00:00:00.000Z") },
      { id: "te-2", fileName: "bad.pdf", type: "BAD", status: "TRAINED", issueCount: 5, uploadedAt: new Date("2026-01-16T00:00:00.000Z") },
    ]),
    findById: jest.fn(async () => ({ id: "te-123" })),
    delete: jest.fn(async () => undefined),
    countByType: jest.fn(async () => ({ good: 2, bad: 2 })),
    ...overrides,
  };
}

function makeFeedbackRepo(overrides: Partial<FeedbackRepository> = {}): FeedbackRepository {
  return {
    create: jest.fn(async () => ({
      id: "fb-123",
      reportId: "rpt-1",
      rating: "CORRECT",
      createdAt: new Date("2026-03-10T12:00:00.000Z"),
    })),
    findByReportAndUser: jest.fn(async () => null),
    countByRating: jest.fn(async () => ({ correct: 298, needsImprovement: 44 })),
    countThisMonth: jest.fn(async () => 342),
    ...overrides,
  };
}

function makeTrainingRunRepo(overrides: Partial<TrainingRunRepository> = {}): TrainingRunRepository {
  return {
    findLatest: jest.fn(async () => ({
      completedAt: new Date("2026-03-08T10:00:00.000Z"),
      modelAccuracy: 89.5,
    })),
    ...overrides,
  };
}

function makeReportRepo(overrides: Partial<ReportRepository> = {}): ReportRepository {
  return {
    findById: jest.fn(async () => ({
      id: "rpt-1",
      fileName: "Riverside Apartments FRA.pdf",
      totalIssues: 6,
      criticalIssues: 2,
    })),
    findNextUnreviewed: jest.fn(async () => ({
      id: "rpt-1",
      fileName: "Riverside Apartments FRA.pdf",
      totalIssues: 6,
      criticalIssues: 2,
    })),
    ...overrides,
  };
}

const extractText = jest.fn(async () => "Extracted PDF text content");
const now = () => new Date("2026-03-10T12:00:00.000Z");

// --- Tests ---

describe("uploadTrainingExample", () => {
  it("creates a training example for a valid good PDF", async () => {
    const repo = makeTrainingExampleRepo();
    const result = await uploadTrainingExample(
      { userAccountId: 1, file: makePdfFile(), type: "good" },
      { trainingExampleRepo: repo, extractText, now },
    );

    expect(result).toEqual({
      id: "te-123",
      fileName: "example-report.pdf",
      type: "good",
      status: "PENDING",
      uploadedAt: "2026-03-10T12:00:00.000Z",
    });
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: "example-report.pdf",
        type: "GOOD",
        uploadedById: 1,
      }),
    );
  });

  it("creates a training example for a valid bad PDF", async () => {
    const repo = makeTrainingExampleRepo({
      create: jest.fn(async () => ({
        id: "te-456",
        fileName: "bad-example.pdf",
        type: "BAD",
        status: "PENDING",
        uploadedAt: new Date("2026-03-10T12:00:00.000Z"),
      })),
    });

    const result = await uploadTrainingExample(
      { userAccountId: 1, file: makePdfFile({ originalname: "bad-example.pdf" }), type: "bad" },
      { trainingExampleRepo: repo, extractText, now },
    );

    expect(result.type).toBe("bad");
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: "BAD" }),
    );
  });

  it("throws file_required when no file is provided", async () => {
    await expect(
      uploadTrainingExample(
        { userAccountId: 1, file: undefined, type: "good" },
        { trainingExampleRepo: makeTrainingExampleRepo(), extractText, now },
      ),
    ).rejects.toMatchObject({ code: "file_required", status: 400 });
  });

  it("throws invalid_file_type for non-PDF content", async () => {
    const notPdf = makePdfFile({
      mimetype: "text/plain",
      buffer: Buffer.from("plain text", "utf8"),
      size: 10,
    });

    await expect(
      uploadTrainingExample(
        { userAccountId: 1, file: notPdf, type: "good" },
        { trainingExampleRepo: makeTrainingExampleRepo(), extractText, now },
      ),
    ).rejects.toMatchObject({ code: "invalid_file_type", status: 415 });
  });

  it("throws file_too_large when file exceeds limit", async () => {
    const bigFile = makePdfFile({
      size: reportUploadConfig.maxReportFileSizeBytes + 1,
    });

    await expect(
      uploadTrainingExample(
        { userAccountId: 1, file: bigFile, type: "good" },
        { trainingExampleRepo: makeTrainingExampleRepo(), extractText, now },
      ),
    ).rejects.toMatchObject({ code: "file_too_large", status: 413 });
  });

  it("throws invalid_input when type is missing", async () => {
    await expect(
      uploadTrainingExample(
        { userAccountId: 1, file: makePdfFile(), type: "" },
        { trainingExampleRepo: makeTrainingExampleRepo(), extractText, now },
      ),
    ).rejects.toMatchObject({ code: "invalid_input", status: 400 });
  });

  it("throws internal_error when PDF extraction fails", async () => {
    const failExtract = jest.fn(async () => { throw new Error("parse failed"); });

    await expect(
      uploadTrainingExample(
        { userAccountId: 1, file: makePdfFile(), type: "good" },
        { trainingExampleRepo: makeTrainingExampleRepo(), extractText: failExtract, now },
      ),
    ).rejects.toMatchObject({ code: "internal_error", status: 500 });
  });
});

describe("listTrainingExamples", () => {
  it("returns all examples", async () => {
    const repo = makeTrainingExampleRepo();
    const result = await listTrainingExamples(undefined, { trainingExampleRepo: repo });

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: "te-1",
      fileName: "good.pdf",
      uploadDate: "2026-01-15T00:00:00.000Z",
      issues: 0,
      type: "good",
      status: "TRAINED",
    });
    expect(repo.findAll).toHaveBeenCalledWith(undefined);
  });

  it("filters by type when specified", async () => {
    const repo = makeTrainingExampleRepo();
    await listTrainingExamples({ type: "good" }, { trainingExampleRepo: repo });

    expect(repo.findAll).toHaveBeenCalledWith({ type: "GOOD" });
  });
});

describe("deleteTrainingExample", () => {
  it("deletes an existing example", async () => {
    const repo = makeTrainingExampleRepo();
    await deleteTrainingExample("te-123", { trainingExampleRepo: repo });

    expect(repo.findById).toHaveBeenCalledWith("te-123");
    expect(repo.delete).toHaveBeenCalledWith("te-123");
  });

  it("throws not_found for nonexistent ID", async () => {
    const repo = makeTrainingExampleRepo({
      findById: jest.fn(async () => null),
    });

    await expect(
      deleteTrainingExample("nonexistent", { trainingExampleRepo: repo }),
    ).rejects.toMatchObject({ code: "not_found", status: 404 });
  });
});

describe("submitFeedback", () => {
  it("creates feedback with correct rating", async () => {
    const feedbackRepo = makeFeedbackRepo();
    const reportRepo = makeReportRepo();

    const result = await submitFeedback(
      { userAccountId: 1, reportId: "rpt-1", rating: "correct" },
      { feedbackRepo, reportRepo },
    );

    expect(result.id).toBe("fb-123");
    expect(feedbackRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ rating: "CORRECT", reportId: "rpt-1", createdById: 1 }),
    );
  });

  it("creates feedback with needs_improvement rating", async () => {
    const feedbackRepo = makeFeedbackRepo();
    const reportRepo = makeReportRepo();

    await submitFeedback(
      { userAccountId: 1, reportId: "rpt-1", rating: "needs_improvement", comment: "Missing details" },
      { feedbackRepo, reportRepo },
    );

    expect(feedbackRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ rating: "NEEDS_IMPROVEMENT", comment: "Missing details" }),
    );
  });

  it("throws not_found when report does not exist", async () => {
    const reportRepo = makeReportRepo({
      findById: jest.fn(async () => null),
    });

    await expect(
      submitFeedback(
        { userAccountId: 1, reportId: "nonexistent", rating: "correct" },
        { feedbackRepo: makeFeedbackRepo(), reportRepo },
      ),
    ).rejects.toMatchObject({ code: "not_found", status: 404 });
  });

  it("throws already_reviewed when feedback already exists for this report+user", async () => {
    const feedbackRepo = makeFeedbackRepo({
      findByReportAndUser: jest.fn(async () => ({ id: "existing" })),
    });

    await expect(
      submitFeedback(
        { userAccountId: 1, reportId: "rpt-1", rating: "correct" },
        { feedbackRepo, reportRepo: makeReportRepo() },
      ),
    ).rejects.toMatchObject({ code: "already_reviewed", status: 409 });
  });

  it("throws invalid_input for invalid rating value", async () => {
    await expect(
      submitFeedback(
        { userAccountId: 1, reportId: "rpt-1", rating: "invalid" },
        { feedbackRepo: makeFeedbackRepo(), reportRepo: makeReportRepo() },
      ),
    ).rejects.toMatchObject({ code: "invalid_input", status: 400 });
  });
});

describe("getStats", () => {
  it("returns aggregated stats with a training run", async () => {
    const result = await getStats({
      trainingExampleRepo: makeTrainingExampleRepo(),
      feedbackRepo: makeFeedbackRepo(),
      trainingRunRepo: makeTrainingRunRepo(),
      now,
    });

    expect(result).toEqual({
      modelAccuracy: 89.5,
      accuracyChange: 3.2,
      totalExamples: 4,
      goodExamples: 2,
      badExamples: 2,
      lastTrainingDate: "2026-03-08T10:00:00.000Z",
      feedbackReceivedThisMonth: 342,
    });
  });

  it("returns mock accuracy when no training run exists", async () => {
    const result = await getStats({
      trainingExampleRepo: makeTrainingExampleRepo(),
      feedbackRepo: makeFeedbackRepo(),
      trainingRunRepo: makeTrainingRunRepo({
        findLatest: jest.fn(async () => null),
      }),
      now,
    });

    expect(result.modelAccuracy).toBe(87.3);
    expect(result.lastTrainingDate).toBeNull();
  });
});

describe("getFeedbackStats", () => {
  it("returns correct counts and satisfaction rate", async () => {
    const result = await getFeedbackStats({
      feedbackRepo: makeFeedbackRepo(),
    });

    expect(result).toEqual({
      positive: 298,
      negative: 44,
      satisfactionRate: 87.1,
    });
  });

  it("handles zero feedback gracefully", async () => {
    const result = await getFeedbackStats({
      feedbackRepo: makeFeedbackRepo({
        countByRating: jest.fn(async () => ({ correct: 0, needsImprovement: 0 })),
      }),
    });

    expect(result).toEqual({
      positive: 0,
      negative: 0,
      satisfactionRate: 0,
    });
  });
});

describe("getPendingReviewReport", () => {
  it("returns the next unreviewed completed report", async () => {
    const result = await getPendingReviewReport({
      reportRepo: makeReportRepo(),
    });

    expect(result).toEqual({
      reportId: "rpt-1",
      fileName: "Riverside Apartments FRA.pdf",
      issuesDetected: 6,
      criticalIssues: 2,
    });
  });

  it("returns null when all reports have feedback", async () => {
    const result = await getPendingReviewReport({
      reportRepo: makeReportRepo({
        findNextUnreviewed: jest.fn(async () => null),
      }),
    });

    expect(result).toBeNull();
  });
});
