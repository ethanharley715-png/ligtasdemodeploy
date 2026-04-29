import { reportUploadConfig } from "../config/reportUploadConfig";
import { scanConfig } from "../config/scanConfig";
import { prisma } from "../db/prisma";
import { ApiError } from "../errors/apiError";
import {
  extractReportTextWithPages,
  parseStoredExtractedReportText,
  serializeExtractedReportText,
  type ExtractedReportText,
} from "../utils/pdf/extractReportText";
import { runAnalysis } from "./analysis.service";
import { detectQcIssuesFromText } from "../rules/reportTextRules";
import {
  type AiLocationMode,
  normalizeAiIssuesForPersistence,
  normalizeRuleIssuesForPersistence,
  persistPrecomputedReportAnalysis,
  replayPersistedIssueLocationsForPages,
  resolveReportScanMode,
  type PersistedIssueInput,
  type ReportScanMode,
  type SessionQcResultDto,
} from "./reportAnalysisService";

export type UploadedReportFile = Pick<
  Express.Multer.File,
  "originalname" | "mimetype" | "size" | "buffer"
>;

export type ReportUploadResponseDto = {
  reportSessionId: string;
  reportId?: string;
  filename: string;
  wordCount: number;
  estimatedPages: number;
  issues: { type: string; description: string; section: string }[];
  codeIssues: unknown;
};

type ReportSessionCreateData = {
  userAccountId: number;
  filename: string;
  text: string;
  wordCount: number;
  estimatedPages: number;
  expiresAt: Date;
};

type ReportSessionSummary = {
  id: string;
  filename: string;
  wordCount: number;
  estimatedPages: number;
};

type ReportInput = {
  id: string;
  observations: string;
  findings: string;
  limitations: string;
  conclusion: string;
  full: string;
};

export type ActiveReportSession = {
  id: string;
  userAccountId: number;
  filename: string;
  text: string;
  wordCount: number;
  estimatedPages: number;
  createdAt: Date;
  expiresAt: Date;
};

export interface ReportSessionRepository {
  create(data: ReportSessionCreateData): Promise<ReportSessionSummary>;
  findActiveById(reportSessionId: string, userAccountId: number, now: Date): Promise<ActiveReportSession | null>;
}

type UploadDependencies = {
  repository: ReportSessionRepository;
  extractText: (buffer: Buffer) => Promise<ExtractedReportText>;
  cleanupExpiredSessions: (now: Date) => Promise<void>;
  persistCompletedReport: (params: {
    reportSessionId: string;
    fileName: string;
    userAccountId: number;
    issues: PersistedIssueInput[];
    scanSource: ReportScanMode;
    processingTimeSeconds?: number;
  }) => Promise<SessionQcResultDto>;
  deleteSession: (reportSessionId: string) => Promise<void>;
  now: () => Date;
  onProgress?: (batchIssues: unknown[], processed: number, total: number) => void;
};

const prismaReportSessionRepository: ReportSessionRepository = {
  async create(data) {
    return prisma.reportSession.create({
      data,
      select: {
        id: true,
        filename: true,
        wordCount: true,
        estimatedPages: true,
      },
    });
  },

  async findActiveById(reportSessionId, userAccountId, now) {
    return prisma.reportSession.findFirst({
      where: {
        id: reportSessionId,
        userAccountId,
        expiresAt: {
          gt: now,
        },
      },
    });
  },
};

const defaultDependencies: UploadDependencies = {
  repository: prismaReportSessionRepository,
  extractText: extractReportTextWithPages,
  cleanupExpiredSessions: async (now) => {
    const deleted = await prisma.reportSession.deleteMany({
      where: {
        expiresAt: {
          lte: now,
        },
      },
    });

    if (deleted.count > 0) {
      console.info("[report-session] deleted expired raw text sessions", {
        deletedCount: deleted.count,
      });
    }
  },
  persistCompletedReport: persistPrecomputedReportAnalysis,
  deleteSession: async (reportSessionId) => {
    await prisma.reportSession.deleteMany({
      where: { id: reportSessionId },
    });
  },
  now: () => new Date(),
};

function applyReplayToPersistedAiIssues(
  issues: PersistedIssueInput[],
  pages: ExtractedReportText["pages"],
): PersistedIssueInput[] {
  const replayed = replayPersistedIssueLocationsForPages(
    issues.map((issue, index) => ({
      id: `upload-issue-${index}`,
      description: issue.description,
      context: issue.context,
      location: issue.location,
      pageNumber: issue.pageNumber,
      sectionName: issue.sectionName,
    })),
    pages,
  );

  return issues.map((issue, index) => ({
    ...issue,
    location: replayed[index]?.replayed.location ?? issue.location,
    pageNumber: replayed[index]?.replayed.pageNumber ?? issue.pageNumber,
    sectionName: replayed[index]?.replayed.sectionName ?? issue.sectionName,
  }));
}

function hasPdfMagicBytes(fileBuffer: Buffer): boolean {
  if (fileBuffer.length < 5) {
    return false;
  }

  return fileBuffer.subarray(0, 5).toString("ascii") === "%PDF-";
}

function isPdfMimeType(mimeType: string): boolean {
  return mimeType.toLowerCase().startsWith("application/pdf");
}

function countWords(text: string): number {
  const normalized = text.trim();

  if (!normalized) {
    return 0;
  }

  return normalized.split(/\s+/).length;
}

function estimatePages(wordCount: number): number {
  return Math.max(1, Math.ceil(wordCount / reportUploadConfig.wordsPerPageHeuristic));
}

function validateUploadedReportFile(file?: UploadedReportFile | null): asserts file is UploadedReportFile {
  if (!file) {
    throw new ApiError(400, "file_required", "A PDF report file is required.");
  }

  if (file.size > reportUploadConfig.maxReportFileSizeBytes) {
    throw new ApiError(413, "file_too_large", "Uploaded file exceeds the maximum allowed size.");
  }

  if (!isPdfMimeType(file.mimetype) || !hasPdfMagicBytes(file.buffer)) {
    throw new ApiError(415, "invalid_file_type", "Only valid PDF files are supported.");
  }
}

/**
 * Validates an uploaded PDF, extracts text, runs QC checks, and persists the completed report.
 * The short-lived session remains as a bridge for the existing upload/result handoff.
 */
export async function createReportSessionFromUpload(
    input: {
      userAccountId: number;
      file?: UploadedReportFile | null;
      scanMode?: ReportScanMode;
      aiLocationMode?: AiLocationMode;
    },
    dependencies: Partial<UploadDependencies> = {},
): Promise<ReportUploadResponseDto> {
    const { userAccountId } = input;
    const deps = { ...defaultDependencies, ...dependencies };
    const createdAt = deps.now();
    let scanMode = resolveReportScanMode(input.scanMode);
    const aiLocationMode = input.aiLocationMode ?? "canonical_only";

    if (userAccountId == null) {
        throw new ApiError(401, "unauthorized", "Authentication is required.");
    }

    if (scanMode !== "ai" && scanMode !== "rules") {
        throw new ApiError(400, "invalid_scan_mode", "Invalid report scan mode.");
    }

    if (scanMode === "rules" && !scanConfig.ruleScanEnabled) {
        throw new ApiError(503, "rule_scan_unavailable", "Rule-based scan is currently unavailable.");
    }

    await deps.cleanupExpiredSessions(createdAt);
    validateUploadedReportFile(input.file);

    let extracted: ExtractedReportText;
    try {
        extracted = await deps.extractText(input.file.buffer);
    } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError(500, "internal_error", "Failed to process uploaded PDF.");
    }
    const extractedText = extracted.text;
    const processingStartedAt = createdAt.getTime();

    const report: ReportInput = {
        id: "",
        observations: "",
        findings: "",
        limitations: "",
        conclusion: "",
        full: extractedText,
    };

    const codeIssues = await detectQcIssuesFromText(extractedText);
    let issues: Awaited<ReturnType<typeof runAnalysis>> = [];

    if (scanMode === "ai") {
      try {
        issues = await runAnalysis(report, deps.onProgress);
      } catch (error) {
        console.warn("[report-upload] AI scan failed", {
          provider: scanConfig.aiProvider,
          filename: input.file.originalname,
          error: error instanceof Error ? error.message : "unknown_error",
        });

        if (!scanConfig.ruleScanEnabled) {
          throw new ApiError(
            503,
            "ai_scan_failed",
            "AI scan failed before completion. Retry with AI later or switch to the rule-based scan option.",
          );
        }

        console.info("[report-upload] falling back to rule scan after AI failure", {
          provider: scanConfig.aiProvider,
          filename: input.file.originalname,
        });
        scanMode = "rules";
      }
    }

    const wordCount = countWords(extractedText);
    const estimatedPages = estimatePages(wordCount);
    const expiresAt = new Date(
        createdAt.getTime() + reportUploadConfig.reportSessionTtlHours * 60 * 60 * 1000
    );

    // Store extracted text temporarily so session endpoints can reuse the upload without retaining the PDF.
    const createdSession = await deps.repository.create({
        userAccountId,
        filename: input.file.originalname,
        text: serializeExtractedReportText(extracted),
        wordCount,
        estimatedPages,
        expiresAt,
    });

    const persistedIssues =
      scanMode === "ai"
        ? (() => {
            const normalizedIssues = normalizeAiIssuesForPersistence(issues, extracted.pages, {
              aiLocationMode,
            });

            return aiLocationMode === "full"
              ? applyReplayToPersistedAiIssues(normalizedIssues, extracted.pages)
              : normalizedIssues;
          })()
        : normalizeRuleIssuesForPersistence(codeIssues.issues, extracted.pages);

    console.info("[report-upload] prepared persisted issues", {
      reportSessionId: createdSession.id,
      filename: createdSession.filename,
      scanMode,
      aiLocationMode: scanMode === "ai" ? aiLocationMode : undefined,
      aiIssueCount: issues.length,
      ruleIssueCount: codeIssues.issues.length,
      persistedIssueCount: persistedIssues.length,
      passedQC: persistedIssues.length === 0,
    });

    const processingTimeSeconds = Math.max(
      1,
      Math.round((deps.now().getTime() - processingStartedAt) / 1000),
    );

    let persistedResult: SessionQcResultDto;

    try {
      // Persist immediately so Report History and Report Detail read from the same database-backed result.
      persistedResult = await deps.persistCompletedReport({
        reportSessionId: createdSession.id,
        fileName: createdSession.filename,
        userAccountId,
        issues: persistedIssues,
        scanSource: scanMode,
        processingTimeSeconds,
      });

      console.info("[report-upload] persisted completed report", {
        reportSessionId: createdSession.id,
        reportId: persistedResult.reportId,
        scanMode,
        aiLocationMode: scanMode === "ai" ? aiLocationMode : undefined,
        persistedIssueCount: persistedIssues.length,
        passedQC: persistedIssues.length === 0,
      });
    } catch (error) {
      await deps.deleteSession(createdSession.id).catch(() => undefined);

      console.warn("[report-upload] deleted report session raw text after failed persistence", {
        reportSessionId: createdSession.id,
        filename: createdSession.filename,
      });

      throw error;
    }

    return {
        reportSessionId: createdSession.id,
        reportId: persistedResult.reportId,
        filename: createdSession.filename,
        wordCount: createdSession.wordCount,
        estimatedPages: createdSession.estimatedPages,
        issues,
        codeIssues,
    };
}

export async function getActiveReportSession(
  reportSessionId: string,
  userAccountId: number,
  repository: ReportSessionRepository = prismaReportSessionRepository,
  now: Date = new Date(),
): Promise<ActiveReportSession | null> {
  const session = await repository.findActiveById(reportSessionId, userAccountId, now);
  if (!session) {
    return null;
  }

  return {
    ...session,
    text: parseStoredExtractedReportText(session.text).text,
  };
}
