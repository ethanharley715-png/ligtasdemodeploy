/**
 * Creates a ranked leaderboard that is based on user report quality.
 * 
 * The scoring logic: 
 * . Lower average issues per reports results in a higher score.
 * . The score is normalised on a 0 - 100 scale.
 * 
 * The purpose of this is to encourage higher quality report submissions and provide measureable performance comparison 
 * between users.
 * 
 */

import { IssueType, Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { ApiError } from "../errors/apiError";

export type AnalyticsFilters = {
  dateFrom: Date;
  dateTo: Date;
  consultantId?: number;
  issueType?: IssueType;
};

export type AnalyticsKpis = {
  totalAnalyses: number;
  analysesWithIssuesPercentage: number;
  averageIssuesPerAnalysis: number;
  distinctIssueCategories: number;
  reportsThisMonth: number;
  reportsLastMonth: number;
  avgIssuesPerReport: number;
  avgIssuesLastMonth: number;
  passRate: number;
  passRateLastMonth: number;
  timeSaved: number;
};

export type AnalyticsTrendPoint = {
  label: string;
  analyses: number;
  issues: number;
  falsePositives: number;
};

export type AnalyticsIssueTypePoint = {
  issueType: IssueType;
  label: string;
  count: number;
};

export type AnalyticsSectionDensityPoint = {
  section: string;
  issueCount: number;
  issueDensity: number;
};

export type RecurringIssueRatePoint = {
  label: string;
  analyses: number;
  reportsWithRepeatedCategories: number;
  recurringIssueRate: number;
};

export type ConsultantQualitySignal = {
  consultantId: number;
  consultantEmail: string;
  analysesRun: number;
  withIssuesPercentage: number;
  averageIssuesPerReport: number;
  mostFrequentCategory: string | null;
};

type ReportTrendRow = {
  analyzedAt: Date | null;
  totalIssues: number;
  issues: Array<{ type: IssueType; reviewStatus: "OPEN" | "COMPLETED" | "FALSE_POSITIVE" }>;
};

type ConsultantReportRow = {
  userAccountId: number | null;
  totalIssues: number;
  issues: Array<{ type: IssueType }>;
  userAccount: { email: string } | null;
};

const SUPPORTED_TIME_RANGES = new Set(["7days", "30days", "3months", "6months", "1year"]);

export const ISSUE_TYPE_LABELS: Record<IssueType, string> = {
  TEMPLATE_ARTIFACT: "Template Artifact",
  UNREMOVED_GUIDANCE: "Unremoved Guidance",
  MISSING_INFORMATION: "Missing Information",
  CONTRADICTION: "Contradiction",
  LIMITATION_CONTRADICTION: "Limitation Contradiction",
  INCOMPLETE_LIMITATIONS: "Incomplete Limitations",
};

const MAIN_SECTION_BUCKETS = [
  { number: 1, label: "1. Summary", aliases: ["summary"] },
  { number: 2, label: "2. Competent Persons", aliases: ["competent persons"] },
  { number: 3, label: "3. Introduction", aliases: ["introduction"] },
  {
    number: 4,
    label: "4. Terms and Definitions",
    aliases: [
      "terms and definitions",
      "fire safety order",
      "fire safety arrangements",
      "standards/approved codes of practices and european norms",
    ],
  },
  {
    number: 5,
    label: "5. Premises Details",
    aliases: [
      "premises details",
      "on-site contacts",
      "clients nominated responsible person(s) for fire safety",
      "location of premises",
      "owner",
      "managing agent",
      "description of undertakings",
      "construction details",
      "building classification",
      "fire evacuation policy",
      "utilities",
      "usage",
      "enforcement",
      "employed staff on site",
      "persons at risk",
    ],
  },
  { number: 6, label: "6. Limitations of Report", aliases: ["limitations of report"] },
  { number: 7, label: "7. Resume of the brief", aliases: ["resume of the brief"] },
  {
    number: 8,
    label: "8. Fire Risk Assessment",
    aliases: [
      "fire risk assessment",
      "risk assessment findings",
      "high risk action(s) requiring immediate attention",
    ],
  },
  {
    number: 9,
    label: "9. Risk Assessment and Action Plan",
    aliases: [
      "risk assessment and action plan",
      "fire safety management",
      "site security",
      "electrical matters",
      "deliberate or malicious ignition",
      "training (fire)",
      "fire protection systems - fire alarm",
      "compartmentation",
      "fire extinguishers",
      "hose reels",
      "smoke control systems",
      "dry/wet riser",
      "sprinkler system",
      "gaseous suppression systems",
      "fire hydrants",
      "emergency procedures",
      "means of escape",
      "emergency lighting",
      "highly flammable liquids",
      "liquefied petroleum gas",
      "general fire safety",
      "grainger plc - fire safety management",
      "completion notes",
    ],
  },
  { number: 10, label: "10. Tenant(s) Monitoring", aliases: ["tenant(s) monitoring", "ground floor shop unit"] },
] as const;

const MAIN_SECTION_LABEL_BY_NUMBER = new Map(
  MAIN_SECTION_BUCKETS.map((bucket) => [String(bucket.number), bucket.label]),
);

const MAIN_SECTION_LABEL_BY_ALIAS = new Map(
  MAIN_SECTION_BUCKETS.flatMap((bucket) =>
    bucket.aliases.map((alias) => [alias.toLowerCase(), bucket.label] as const),
  ),
);

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function parseDateInput(value: unknown, fieldName: "dateFrom" | "dateTo"): Date | undefined {
  if (typeof value !== "string" || value.trim() === "") {
    return undefined;
  }

  const s = value.trim();
  if (DATE_ONLY_REGEX.test(s)) {
    const utcMidnight = fieldName === "dateFrom" ? `${s}T00:00:00.000Z` : `${s}T23:59:59.999Z`;
    const parsed = new Date(utcMidnight);
    if (Number.isNaN(parsed.getTime())) {
      throw new ApiError(400, "invalid_request", `${fieldName} must be a valid date.`);
    }
    return parsed;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ApiError(400, "invalid_request", `${fieldName} must be a valid date.`);
  }

  return fieldName === "dateFrom" ? startOfDay(parsed) : endOfDay(parsed);
}

function dateRangeFromTimeRange(timeRange?: string): { dateFrom: Date; dateTo: Date } {
  const today = new Date();
  const dateTo = endOfDay(today);
  const dateFrom = startOfDay(today);

  switch (timeRange) {
    case "7days":
      dateFrom.setDate(dateFrom.getDate() - 6);
      break;
    case "30days":
      dateFrom.setDate(dateFrom.getDate() - 29);
      break;
    case "3months":
      dateFrom.setMonth(dateFrom.getMonth() - 3);
      break;
    case "1year":
      dateFrom.setFullYear(dateFrom.getFullYear() - 1);
      break;
    case "6months":
    default:
      dateFrom.setMonth(dateFrom.getMonth() - 6);
      break;
  }

  return { dateFrom, dateTo };
}

export function parseAnalyticsFilters(
  query: Record<string, unknown>,
  now: Date = new Date(),
): AnalyticsFilters {
  const fromQuery = parseDateInput(query.dateFrom, "dateFrom");
  const toQuery = parseDateInput(query.dateTo, "dateTo");
  const timeRange =
    typeof query.timeRange === "string" && SUPPORTED_TIME_RANGES.has(query.timeRange)
      ? query.timeRange
      : "30days";

  let { dateFrom, dateTo } = dateRangeFromTimeRange(timeRange);
  dateFrom = fromQuery ?? dateFrom;
  dateTo = toQuery ?? dateTo;

  if (dateFrom > dateTo) {
    throw new ApiError(400, "invalid_request", "dateFrom must be earlier than or equal to dateTo.");
  }

  // Stabilise relative defaults for tests and predictable reporting.
  if (!fromQuery && !toQuery) {
    const nowEnd = endOfDay(now);
    const nowStart = startOfDay(now);
    dateTo = nowEnd;
    dateFrom = startOfDay(nowStart);
    switch (timeRange) {
      case "7days":
        dateFrom.setDate(dateFrom.getDate() - 6);
        break;
      case "30days":
        dateFrom.setDate(dateFrom.getDate() - 29);
        break;
      case "3months":
        dateFrom.setMonth(dateFrom.getMonth() - 3);
        break;
      case "1year":
        dateFrom.setFullYear(dateFrom.getFullYear() - 1);
        break;
      case "6months":
      default:
        dateFrom.setMonth(dateFrom.getMonth() - 6);
        break;
    }
  }

  let consultantId: number | undefined;
  if (typeof query.consultantId === "string" && query.consultantId.trim() !== "") {
    consultantId = Number(query.consultantId);
    if (!Number.isInteger(consultantId) || consultantId <= 0) {
      throw new ApiError(400, "invalid_request", "consultantId must be a positive integer.");
    }
  }

  let issueType: IssueType | undefined;
  if (typeof query.issueType === "string" && query.issueType.trim() !== "") {
    if (!Object.values(IssueType).includes(query.issueType as IssueType)) {
      throw new ApiError(400, "invalid_request", "issueType must be a valid issue category.");
    }
    issueType = query.issueType as IssueType;
  }

  return {
    dateFrom,
    dateTo,
    ...(consultantId ? { consultantId } : {}),
    ...(issueType ? { issueType } : {}),
  };
}

export function roundTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeAnalyticsSectionName(sectionName: string | null): string {
  const normalized = (sectionName ?? "")
    .replace(/^#+\s*SECTION\s+\d+\s*:\s*/i, "")
    .replace(/^SECTION\s+\d+\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized || /^multiple sections analysis$/i.test(normalized)) {
    return "Unknown";
  }

  return normalized;
}

function toAnalyticsMainSection(sectionName: string | null): string | null {
  const normalized = normalizeAnalyticsSectionName(sectionName);
  if (normalized === "Unknown" || /^ambiguous$/i.test(normalized)) {
    return null;
  }

  const numberedMatch = normalized.match(/^(\d+)(?:\.\d+)*\b/);
  if (numberedMatch) {
    return MAIN_SECTION_LABEL_BY_NUMBER.get(numberedMatch[1]) ?? null;
  }

  const sectionMatch = normalized.match(/^section\s+(\d+)\b/i);
  if (sectionMatch) {
    return MAIN_SECTION_LABEL_BY_NUMBER.get(sectionMatch[1]) ?? null;
  }

  return MAIN_SECTION_LABEL_BY_ALIAS.get(normalized.toLowerCase()) ?? null;
}

export function addBucket(date: Date, size: "day" | "week" | "month"): Date {
  const next = new Date(date);
  if (size === "day") {
    next.setDate(next.getDate() + 1);
    return next;
  }
  if (size === "week") {
    next.setDate(next.getDate() + 7);
    return next;
  }
  next.setMonth(next.getMonth() + 1);
  return next;
}

export function bucketStart(date: Date, size: "day" | "week" | "month"): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  if (size === "week") {
    const day = next.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    next.setDate(next.getDate() + diff);
  }
  if (size === "month") {
    next.setDate(1);
  }
  return next;
}

export function formatBucketLabel(date: Date, size: "day" | "week" | "month"): string {
  if (size === "day") {
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  }
  if (size === "week") {
    return `W/C ${date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}`;
  }
  return date.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

export function getBucketSize(filters: AnalyticsFilters): "day" | "week" | "month" {
  const durationDays = Math.ceil((filters.dateTo.getTime() - filters.dateFrom.getTime()) / 86400000);
  if (durationDays <= 45) {
    return "day";
  }
  if (durationDays <= 210) {
    return "week";
  }
  return "month";
}

function buildBaseReportWhere(filters: AnalyticsFilters): Prisma.ReportWhereInput {
  return {
    status: "COMPLETED",
    analyzedAt: {
      gte: filters.dateFrom,
      lte: filters.dateTo,
    },
    ...(filters.consultantId ? { userAccountId: filters.consultantId } : {}),
  };
}

function buildIssueWhere(filters: AnalyticsFilters): Prisma.IssueWhereInput {
  return {
    report: buildBaseReportWhere(filters),
    ...(filters.issueType ? { type: filters.issueType } : {}),
  };
}

function buildReportIssueFilter(filters: AnalyticsFilters): Prisma.ReportWhereInput {
  const baseWhere = buildBaseReportWhere(filters);
  if (!filters.issueType) {
    return baseWhere;
  }

  return {
    ...baseWhere,
    issues: {
      some: {
        type: filters.issueType,
      },
    },
  };
}

export async function getAnalyticsKpis(filters: AnalyticsFilters): Promise<AnalyticsKpis> {
  const baseReportWhere = buildBaseReportWhere(filters);
  const reportIssueFilter = buildReportIssueFilter(filters);
  const issueWhere = buildIssueWhere(filters);

  const periodLength = filters.dateTo.getTime() - filters.dateFrom.getTime();
  const previousDateTo = new Date(filters.dateFrom.getTime() - 1);
  const previousDateFrom = new Date(previousDateTo.getTime() - periodLength);

  const previousBaseFilters: AnalyticsFilters = {
    dateFrom: previousDateFrom,
    dateTo: previousDateTo,
    ...(filters.consultantId ? { consultantId: filters.consultantId } : {}),
    ...(filters.issueType ? { issueType: filters.issueType } : {}),
  };

  const previousBaseReportWhere = buildBaseReportWhere(previousBaseFilters);
  const previousReportIssueFilter = buildReportIssueFilter(previousBaseFilters);

  const [
    totalAnalyses,
    totalAnalysesPrevious,
    reportsWithIssues,
    reportsWithIssuesPrevious,
    avgIssuesAggregate,
    avgIssuesAggregatePrevious,
    distinctIssueGroups,
  ] = await Promise.all([
    prisma.report.count({ where: baseReportWhere }),
    prisma.report.count({ where: previousBaseReportWhere }),
    filters.issueType
      ? prisma.report.count({ where: reportIssueFilter })
      : prisma.report.count({
          where: {
            ...baseReportWhere,
            totalIssues: { gt: 0 },
          },
        }),
    filters.issueType
      ? prisma.report.count({ where: previousReportIssueFilter })
      : prisma.report.count({
          where: {
            ...previousBaseReportWhere,
            totalIssues: { gt: 0 },
          },
        }),
    filters.issueType
      ? prisma.issue.count({ where: issueWhere })
      : prisma.report.aggregate({
          where: baseReportWhere,
          _avg: { totalIssues: true },
        }),
    filters.issueType
      ? prisma.issue.count({ where: buildIssueWhere(previousBaseFilters) })
      : prisma.report.aggregate({
          where: previousBaseReportWhere,
          _avg: { totalIssues: true },
        }),
    prisma.issue.groupBy({
      by: ["type"],
      where: issueWhere,
    }),
  ]);

  const analysesWithIssuesPercentage =
    totalAnalyses > 0 ? roundTwo((reportsWithIssues / totalAnalyses) * 100) : 0;
  const passRate =
    totalAnalyses > 0 ? roundTwo(((totalAnalyses - reportsWithIssues) / totalAnalyses) * 100) : 0;
  const passRateLastMonth =
    totalAnalysesPrevious > 0
      ? roundTwo(((totalAnalysesPrevious - reportsWithIssuesPrevious) / totalAnalysesPrevious) * 100)
      : 0;

  const averageIssuesPerAnalysis = filters.issueType
    ? totalAnalyses > 0
      ? roundTwo((avgIssuesAggregate as number) / totalAnalyses)
      : 0
    : roundTwo((avgIssuesAggregate as Prisma.GetReportAggregateType<{ _avg: { totalIssues: true } }>)._avg.totalIssues ?? 0);

  const avgIssuesLastMonth = filters.issueType
    ? totalAnalysesPrevious > 0
      ? roundTwo((avgIssuesAggregatePrevious as number) / totalAnalysesPrevious)
      : 0
    : roundTwo(
        (
          avgIssuesAggregatePrevious as Prisma.GetReportAggregateType<{ _avg: { totalIssues: true } }>
        )._avg.totalIssues ?? 0,
      );

  return {
    totalAnalyses,
    analysesWithIssuesPercentage,
    averageIssuesPerAnalysis,
    distinctIssueCategories: distinctIssueGroups.length,
    reportsThisMonth: totalAnalyses,
    reportsLastMonth: totalAnalysesPrevious,
    avgIssuesPerReport: averageIssuesPerAnalysis,
    avgIssuesLastMonth,
    passRate,
    passRateLastMonth,
    timeSaved: totalAnalyses * 15,
  };
}

export async function getAnalyticsIssueTypes(
  filters: AnalyticsFilters,
): Promise<AnalyticsIssueTypePoint[]> {
  const groups = await prisma.issue.groupBy({
    by: ["type"],
    where: buildIssueWhere(filters),
    _count: { type: true },
    orderBy: { _count: { type: "desc" } },
  });

  return groups.map((group) => ({
    issueType: group.type,
    label: ISSUE_TYPE_LABELS[group.type],
    count: group._count.type,
  }));
}

export async function getAnalyticsTrends(
  filters: AnalyticsFilters,
): Promise<AnalyticsTrendPoint[]> {
  const bucketSize = getBucketSize(filters);
  const reports = await prisma.report.findMany({
    where: buildBaseReportWhere(filters),
    orderBy: { analyzedAt: "asc" },
    select: {
      analyzedAt: true,
      totalIssues: true,
      issues: {
        where: filters.issueType ? { type: filters.issueType } : undefined,
        select: { type: true, reviewStatus: true },
      },
    },
  });

  const seeded = new Map<string, AnalyticsTrendPoint>();
  let cursor = bucketStart(filters.dateFrom, bucketSize);
  const finalBucket = bucketStart(filters.dateTo, bucketSize);

  while (cursor <= finalBucket) {
    const key = cursor.toISOString();
    seeded.set(key, {
      label: formatBucketLabel(cursor, bucketSize),
      analyses: 0,
      issues: 0,
      falsePositives: 0,
    });
    cursor = addBucket(cursor, bucketSize);
  }

  for (const report of reports as ReportTrendRow[]) {
    if (!report.analyzedAt) {
      continue;
    }
    const key = bucketStart(report.analyzedAt, bucketSize).toISOString();
    const existing = seeded.get(key);
    if (!existing) {
      continue;
    }
    existing.analyses += 1;
    existing.issues += filters.issueType ? report.issues.length : report.totalIssues;
    existing.falsePositives += report.issues.filter((issue) => issue.reviewStatus === "FALSE_POSITIVE").length;
  }

  return Array.from(seeded.values());
}

export async function getAnalyticsSectionDensity(
  filters: AnalyticsFilters,
): Promise<AnalyticsSectionDensityPoint[]> {
  const [totalAnalyses, groups] = await Promise.all([
    prisma.report.count({ where: buildBaseReportWhere(filters) }),
    prisma.issue.groupBy({
      by: ["sectionName"],
      where: buildIssueWhere(filters),
      _count: { sectionName: true },
      orderBy: { _count: { sectionName: "desc" } },
    }),
  ]);

  const aggregated = new Map<string, number>(
    MAIN_SECTION_BUCKETS.map((bucket) => [bucket.label, 0]),
  );

  for (const group of groups) {
    const section = toAnalyticsMainSection(group.sectionName);
    if (!section) {
      continue;
    }

    aggregated.set(section, (aggregated.get(section) ?? 0) + group._count.sectionName);
  }

  return Array.from(aggregated.entries())
    .map(([section, issueCount]) => ({
      section,
      issueCount,
      issueDensity: totalAnalyses > 0 ? roundTwo(issueCount / totalAnalyses) : 0,
    }))
    .sort(
      (a, b) =>
        MAIN_SECTION_BUCKETS.findIndex((bucket) => bucket.label === a.section) -
        MAIN_SECTION_BUCKETS.findIndex((bucket) => bucket.label === b.section),
    );
}

function hasRepeatedCategories(types: IssueType[]): boolean {
  const counts = new Map<IssueType, number>();
  for (const type of types) {
    const next = (counts.get(type) ?? 0) + 1;
    if (next > 1) {
      return true;
    }
    counts.set(type, next);
  }
  return false;
}

export async function getRecurringIssueRate(
  filters: AnalyticsFilters,
): Promise<RecurringIssueRatePoint[]> {
  const bucketSize = getBucketSize(filters);
  const reports = await prisma.report.findMany({
    where: buildBaseReportWhere(filters),
    orderBy: { analyzedAt: "asc" },
    select: {
      analyzedAt: true,
      issues: {
        where: filters.issueType ? { type: filters.issueType } : undefined,
        select: { type: true },
      },
    },
  });

  const seeded = new Map<string, RecurringIssueRatePoint>();
  let cursor = bucketStart(filters.dateFrom, bucketSize);
  const finalBucket = bucketStart(filters.dateTo, bucketSize);

  while (cursor <= finalBucket) {
    const key = cursor.toISOString();
    seeded.set(key, {
      label: formatBucketLabel(cursor, bucketSize),
      analyses: 0,
      reportsWithRepeatedCategories: 0,
      recurringIssueRate: 0,
    });
    cursor = addBucket(cursor, bucketSize);
  }

  for (const report of reports as Array<{ analyzedAt: Date | null; issues: Array<{ type: IssueType }> }>) {
    if (!report.analyzedAt) {
      continue;
    }
    const key = bucketStart(report.analyzedAt, bucketSize).toISOString();
    const existing = seeded.get(key);
    if (!existing) {
      continue;
    }

    existing.analyses += 1;
    if (hasRepeatedCategories(report.issues.map((issue) => issue.type))) {
      existing.reportsWithRepeatedCategories += 1;
    }
  }

  return Array.from(seeded.values()).map((point) => ({
    ...point,
    recurringIssueRate:
      point.analyses > 0 ? roundTwo((point.reportsWithRepeatedCategories / point.analyses) * 100) : 0,
  }));
}

export const getUserLeaderboard = async () => {
  const reports = await prisma.report.findMany({
    where: {
      status: "COMPLETED",
      userAccountId: { not: null },
    },
    include: {
      issues: true,
    },
  });

  const userMap = new Map<number, {
    userId: number;
    totalReports: number;
    totalIssues: number;
  }>();

  for (const report of reports) {
    const userId = report.userAccountId!;

    if (!userMap.has(userId)) {
      userMap.set(userId, {
        userId,
        totalReports: 0,
        totalIssues: 0,
      });
    }

    const user = userMap.get(userId)!;
    user.totalReports += 1;
    user.totalIssues += report.issues.length;
  }

  const users = await prisma.userAccount.findMany({
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  const leaderboard = Array.from(userMap.values()).map((user) => {
    const userInfo = users.find((u) => u.id === user.userId);

    const averageIssues =
      user.totalReports > 0
        ? user.totalIssues / user.totalReports
        : 0;

    const score = Math.max(0, 100 - averageIssues * 2);

    return {
      userId: user.userId,
      name: userInfo?.name || userInfo?.email || `User ${user.userId}`,
      totalReports: user.totalReports,
      averageIssues: Number(averageIssues.toFixed(2)),
      score: Number(score.toFixed(1)),
    };
  });

  leaderboard.sort((a, b) => b.score - a.score); // By using sort it can rank users in a descending score to generate the leaderboard.

  return leaderboard;
};

export async function getConsultantQualitySignals(
  filters: AnalyticsFilters,
): Promise<ConsultantQualitySignal[]> {
  const reports = await prisma.report.findMany({
    where: buildBaseReportWhere(filters),
    select: {
      userAccountId: true,
      totalIssues: true,
      issues: {
        where: filters.issueType ? { type: filters.issueType } : undefined,
        select: { type: true },
      },
      userAccount: {
        select: {
          email: true,
        },
      },
    },
    orderBy: {
      analyzedAt: "desc",
    },
  });

  const byConsultant = new Map<
    number,
    {
      consultantEmail: string;
      analysesRun: number;
      reportsWithIssues: number;
      totalIssues: number;
      categoryCounts: Map<IssueType, number>;
    }
  >();

  for (const report of reports as ConsultantReportRow[]) {
    if (!report.userAccountId || !report.userAccount?.email) {
      continue;
    }

    const issueCount = filters.issueType ? report.issues.length : report.totalIssues;
    const current = byConsultant.get(report.userAccountId) ?? {
      consultantEmail: report.userAccount.email,
      analysesRun: 0,
      reportsWithIssues: 0,
      totalIssues: 0,
      categoryCounts: new Map<IssueType, number>(),
    };

    current.analysesRun += 1;
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
    .map(([consultantId, entry]) => {
      const mostFrequent = Array.from(entry.categoryCounts.entries()).sort((a, b) => b[1] - a[1])[0];

      return {
        consultantId,
        consultantEmail: entry.consultantEmail,
        analysesRun: entry.analysesRun,
        withIssuesPercentage:
          entry.analysesRun > 0 ? roundTwo((entry.reportsWithIssues / entry.analysesRun) * 100) : 0,
        averageIssuesPerReport:
          entry.analysesRun > 0 ? roundTwo(entry.totalIssues / entry.analysesRun) : 0,
        mostFrequentCategory: mostFrequent ? ISSUE_TYPE_LABELS[mostFrequent[0]] : null,
      };
    })
    .sort((a, b) => b.analysesRun - a.analysesRun || a.consultantEmail.localeCompare(b.consultantEmail));

    
}
