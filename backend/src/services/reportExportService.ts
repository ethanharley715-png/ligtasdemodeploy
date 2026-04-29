import JSZip from "jszip";
import { prisma } from "../db/prisma";
import { ApiError } from "../errors/apiError";
import { buildReportExportCsv } from "../utils/export/csv";
import { buildReportExportPdf } from "../utils/export/pdf";

export type ExportActor = {
  userAccountId: number;
  role: string;
};

type ReportIssueRow = {
  id: string;
  type: string;
  ruleKey: string | null;
  description: string;
  location: string;
  context: string;
  suggestion: string;
  pageNumber: number | null;
  sectionName: string | null;
};

type ReportRow = {
  id: string;
  fileName: string;
  status: "PROCESSING" | "COMPLETED" | "FAILED";
  uploadedAt: Date;
  analyzedAt: Date | null;
  passedQC: boolean;
  totalIssues: number;
  userAccountId: number | null;
  userAccount: { email: string } | null;
  issues: ReportIssueRow[];
};

export type ReportExportData = {
  report: {
    id: string;
    fileName: string;
    status: string;
    uploadedAt: string;
    analyzedAt: string | null;
    analystEmail: string | null;
  };
  generatedAt: string;
  summary: {
    totalIssues: number;
    passedQC: boolean;
    byType: Array<{
      type: string;
      label: string;
      count: number;
    }>;
  };
  issues: Array<{
    id: string;
    type: string;
    typeLabel: string;
    ruleKey: string | null;
    description: string;
    location: string;
    context: string;
    suggestion: string;
    pageNumber: number | null;
    sectionName: string | null;
  }>;
};

export interface ReportExportRepository {
  findAccessibleReport(reportId: string, actor: ExportActor): Promise<ReportRow | null>;
}

const prismaReportExportRepository: ReportExportRepository = {
  async findAccessibleReport(reportId, actor) {
    return prisma.report.findFirst({
      where: {
        id: reportId,
        ...(actor.role !== "ADMIN" ? { userAccountId: actor.userAccountId } : {}),
      },
      include: {
        userAccount: { select: { email: true } },
        issues: {
          orderBy: [{ pageNumber: "asc" }, { sectionName: "asc" }, { id: "asc" }],
        },
      },
    });
  },
};

/** Limits export to reports whose owner belongs to a given team. */
export function createTeamScopedRepository(teamId: string): ReportExportRepository {
  return {
    async findAccessibleReport(reportId, _actor) {
      return prisma.report.findFirst({
        where: {
          id: reportId,
          status: "COMPLETED",
          analyzedAt: { not: null },
          userAccount: { teamId },
        },
        include: {
          userAccount: { select: { email: true } },
          issues: {
            orderBy: [{ pageNumber: "asc" }, { sectionName: "asc" }, { id: "asc" }],
          },
        },
      });
    },
  };
}

export type TeamExportScope = { mode: "all" } | { mode: "team"; teamId: string };

function completedReportWhere(scope: TeamExportScope) {
  const base = { status: "COMPLETED" as const, analyzedAt: { not: null } as const };
  if (scope.mode === "all") return base;
  return {
    ...base,
    userAccount: { teamId: scope.teamId },
  };
}

function exportScopeFileStem(scope: TeamExportScope): string {
  if (scope.mode === "all") return "all-teams";
  return `team-${scope.teamId.slice(0, 8)}`;
}

function formatIssueType(type: string): string {
  return type
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

const DEFAULT_ISSUE_SUGGESTIONS: Record<string, string> = {
  TEMPLATE_ARTIFACT: "Replace placeholder or template text with the correct final report content.",
  UNREMOVED_GUIDANCE: "Remove drafting guidance or instructional text before finalizing the report.",
  MISSING_INFORMATION: "Add the missing report details so the section is complete and verifiable.",
  CONTRADICTION: "Resolve the conflicting statements so the report is internally consistent.",
  LIMITATION_CONTRADICTION: "Clarify the limitation and align it with the rest of the report content.",
  INCOMPLETE_LIMITATIONS: "Complete the limitations section with clear scope, exclusions, or constraints.",
};

function normalizeIssueTypeKey(value: string): string {
  return value
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

function isMissingSuggestion(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return ["", "n/a", "na", "none", "no suggestion", "no suggestion available"].includes(normalized);
}

function resolveIssueSuggestion(type: string, suggestion: string): string {
  if (!isMissingSuggestion(suggestion)) {
    return suggestion.trim();
  }

  return DEFAULT_ISSUE_SUGGESTIONS[normalizeIssueTypeKey(type)] ?? "No suggestion available.";
}

function sanitizeStem(value: string): string {
  const cleaned = value
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return cleaned || "report";
}

function formatExportDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatExportTimestamp(date: Date): string {
  return date
    .toISOString()
    .replace(/:/g, "-")
    .replace(/\.\d{3}Z$/, "Z");
}

export function buildExportFilename(fileName: string, reportId: string, extension: "csv" | "pdf", now: Date): string {
  return `${sanitizeStem(fileName)}__${reportId}__qc-results__${formatExportDate(now)}__generated-${formatExportTimestamp(now)}.${extension}`;
}

export function mapReportToExportData(report: ReportRow, now: Date = new Date()): ReportExportData {
  const issueCounts = new Map<string, number>();

  for (const issue of report.issues) {
    issueCounts.set(issue.type, (issueCounts.get(issue.type) ?? 0) + 1);
  }

  return {
    report: {
      id: report.id,
      fileName: report.fileName,
      status: report.status,
      uploadedAt: report.uploadedAt.toISOString(),
      analyzedAt: report.analyzedAt ? report.analyzedAt.toISOString() : null,
      analystEmail: report.userAccount?.email ?? null,
    },
    generatedAt: now.toISOString(),
    summary: {
      totalIssues: report.totalIssues,
      passedQC: report.passedQC,
      byType: Array.from(issueCounts.entries()).map(([type, count]) => ({
        type,
        label: formatIssueType(type),
        count,
      })),
    },
    issues: report.issues.map((issue) => ({
      id: issue.id,
      type: issue.type,
      typeLabel: formatIssueType(issue.type),
      ruleKey: issue.ruleKey,
      description: issue.description,
      location: issue.location,
      context: issue.context,
      suggestion: resolveIssueSuggestion(issue.type, issue.suggestion),
      pageNumber: issue.pageNumber,
      sectionName: issue.sectionName,
    })),
  };
}

async function getExportData(
  reportId: string,
  actor: ExportActor,
  repository: ReportExportRepository,
  now: Date,
): Promise<{ fileName: string; data: ReportExportData }> {
  const report = await repository.findAccessibleReport(reportId, actor);

  if (!report) {
    throw new ApiError(404, "not_found", "Report not found.");
  }

  if (report.status !== "COMPLETED" || !report.analyzedAt) {
    throw new ApiError(409, "report_not_ready", "QC results are not ready for export yet.");
  }

  return {
    fileName: report.fileName,
    data: mapReportToExportData(report, now),
  };
}

export async function exportReportAsCsv(
  reportId: string,
  actor: ExportActor,
  repository: ReportExportRepository = prismaReportExportRepository,
  now: Date = new Date(),
): Promise<{ fileName: string; contentType: string; buffer: Buffer }> {
  const { fileName, data } = await getExportData(reportId, actor, repository, now);

  return {
    fileName: buildExportFilename(fileName, reportId, "csv", now),
    contentType: "text/csv; charset=utf-8",
    buffer: Buffer.from(buildReportExportCsv(data), "utf-8"),
  };
}

export async function exportReportAsPdf(
  reportId: string,
  actor: ExportActor,
  repository: ReportExportRepository = prismaReportExportRepository,
  now: Date = new Date(),
): Promise<{ fileName: string; contentType: string; buffer: Buffer }> {
  const { fileName, data } = await getExportData(reportId, actor, repository, now);

  return {
    fileName: buildExportFilename(fileName, reportId, "pdf", now),
    contentType: "application/pdf",
    buffer: await buildReportExportPdf(data),
  };
}

const ADMIN_EXPORT_ACTOR: ExportActor = { userAccountId: 0, role: "ADMIN" };

/** Single CSV with one header row: completed reports in scope (all org or one team). */
export async function exportAllReportsAsAggregatedCsv(
  scope: TeamExportScope,
  now: Date = new Date(),
): Promise<{ fileName: string; contentType: string; buffer: Buffer }> {
  const reports = await prisma.report.findMany({
    where: completedReportWhere(scope),
    include: {
      userAccount: { select: { email: true } },
      issues: {
        orderBy: [{ pageNumber: "asc" }, { sectionName: "asc" }, { id: "asc" }],
      },
    },
  });

  const lines: string[] = [];
  let headerAdded = false;
  for (const r of reports) {
    const data = mapReportToExportData(r as ReportRow, now);
    const csv = buildReportExportCsv(data);
    const rows = csv.trim().split(/\r?\n/).filter((line) => line.length > 0);
    if (rows.length === 0) continue;
    if (!headerAdded) {
      lines.push(rows[0]);
      headerAdded = true;
    }
    if (rows.length > 1) {
      lines.push(...rows.slice(1));
    }
  }

  const body =
    lines.length > 0
      ? `${lines.join("\r\n")}\r\n`
      : "reportId,message\r\n,no-completed-reports-found\r\n";

  const stem = exportScopeFileStem(scope);
  return {
    fileName: `reports-export__${stem}__generated-${formatExportTimestamp(now)}.csv`,
    contentType: "text/csv; charset=utf-8",
    buffer: Buffer.from(body, "utf-8"),
  };
}

/** ZIP containing one CSV per report in scope. */
export async function exportAllReportsAsZip(
  scope: TeamExportScope,
  now: Date = new Date(),
): Promise<{ fileName: string; contentType: string; buffer: Buffer }> {
  const repo =
    scope.mode === "all" ? prismaReportExportRepository : createTeamScopedRepository(scope.teamId);

  const reports = await prisma.report.findMany({
    where: completedReportWhere(scope),
    select: { id: true },
  });

  const zip = new JSZip();
  for (const r of reports) {
    const exp = await exportReportAsCsv(r.id, ADMIN_EXPORT_ACTOR, repo, now);
    zip.file(exp.fileName, exp.buffer);
  }
  if (reports.length === 0) {
    zip.file("readme.txt", "No completed reports available for export.");
  }

  const buffer = Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));
  const stem = exportScopeFileStem(scope);

  return {
    fileName: `reports-export__${stem}__generated-${formatExportTimestamp(now)}.zip`,
    contentType: "application/zip",
    buffer,
  };
}
