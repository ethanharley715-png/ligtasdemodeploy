import { prisma } from "../db/prisma";
import { ApiError } from "../errors/apiError";
import { extractReportTextWithPages, type ExtractedReportText } from "../utils/pdf/extractReportText";
import {
  replayPersistedIssueLocationsForPages,
  type PersistedIssueReplayResult,
} from "./reportAnalysisService";

type ReplayActor = {
  userAccountId: number;
  role: string;
};

type ReplayReportIssue = {
  id: string;
  type: string;
  description: string;
  context: string;
  location: string;
  pageNumber: number | null;
  sectionName: string | null;
};

type ReplayReportRecord = {
  id: string;
  fileName: string;
  issues: ReplayReportIssue[];
};

type ReplayRepository = {
  findReportById(reportId: string, actor: ReplayActor): Promise<ReplayReportRecord | null>;
};

type ReplayDependencies = {
  extractPages(pdfBuffer: Buffer): Promise<ExtractedReportText>;
};

export type ReportLocationReplayResult = {
  reportId: string;
  fileName: string;
  extractedPageCount: number;
  totalIssues: number;
  changedIssues: number;
  issues: Array<
    PersistedIssueReplayResult & {
      type: string;
      description: string;
      context: string;
    }
  >;
};

const prismaReplayRepository: ReplayRepository = {
  async findReportById(reportId, actor) {
    return prisma.report.findFirst({
      where: {
        id: reportId,
        ...(actor.role === "ADMIN" ? {} : { userAccountId: actor.userAccountId }),
      },
      select: {
        id: true,
        fileName: true,
        issues: {
          orderBy: [{ pageNumber: "asc" }, { id: "asc" }],
          select: {
            id: true,
            type: true,
            description: true,
            context: true,
            location: true,
            pageNumber: true,
            sectionName: true,
          },
        },
      },
    });
  },
};

const defaultDependencies: ReplayDependencies = {
  extractPages: extractReportTextWithPages,
};

function isPdfFile(file: { mimetype?: string; originalname?: string } | undefined): boolean {
  if (!file) {
    return false;
  }

  return (
    file.mimetype === "application/pdf" ||
    file.originalname?.toLowerCase().endsWith(".pdf") === true
  );
}

/**
 * Replays stored issue context against a newly supplied PDF without persisting changes.
 * This lets reviewers refresh page/section anchors when extraction quality differs by file.
 */
export async function replayReportIssueLocations(
  params: {
    reportId: string;
    actor: ReplayActor;
    file?: {
      buffer: Buffer;
      mimetype?: string;
      originalname?: string;
    };
  },
  repository: ReplayRepository = prismaReplayRepository,
  dependencies: ReplayDependencies = defaultDependencies,
): Promise<ReportLocationReplayResult> {
  if (!params.file?.buffer?.length) {
    throw new ApiError(400, "file_required", "A PDF file is required for location replay.");
  }

  if (!isPdfFile(params.file)) {
    throw new ApiError(415, "invalid_file_type", "Only valid PDF files are accepted.");
  }

  const report = await repository.findReportById(params.reportId, params.actor);
  if (!report) {
    throw new ApiError(404, "not_found", "Report not found.");
  }

  const extracted = await dependencies.extractPages(params.file.buffer);
  const replayed = replayPersistedIssueLocationsForPages(report.issues, extracted.pages);

  return {
    reportId: report.id,
    fileName: report.fileName,
    extractedPageCount: extracted.pages.length,
    totalIssues: report.issues.length,
    changedIssues: replayed.filter(
      (issue) =>
        issue.changed.location || issue.changed.pageNumber || issue.changed.sectionName,
    ).length,
    issues: report.issues.map((issue, index) => ({
      ...replayed[index],
      type: issue.type,
      description: issue.description,
      context: issue.context,
    })),
  };
}
