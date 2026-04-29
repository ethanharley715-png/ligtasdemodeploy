import { IssueType } from "@prisma/client";
import { prisma } from "../db/prisma";
import { ApiError } from "../errors/apiError";
import {
  ISSUE_TYPE_LABELS,
  getAnalyticsIssueTypes,
  getAnalyticsKpis,
  getAnalyticsSectionDensity,
  getAnalyticsTrends,
  getConsultantQualitySignals,
  getRecurringIssueRate,
  parseAnalyticsFilters,
  type AnalyticsFilters,
  type AnalyticsIssueTypePoint,
  type AnalyticsKpis,
  type AnalyticsSectionDensityPoint,
  type AnalyticsTrendPoint,
  type ConsultantQualitySignal,
  type RecurringIssueRatePoint,
} from "./analyticsService";

export type WeeklyDigestRequest = {
  weekStart: string;
  consultantId?: string;
  issueType?: string;
};

export type WeeklyDigestParams = {
  weekStart: Date;
  weekEnd: Date;
  weekStartIso: string;
  weekEndIso: string;
  analyticsFilters: AnalyticsFilters;
  consultantId?: number;
  issueType?: IssueType;
};

export type WeeklyDigestData = {
  generatedAt: string;
  week: {
    start: string;
    end: string;
    label: string;
  };
  filters: {
    consultantId: number | null;
    consultantLabel: string | null;
    issueType: IssueType | null;
    issueTypeLabel: string | null;
  };
  summary: AnalyticsKpis & {
    recurringIssueRate: number;
    reportsWithRepeatedCategories: number;
  };
  dailyTrends: AnalyticsTrendPoint[];
  issueTypes: AnalyticsIssueTypePoint[];
  sectionDensity: AnalyticsSectionDensityPoint[];
  consultantSignals: ConsultantQualitySignal[];
  recurringIssueRateByDay: RecurringIssueRatePoint[];
};

type WeeklyDigestDependencies = {
  getAnalyticsKpis: typeof getAnalyticsKpis;
  getAnalyticsTrends: typeof getAnalyticsTrends;
  getAnalyticsIssueTypes: typeof getAnalyticsIssueTypes;
  getAnalyticsSectionDensity: typeof getAnalyticsSectionDensity;
  getRecurringIssueRate: typeof getRecurringIssueRate;
  getConsultantQualitySignals: typeof getConsultantQualitySignals;
  findConsultantEmail: (consultantId: number) => Promise<string | null>;
};

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const defaultDependencies: WeeklyDigestDependencies = {
  getAnalyticsKpis,
  getAnalyticsTrends,
  getAnalyticsIssueTypes,
  getAnalyticsSectionDensity,
  getRecurringIssueRate,
  getConsultantQualitySignals,
  async findConsultantEmail(consultantId) {
    const consultant = await prisma.userAccount.findUnique({
      where: { id: consultantId },
      select: { email: true },
    });

    return consultant?.email ?? null;
  },
};

function roundTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toFileSafeIsoTimestamp(date: Date): string {
  return date
    .toISOString()
    .replace(/:/g, "-")
    .replace(/\.\d{3}Z$/, "Z");
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

function endOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

function parseWeekStart(value: string): Date {
  const trimmed = value.trim();

  if (!DATE_ONLY_REGEX.test(trimmed)) {
    throw new ApiError(400, "invalid_request", "weekStart must be a valid YYYY-MM-DD date.");
  }

  const parsed = new Date(`${trimmed}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) {
    throw new ApiError(400, "invalid_request", "weekStart must be a valid YYYY-MM-DD date.");
  }

  return parsed;
}

function normalizeToWeekWindow(date: Date): { weekStart: Date; weekEnd: Date } {
  const normalized = startOfUtcDay(date);
  const day = normalized.getUTCDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;
  const weekStart = startOfUtcDay(
    new Date(Date.UTC(normalized.getUTCFullYear(), normalized.getUTCMonth(), normalized.getUTCDate() - daysFromMonday)),
  );
  const weekEnd = endOfUtcDay(
    new Date(Date.UTC(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate() + 6)),
  );

  return { weekStart, weekEnd };
}

function formatWeekLabel(weekStart: Date, weekEnd: Date): string {
  return `${toIsoDate(weekStart)} to ${toIsoDate(weekEnd)}`;
}

export function getLastCompletedWeekStart(now: Date = new Date()): string {
  const currentDay = startOfUtcDay(now);
  const day = currentDay.getUTCDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;
  const currentWeekStart = startOfUtcDay(
    new Date(Date.UTC(currentDay.getUTCFullYear(), currentDay.getUTCMonth(), currentDay.getUTCDate() - daysFromMonday)),
  );

  const previousWeekStart = startOfUtcDay(
    new Date(
      Date.UTC(currentWeekStart.getUTCFullYear(), currentWeekStart.getUTCMonth(), currentWeekStart.getUTCDate() - 7),
    ),
  );

  return toIsoDate(previousWeekStart);
}

export function parseWeeklyDigestParams(input: WeeklyDigestRequest): WeeklyDigestParams {
  if (!input.weekStart || input.weekStart.trim() === "") {
    throw new ApiError(400, "invalid_request", "weekStart is required.");
  }

  const parsedWeekStart = parseWeekStart(input.weekStart);
  const { weekStart, weekEnd } = normalizeToWeekWindow(parsedWeekStart);
  const analyticsFilters = parseAnalyticsFilters({
    dateFrom: toIsoDate(weekStart),
    dateTo: toIsoDate(weekEnd),
    ...(input.consultantId ? { consultantId: input.consultantId } : {}),
    ...(input.issueType ? { issueType: input.issueType } : {}),
  });

  return {
    weekStart,
    weekEnd,
    weekStartIso: toIsoDate(weekStart),
    weekEndIso: toIsoDate(weekEnd),
    analyticsFilters,
    ...(analyticsFilters.consultantId ? { consultantId: analyticsFilters.consultantId } : {}),
    ...(analyticsFilters.issueType ? { issueType: analyticsFilters.issueType } : {}),
  };
}

function summarizeRecurringIssueRate(points: RecurringIssueRatePoint[]): {
  reportsWithRepeatedCategories: number;
  recurringIssueRate: number;
} {
  const reportsWithRepeatedCategories = points.reduce(
    (total, point) => total + point.reportsWithRepeatedCategories,
    0,
  );
  const totalAnalyses = points.reduce((total, point) => total + point.analyses, 0);

  return {
    reportsWithRepeatedCategories,
    recurringIssueRate:
      totalAnalyses > 0 ? roundTwo((reportsWithRepeatedCategories / totalAnalyses) * 100) : 0,
  };
}

export function buildWeeklyDigestFilename(
  params: Pick<WeeklyDigestParams, "weekStartIso" | "weekEndIso" | "consultantId" | "issueType">,
  extension: "csv" | "pdf",
  now: Date = new Date(),
): string {
  const tokens = [`qc-weekly-digest__${params.weekStartIso}__to__${params.weekEndIso}`];

  if (params.consultantId) {
    tokens.push(`consultant-${params.consultantId}`);
  }

  if (params.issueType) {
    tokens.push(params.issueType.toLowerCase());
  }

  tokens.push(`generated-${toFileSafeIsoTimestamp(now)}`);

  return `${tokens.join("__")}.${extension}`;
}

export async function buildWeeklyDigestData(
  params: WeeklyDigestParams,
  dependencies: WeeklyDigestDependencies = defaultDependencies,
  now: Date = new Date(),
): Promise<WeeklyDigestData> {
  const [
    kpis,
    trends,
    issueTypes,
    sectionDensity,
    recurringIssueRateByDay,
    consultantSignals,
    consultantLabel,
  ] = await Promise.all([
    dependencies.getAnalyticsKpis(params.analyticsFilters),
    dependencies.getAnalyticsTrends(params.analyticsFilters),
    dependencies.getAnalyticsIssueTypes(params.analyticsFilters),
    dependencies.getAnalyticsSectionDensity(params.analyticsFilters),
    dependencies.getRecurringIssueRate(params.analyticsFilters),
    dependencies.getConsultantQualitySignals(params.analyticsFilters),
    params.consultantId ? dependencies.findConsultantEmail(params.consultantId) : Promise.resolve(null),
  ]);

  const recurringSummary = summarizeRecurringIssueRate(recurringIssueRateByDay);

  return {
    generatedAt: now.toISOString(),
    week: {
      start: params.weekStartIso,
      end: params.weekEndIso,
      label: formatWeekLabel(params.weekStart, params.weekEnd),
    },
    filters: {
      consultantId: params.consultantId ?? null,
      consultantLabel,
      issueType: params.issueType ?? null,
      issueTypeLabel: params.issueType ? ISSUE_TYPE_LABELS[params.issueType] : null,
    },
    summary: {
      ...kpis,
      recurringIssueRate: recurringSummary.recurringIssueRate,
      reportsWithRepeatedCategories: recurringSummary.reportsWithRepeatedCategories,
    },
    dailyTrends: trends,
    issueTypes,
    sectionDensity,
    consultantSignals,
    recurringIssueRateByDay,
  };
}
