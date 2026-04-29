import { prisma } from "../db/prisma";
import { ApiError } from "../errors/apiError";
import { extractReportText } from "../utils/pdf/extractReportText";
import { anonymizeText as anonymizeTextFn } from "../utils/text/anonymizeText";
import { reportUploadConfig } from "../config/reportUploadConfig";

// --- Types ---

export type UploadedTrainingFile = Pick<
  Express.Multer.File,
  "originalname" | "mimetype" | "size" | "buffer"
>;

export type TrainingExampleSummary = {
  id: string;
  fileName: string;
  uploadDate: string;
  issues: number;
  type: "good" | "bad";
  status: string;
};

type TrainingExampleCreateData = {
  fileName: string;
  fileSizeBytes: number;
  type: "GOOD" | "BAD";
  issueCount: number;
  uploadedById: number;
  extractedText: string;
};

export type FeedbackRecord = {
  id: string;
  reportId: string;
  rating: string;
  createdAt: Date;
};

export type StatsOverviewDto = {
  modelAccuracy: number;
  accuracyChange: number;
  totalExamples: number;
  goodExamples: number;
  badExamples: number;
  lastTrainingDate: string | null;
  feedbackReceivedThisMonth: number;
};

export type FeedbackStatsDto = {
  positive: number;
  negative: number;
  satisfactionRate: number;
};

export type PendingReviewDto = {
  reportId: string;
  fileName: string;
  issuesDetected: number;
  criticalIssues: number;
};

// --- Repository Interfaces ---

export interface TrainingExampleRepository {
  create(data: TrainingExampleCreateData): Promise<{ id: string; fileName: string; type: string; status: string; uploadedAt: Date }>;
  findAll(filter?: { type?: "GOOD" | "BAD" }): Promise<Array<{ id: string; fileName: string; type: string; status: string; issueCount: number; uploadedAt: Date }>>;
  findById(id: string): Promise<{ id: string } | null>;
  delete(id: string): Promise<void>;
  countByType(): Promise<{ good: number; bad: number }>;
}

export interface FeedbackRepository {
  create(data: { reportId: string; rating: "CORRECT" | "NEEDS_IMPROVEMENT"; createdById: number; comment?: string }): Promise<FeedbackRecord>;
  findByReportAndUser(reportId: string, userId: number): Promise<{ id: string } | null>;
  countByRating(): Promise<{ correct: number; needsImprovement: number }>;
  countThisMonth(now: Date): Promise<number>;
}

export interface TrainingRunRepository {
  findLatest(): Promise<{ completedAt: Date | null; modelAccuracy: number | null } | null>;
}

export interface ReportRepository {
  findById(id: string): Promise<{ id: string; fileName: string; totalIssues: number; criticalIssues: number } | null>;
  findNextUnreviewed(): Promise<{ id: string; fileName: string; totalIssues: number; criticalIssues: number } | null>;
}

// --- Prisma Implementations ---

const prismaTrainingExampleRepo: TrainingExampleRepository = {
  async create(data) {
    return prisma.trainingExample.create({
      data,
      select: { id: true, fileName: true, type: true, status: true, uploadedAt: true },
    });
  },

  async findAll(filter) {
    return prisma.trainingExample.findMany({
      where: filter?.type ? { type: filter.type } : undefined,
      orderBy: { uploadedAt: "desc" },
      select: { id: true, fileName: true, type: true, status: true, issueCount: true, uploadedAt: true },
    });
  },

  async findById(id) {
    return prisma.trainingExample.findUnique({ where: { id }, select: { id: true } });
  },

  async delete(id) {
    await prisma.trainingExample.delete({ where: { id } });
  },

  async countByType() {
    const [good, bad] = await Promise.all([
      prisma.trainingExample.count({ where: { type: "GOOD" } }),
      prisma.trainingExample.count({ where: { type: "BAD" } }),
    ]);
    return { good, bad };
  },
};

const prismaFeedbackRepo: FeedbackRepository = {
  async create(data) {
    return prisma.adminFeedback.create({
      data,
      select: { id: true, reportId: true, rating: true, createdAt: true },
    });
  },

  async findByReportAndUser(reportId, userId) {
    return prisma.adminFeedback.findFirst({
      where: { reportId, createdById: userId },
      select: { id: true },
    });
  },

  async countByRating() {
    const [correct, needsImprovement] = await Promise.all([
      prisma.adminFeedback.count({ where: { rating: "CORRECT" } }),
      prisma.adminFeedback.count({ where: { rating: "NEEDS_IMPROVEMENT" } }),
    ]);
    return { correct, needsImprovement };
  },

  async countThisMonth(now) {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return prisma.adminFeedback.count({
      where: { createdAt: { gte: startOfMonth } },
    });
  },
};

const prismaTrainingRunRepo: TrainingRunRepository = {
  async findLatest() {
    return prisma.trainingRun.findFirst({
      orderBy: { startedAt: "desc" },
      select: { completedAt: true, modelAccuracy: true },
    });
  },
};

const prismaReportRepo: ReportRepository = {
  async findById(id) {
    return prisma.report.findUnique({
      where: { id },
      select: { id: true, fileName: true, totalIssues: true, criticalIssues: true },
    });
  },

  async findNextUnreviewed() {
    // Find the most recent completed report that has no admin feedback yet
    return prisma.report.findFirst({
      where: {
        status: "COMPLETED",
        feedbacks: { none: {} },
      },
      orderBy: { uploadedAt: "desc" },
      select: { id: true, fileName: true, totalIssues: true, criticalIssues: true },
    });
  },
};

// --- Dependencies ---

export type AiLearningDependencies = {
  trainingExampleRepo: TrainingExampleRepository;
  feedbackRepo: FeedbackRepository;
  trainingRunRepo: TrainingRunRepository;
  reportRepo: ReportRepository;
  extractText: (buffer: Buffer) => Promise<string>;
  anonymizeText: (text: string) => string;
  now: () => Date;
};

const defaultDependencies: AiLearningDependencies = {
  trainingExampleRepo: prismaTrainingExampleRepo,
  feedbackRepo: prismaFeedbackRepo,
  trainingRunRepo: prismaTrainingRunRepo,
  reportRepo: prismaReportRepo,
  extractText: extractReportText,
  anonymizeText: anonymizeTextFn,
  now: () => new Date(),
};

// --- Validation Helpers ---

function hasPdfMagicBytes(fileBuffer: Buffer): boolean {
  if (fileBuffer.length < 5) return false;
  return fileBuffer.subarray(0, 5).toString("ascii") === "%PDF-";
}

function isPdfMimeType(mimeType: string): boolean {
  return mimeType.toLowerCase().startsWith("application/pdf");
}

function validateTrainingFile(file?: UploadedTrainingFile | null): asserts file is UploadedTrainingFile {
  if (!file) {
    throw new ApiError(400, "file_required", "A PDF training example file is required.");
  }
  if (file.size > reportUploadConfig.maxReportFileSizeBytes) {
    throw new ApiError(413, "file_too_large", "Uploaded file exceeds the maximum allowed size.");
  }
  if (!isPdfMimeType(file.mimetype) || !hasPdfMagicBytes(file.buffer)) {
    throw new ApiError(415, "invalid_file_type", "Only valid PDF files are supported.");
  }
}

function validateExampleType(type: string): asserts type is "good" | "bad" {
  if (type !== "good" && type !== "bad") {
    throw new ApiError(400, "invalid_input", "Type must be 'good' or 'bad'.");
  }
}

// --- Service Functions ---

/**
 * Upload a new training example PDF (good or bad).
 */
export async function uploadTrainingExample(
  input: { userAccountId: number; file?: UploadedTrainingFile | null; type: string },
  dependencies: Partial<AiLearningDependencies> = {},
) {
  const deps = { ...defaultDependencies, ...dependencies };

  validateExampleType(input.type);
  validateTrainingFile(input.file);

  let extractedText: string;
  try {
    extractedText = await deps.extractText(input.file.buffer);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, "internal_error", "Failed to process uploaded PDF.");
  }

  extractedText = deps.anonymizeText(extractedText);

  const dbType = input.type === "good" ? "GOOD" as const : "BAD" as const;

  const created = await deps.trainingExampleRepo.create({
    fileName: input.file.originalname,
    fileSizeBytes: input.file.size,
    type: dbType,
    issueCount: 0,
    uploadedById: input.userAccountId,
    extractedText,
  });

  return {
    id: created.id,
    fileName: created.fileName,
    type: input.type,
    status: created.status,
    uploadedAt: created.uploadedAt.toISOString(),
  };
}

/**
 * List all training examples, optionally filtered by type.
 */
export async function listTrainingExamples(
  filter?: { type?: string },
  dependencies: Partial<AiLearningDependencies> = {},
): Promise<TrainingExampleSummary[]> {
  const deps = { ...defaultDependencies, ...dependencies };

  const dbFilter = filter?.type
    ? { type: filter.type.toUpperCase() as "GOOD" | "BAD" }
    : undefined;

  const examples = await deps.trainingExampleRepo.findAll(dbFilter);

  return examples.map((e) => ({
    id: e.id,
    fileName: e.fileName,
    uploadDate: e.uploadedAt.toISOString(),
    issues: e.issueCount,
    type: e.type.toLowerCase() as "good" | "bad",
    status: e.status,
  }));
}

/**
 * Delete a training example by ID.
 */
export async function deleteTrainingExample(
  id: string,
  dependencies: Partial<AiLearningDependencies> = {},
): Promise<void> {
  const deps = { ...defaultDependencies, ...dependencies };

  const existing = await deps.trainingExampleRepo.findById(id);
  if (!existing) {
    throw new ApiError(404, "not_found", "Training example not found.");
  }

  await deps.trainingExampleRepo.delete(id);
}

/**
 * Submit admin feedback (correct / needs improvement) on a QC report.
 */
export async function submitFeedback(
  input: { userAccountId: number; reportId: string; rating: string; comment?: string },
  dependencies: Partial<AiLearningDependencies> = {},
): Promise<FeedbackRecord> {
  const deps = { ...defaultDependencies, ...dependencies };

  if (input.rating !== "correct" && input.rating !== "needs_improvement") {
    throw new ApiError(400, "invalid_input", "Rating must be 'correct' or 'needs_improvement'.");
  }

  const report = await deps.reportRepo.findById(input.reportId);
  if (!report) {
    throw new ApiError(404, "not_found", "Report not found.");
  }

  const existingFeedback = await deps.feedbackRepo.findByReportAndUser(input.reportId, input.userAccountId);
  if (existingFeedback) {
    throw new ApiError(409, "already_reviewed", "You have already submitted feedback for this report.");
  }

  const dbRating = input.rating === "correct" ? "CORRECT" as const : "NEEDS_IMPROVEMENT" as const;

  return deps.feedbackRepo.create({
    reportId: input.reportId,
    rating: dbRating,
    createdById: input.userAccountId,
    comment: input.comment,
  });
}

/**
 * Get aggregated stats for the AI Learning dashboard.
 * Uses mock fallbacks for model accuracy until the AI service is integrated.
 */
export async function getStats(
  dependencies: Partial<AiLearningDependencies> = {},
): Promise<StatsOverviewDto> {
  const deps = { ...defaultDependencies, ...dependencies };

  const [counts, latestRun, feedbackThisMonth] = await Promise.all([
    deps.trainingExampleRepo.countByType(),
    deps.trainingRunRepo.findLatest(),
    deps.feedbackRepo.countThisMonth(deps.now()),
  ]);

  // Mock fallbacks until AI training service is ready
  const modelAccuracy = latestRun?.modelAccuracy ?? 87.3;
  const accuracyChange = 3.2; // placeholder until AI service provides delta

  return {
    modelAccuracy,
    accuracyChange,
    totalExamples: counts.good + counts.bad,
    goodExamples: counts.good,
    badExamples: counts.bad,
    lastTrainingDate: latestRun?.completedAt?.toISOString() ?? null,
    feedbackReceivedThisMonth: feedbackThisMonth,
  };
}

/**
 * Get feedback statistics (positive, negative, satisfaction rate).
 */
export async function getFeedbackStats(
  dependencies: Partial<AiLearningDependencies> = {},
): Promise<FeedbackStatsDto> {
  const deps = { ...defaultDependencies, ...dependencies };

  const counts = await deps.feedbackRepo.countByRating();
  const total = counts.correct + counts.needsImprovement;

  return {
    positive: counts.correct,
    negative: counts.needsImprovement,
    satisfactionRate: total > 0 ? Math.round((counts.correct / total) * 1000) / 10 : 0,
  };
}

/**
 * Get the next completed report that hasn't been reviewed yet.
 */
export async function getPendingReviewReport(
  dependencies: Partial<AiLearningDependencies> = {},
): Promise<PendingReviewDto | null> {
  const deps = { ...defaultDependencies, ...dependencies };

  const report = await deps.reportRepo.findNextUnreviewed();
  if (!report) return null;

  return {
    reportId: report.id,
    fileName: report.fileName,
    issuesDetected: report.totalIssues,
    criticalIssues: report.criticalIssues,
  };
}
