import { IssueType, Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { ApiError } from "../errors/apiError";
import {
  ISSUE_TYPE_LABELS,
  addBucket,
  bucketStart,
  formatBucketLabel,
  getBucketSize,
  parseAnalyticsFilters,
  roundTwo,
  type AnalyticsFilters,
} from "./analyticsService";

export type TeamAnalyticsFilters = AnalyticsFilters & {
  teamId?: string;
};

export type TeamAnalyticsViewer = {
  userId: number;
  role: string;
};

export type TeamAnalyticsKpis = {
  totalReportsAnalysed: number;
  totalIssuesFound: number;
  averageIssuesPerReport: number;
  passRate: number;
  failedQcRate: number;
  criticalIssuesCount: number;
};

export type TeamAnalyticsIssueTypePoint = {
  issueType: IssueType;
  label: string;
  count: number;
};

export type TeamAnalyticsTrendPoint = {
  label: string;
  reports: number;
  issues: number;
};

export type TeamPerformanceRow = {
  teamId: string;
  teamName: string;
  reportsAnalysed: number;
  averageIssuesPerReport: number;
  reportsWithIssuesPercentage: number;
  mostFrequentIssueCategory: string | null;
};

export type ConsultantPerformanceRow = {
  consultantId: number;
  consultantName: string;
  consultantEmail: string;
  reportsAnalysed: number;
  averageIssuesPerReport: number;
  reportsWithIssuesPercentage: number;
  passRate: number;
  mostFrequentIssueCategory: string | null;
};

type ScopedTeamAnalyticsFilters = TeamAnalyticsFilters & {
  teamId?: string;
};

type ReportAnalyticsRow = {
  id: string;
  totalIssues: number;
  criticalIssues: number;
  passedQC: boolean;
  analyzedAt: Date | null;
  userAccountId: number | null;
  issues: Array<{ type: IssueType }>;
  userAccount: {
    id: number;
    name: string | null;
    email: string;
    teamId: string | null;
    team: { id: string; name: string } | null;
  } | null;
};

function normalizeTeamId(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized === "" ? undefined : normalized;
}

export function parseTeamAnalyticsFilters(
  query: Record<string, unknown>,
  now: Date = new Date(),
): TeamAnalyticsFilters {
  const base = parseAnalyticsFilters(query, now);
  const teamId = normalizeTeamId(query.teamId);

  return {
    ...base,
    ...(teamId ? { teamId } : {}),
  };
}

async function getManagedTeamId(userId: number): Promise<string> {
  const team = await prisma.team.findFirst({
    where: { managerUserId: userId },
    select: { id: true },
  });

  if (!team) {
    throw new ApiError(403, "unauthorized", "You are not assigned to manage a team.");
  }

  return team.id;
}

async function ensureTeamExists(teamId: string): Promise<void> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true },
  });

  if (!team) {
    throw new ApiError(404, "not_found", "Team not found.");
  }
}

async function ensureConsultantInTeam(consultantId: number, teamId: string): Promise<void> {
  const consultant = await prisma.userAccount.findUnique({
    where: { id: consultantId },
    select: { id: true, teamId: true, user_type: true },
  });

  if (!consultant) {
    throw new ApiError(404, "not_found", "Consultant not found.");
  }

  if (consultant.user_type !== "usr") {
    throw new ApiError(400, "invalid_request", "consultantId must belong to a consultant.");
  }

  if (consultant.teamId !== teamId) {
    throw new ApiError(400, "invalid_request", "consultantId must belong to the selected team.");
  }
}

async function resolveScopedFilters(
  viewer: TeamAnalyticsViewer,
  filters: TeamAnalyticsFilters,
): Promise<ScopedTeamAnalyticsFilters> {
  // Centralize role scoping so every team analytics endpoint applies the same permission rules.
  if (viewer.role !== "ADMIN" && viewer.role !== "TEAM_MANAGER") {
    throw new ApiError(403, "unauthorized", "Admin or Team Manager access required.");
  }

  if (viewer.role === "ADMIN") {
    if (filters.teamId) {
      await ensureTeamExists(filters.teamId);
      if (filters.consultantId) {
        await ensureConsultantInTeam(filters.consultantId, filters.teamId);
      }
      return filters;
    }

    if (filters.consultantId) {
      throw new ApiError(400, "invalid_request", "consultantId can only be used when teamId is provided.");
    }

    return filters;
  }

  const managedTeamId = await getManagedTeamId(viewer.userId);

  if (filters.teamId && filters.teamId !== managedTeamId) {
    throw new ApiError(403, "unauthorized", "Team managers can only view analytics for their own team.");
  }

  if (filters.consultantId) {
    await ensureConsultantInTeam(filters.consultantId, managedTeamId);
  }

  return {
    ...filters,
    teamId: managedTeamId,
  };
}

function buildScopedReportWhere(filters: ScopedTeamAnalyticsFilters): Prisma.ReportWhereInput {
  return {
    status: "COMPLETED",
    analyzedAt: {
      gte: filters.dateFrom,
      lte: filters.dateTo,
    },
    ...(filters.consultantId ? { userAccountId: filters.consultantId } : {}),
    userAccount: {
      is: {
        ...(filters.teamId ? { teamId: filters.teamId } : { teamId: { not: null } }),
      },
    },
    ...(filters.issueType
      ? {
          issues: {
            some: { type: filters.issueType },
          },
        }
      : {}),
  };
}

async function loadScopedReports(filters: ScopedTeamAnalyticsFilters): Promise<ReportAnalyticsRow[]> {
  return prisma.report.findMany({
    where: buildScopedReportWhere(filters),
    orderBy: { analyzedAt: "asc" },
    select: {
      id: true,
      totalIssues: true,
      criticalIssues: true,
      passedQC: true,
      analyzedAt: true,
      userAccountId: true,
      issues: {
        where: filters.issueType ? { type: filters.issueType } : undefined,
        select: { type: true },
      },
      userAccount: {
        select: {
          id: true,
          name: true,
          email: true,
          teamId: true,
          team: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  }) as Promise<ReportAnalyticsRow[]>;
}

function getIssueCount(report: ReportAnalyticsRow, issueType?: IssueType): number {
  return issueType ? report.issues.length : report.totalIssues;
}

function getMostFrequentCategoryLabel(categoryCounts: Map<IssueType, number>): string | null {
  const top = Array.from(categoryCounts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return top ? ISSUE_TYPE_LABELS[top[0]] : null;
}

function buildSeededTrendMap(filters: ScopedTeamAnalyticsFilters): Map<string, TeamAnalyticsTrendPoint> {
  const bucketSize = getBucketSize(filters);
  const seeded = new Map<string, TeamAnalyticsTrendPoint>();
  let cursor = bucketStart(filters.dateFrom, bucketSize);
  const finalBucket = bucketStart(filters.dateTo, bucketSize);

  // Seed empty buckets so charts keep a stable time axis even when no reports exist for a period.
  while (cursor <= finalBucket) {
    const key = cursor.toISOString();
    seeded.set(key, {
      label: formatBucketLabel(cursor, bucketSize),
      reports: 0,
      issues: 0,
    });
    cursor = addBucket(cursor, bucketSize);
  }

  return seeded;
}

export async function getTeamAnalyticsKpis(
  viewer: TeamAnalyticsViewer,
  filters: TeamAnalyticsFilters,
): Promise<TeamAnalyticsKpis> {
  const scopedFilters = await resolveScopedFilters(viewer, filters);
  const reports = await loadScopedReports(scopedFilters);
  const totalReportsAnalysed = reports.length;
  const totalIssuesFound = reports.reduce(
    (sum, report) => sum + getIssueCount(report, scopedFilters.issueType),
    0,
  );
  const failedReports = reports.filter((report) => !report.passedQC).length;
  const passedReports = totalReportsAnalysed - failedReports;

  return {
    totalReportsAnalysed,
    totalIssuesFound,
    averageIssuesPerReport:
      totalReportsAnalysed > 0 ? roundTwo(totalIssuesFound / totalReportsAnalysed) : 0,
    passRate: totalReportsAnalysed > 0 ? roundTwo((passedReports / totalReportsAnalysed) * 100) : 0,
    failedQcRate: totalReportsAnalysed > 0 ? roundTwo((failedReports / totalReportsAnalysed) * 100) : 0,
    criticalIssuesCount: reports.reduce((sum, report) => sum + report.criticalIssues, 0),
  };
}

export async function getTeamAnalyticsIssueTypes(
  viewer: TeamAnalyticsViewer,
  filters: TeamAnalyticsFilters,
): Promise<TeamAnalyticsIssueTypePoint[]> {
  const scopedFilters = await resolveScopedFilters(viewer, filters);
  const reports = await loadScopedReports(scopedFilters);
  const counts = new Map<IssueType, number>();

  for (const report of reports) {
    for (const issue of report.issues) {
      counts.set(issue.type, (counts.get(issue.type) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([issueType, count]) => ({
      issueType,
      label: ISSUE_TYPE_LABELS[issueType],
      count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export async function getTeamAnalyticsTrends(
  viewer: TeamAnalyticsViewer,
  filters: TeamAnalyticsFilters,
): Promise<TeamAnalyticsTrendPoint[]> {
  const scopedFilters = await resolveScopedFilters(viewer, filters);
  const reports = await loadScopedReports(scopedFilters);
  const bucketSize = getBucketSize(scopedFilters);
  const seeded = buildSeededTrendMap(scopedFilters);

  for (const report of reports) {
    if (!report.analyzedAt) {
      continue;
    }

    const key = bucketStart(report.analyzedAt, bucketSize).toISOString();
    const bucket = seeded.get(key);
    if (!bucket) {
      continue;
    }

    bucket.reports += 1;
    bucket.issues += getIssueCount(report, scopedFilters.issueType);
  }

  return Array.from(seeded.values());
}

export async function getTeamPerformance(
  viewer: TeamAnalyticsViewer,
  filters: TeamAnalyticsFilters,
): Promise<TeamPerformanceRow[]> {
  const scopedFilters = await resolveScopedFilters(viewer, filters);
  const [reports, teams] = await Promise.all([
    loadScopedReports(scopedFilters),
    prisma.team.findMany({
      where: scopedFilters.teamId ? { id: scopedFilters.teamId } : undefined,
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const byTeam = new Map(
    teams.map((team) => [
      team.id,
      {
        teamName: team.name,
        reportsAnalysed: 0,
        reportsWithIssues: 0,
        totalIssues: 0,
        categoryCounts: new Map<IssueType, number>(),
      },
    ]),
  );

  for (const report of reports) {
    const team = report.userAccount?.team;
    if (!team) {
      continue;
    }

    const current = byTeam.get(team.id);
    if (!current) {
      continue;
    }

    const issueCount = getIssueCount(report, scopedFilters.issueType);
    current.reportsAnalysed += 1;
    current.totalIssues += issueCount;
    if (issueCount > 0) {
      current.reportsWithIssues += 1;
    }

    for (const issue of report.issues) {
      current.categoryCounts.set(issue.type, (current.categoryCounts.get(issue.type) ?? 0) + 1);
    }
  }

  return Array.from(byTeam.entries())
    .map(([teamId, entry]) => ({
      teamId,
      teamName: entry.teamName,
      reportsAnalysed: entry.reportsAnalysed,
      averageIssuesPerReport:
        entry.reportsAnalysed > 0 ? roundTwo(entry.totalIssues / entry.reportsAnalysed) : 0,
      reportsWithIssuesPercentage:
        entry.reportsAnalysed > 0 ? roundTwo((entry.reportsWithIssues / entry.reportsAnalysed) * 100) : 0,
      mostFrequentIssueCategory: getMostFrequentCategoryLabel(entry.categoryCounts),
    }))
    .sort((a, b) => b.reportsAnalysed - a.reportsAnalysed || a.teamName.localeCompare(b.teamName));
}

export async function getConsultantPerformance(
  viewer: TeamAnalyticsViewer,
  filters: TeamAnalyticsFilters,
): Promise<ConsultantPerformanceRow[]> {
  const scopedFilters = await resolveScopedFilters(viewer, filters);

  if (!scopedFilters.teamId) {
    throw new ApiError(400, "invalid_request", "consultant performance requires a team scope.");
  }

  const reports = await loadScopedReports(scopedFilters);
  const byConsultant = new Map<
    number,
    {
      consultantName: string;
      consultantEmail: string;
      reportsAnalysed: number;
      passedQcCount: number;
      reportsWithIssues: number;
      totalIssues: number;
      categoryCounts: Map<IssueType, number>;
    }
  >();

  for (const report of reports) {
    if (!report.userAccountId || !report.userAccount) {
      continue;
    }

    const issueCount = getIssueCount(report, scopedFilters.issueType);
    const current = byConsultant.get(report.userAccountId) ?? {
      consultantName: report.userAccount.name ?? report.userAccount.email,
      consultantEmail: report.userAccount.email,
      reportsAnalysed: 0,
      passedQcCount: 0,
      reportsWithIssues: 0,
      totalIssues: 0,
      categoryCounts: new Map<IssueType, number>(),
    };

    current.reportsAnalysed += 1;
    if (report.passedQC) {
      current.passedQcCount += 1;
    }
    current.totalIssues += issueCount;
    if (issueCount > 0) {
      current.reportsWithIssues += 1;
    }

    for (const issue of report.issues) {
      current.categoryCounts.set(issue.type, (current.categoryCounts.get(issue.type) ?? 0) + 1);
    }

    byConsultant.set(report.userAccountId, current);
  }

  return Array.from(byConsultant.entries())
    .map(([consultantId, entry]) => ({
      consultantId,
      consultantName: entry.consultantName,
      consultantEmail: entry.consultantEmail,
      reportsAnalysed: entry.reportsAnalysed,
      averageIssuesPerReport:
        entry.reportsAnalysed > 0 ? roundTwo(entry.totalIssues / entry.reportsAnalysed) : 0,
      reportsWithIssuesPercentage:
        entry.reportsAnalysed > 0 ? roundTwo((entry.reportsWithIssues / entry.reportsAnalysed) * 100) : 0,
      passRate:
        entry.reportsAnalysed > 0 ? roundTwo((entry.passedQcCount / entry.reportsAnalysed) * 100) : 0,
      mostFrequentIssueCategory: getMostFrequentCategoryLabel(entry.categoryCounts),
    }))
    .sort((a, b) => b.reportsAnalysed - a.reportsAnalysed || a.consultantEmail.localeCompare(b.consultantEmail));
}
