import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  Activity,
  AlertCircle,
  BarChart3,
  Calendar,
  FileText,
  Target,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { AdminUserProfileLink } from "../admin/AdminUserProfileLink";
import { Card } from "../ui/card";
import { WeeklyDigestDialog } from "../analytics/WeeklyDigestDialog";
import { IssueCategoryAxisTick } from "../analytics/IssueCategoryAxisTick";
import { LIGTAS_CHART } from "../../lib/chartTheme";
import {
  analyticsApi,
  usersApi,
  type AnalyticsQuery,
  type ConsultantQualitySignalItem,
  type IssueTypeItem,
  type KPIData,
  type RecurringIssueRateItem,
  type SectionDensityItem,
  type TrendItem,
  type UserListItem,
  type ReportExportFormat,
} from "../../services/api";
import { getLastCompletedWeekValue, weekValueToWeekStartIso } from "../../utils/weeklyDigestWeek";
import { useLanguage } from "../../context/useLanguage";

type DashboardData = {
  kpis: KPIData | null;
  trends: TrendItem[];
  issueTypes: IssueTypeItem[];
  sectionDensity: SectionDensityItem[];
  recurringIssueRate: RecurringIssueRateItem[];
  consultantSignals: ConsultantQualitySignalItem[];
};

type FilterState = {
  dateFrom: string;
  dateTo: string;
  consultantId: string;
  issueType: string;
};

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function defaultFilters(): FilterState {
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 29);

  return {
    dateFrom: toIsoDate(from),
    dateTo: toIsoDate(today),
    consultantId: "",
    issueType: "",
  };
}

function buildQuery(filters: FilterState): AnalyticsQuery {
  return {
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    ...(filters.consultantId ? { consultantId: filters.consultantId } : {}),
    ...(filters.issueType ? { issueType: filters.issueType } : {}),
  };
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[280px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function MetricCard({
  title,
  value,
  helper,
  icon: Icon,
}: {
  title: string;
  value: string;
  helper: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="ligtas-surface-card-sm rounded-xl p-6 shadow-sm">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
          <p className="mt-2 text-4xl font-bold text-foreground">{value}</p>
        </div>
        <div className="ligtas-icon-tile-lg">
          <Icon className="size-5 text-primary-foreground" />
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{helper}</p>
    </Card>
  );
}

export function AnalyticsView() {
  const { t } = useLanguage();

  const ISSUE_CATEGORY_OPTIONS = useMemo(
    () => [
      { value: "", label: t("allIssueCategories") },
      { value: "TEMPLATE_ARTIFACT", label: t("templateArtifact") },
      { value: "UNREMOVED_GUIDANCE", label: t("unremovedGuidance") },
      { value: "MISSING_INFORMATION", label: t("missingInformation") },
      { value: "CONTRADICTION", label: t("contradiction") },
      { value: "LIMITATION_CONTRADICTION", label: t("limitationContradiction") },
      { value: "INCOMPLETE_LIMITATIONS", label: t("incompleteLimitations") },
    ],
    [t],
  );

  const [filters, setFilters] = useState<FilterState>(() => defaultFilters());
  const [weeklyDigestOpen, setWeeklyDigestOpen] = useState(false);
  const [weeklyDigestDialogKey, setWeeklyDigestDialogKey] = useState(0);
  const [selectedDigestWeek, setSelectedDigestWeek] = useState(() => getLastCompletedWeekValue());
  const [loadingDigestFormat, setLoadingDigestFormat] = useState<ReportExportFormat | null>(null);
  const [data, setData] = useState<DashboardData>({
    kpis: null,
    trends: [],
    issueTypes: [],
    sectionDensity: [],
    recurringIssueRate: [],
    consultantSignals: [],
  });
  const [consultants, setConsultants] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterLoading, setFilterLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedOnceRef = useRef(false);

  const query = useMemo(() => buildQuery(filters), [filters]);

  const fetchDashboard = useCallback(
    async (currentQuery: AnalyticsQuery, isInitialLoad: boolean) => {
      if (isInitialLoad) {
        setLoading(true);
      } else {
        setFilterLoading(true);
      }
      setError(null);

      try {
        const [kpis, trends, issueTypes, sectionDensity, recurringIssueRate, consultantSignals] =
          await Promise.all([
            analyticsApi.kpis(currentQuery),
            analyticsApi.trends(currentQuery),
            analyticsApi.issueTypes(currentQuery),
            analyticsApi.sectionDensity(currentQuery),
            analyticsApi.recurringIssueRate(currentQuery),
            analyticsApi.consultantSignals(currentQuery),
          ]);

        setData({ kpis, trends, issueTypes, sectionDensity, recurringIssueRate, consultantSignals });
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : t("failedToLoadQcAnalytics"));
      } finally {
        setLoading(false);
        setFilterLoading(false);
        hasLoadedOnceRef.current = true;
      }
    },
    [t],
  );

  useEffect(() => {
    usersApi
      .list()
      .then((users) => {
        setConsultants(users.filter((user) => user.role === "Consultant"));
      })
      .catch(() => {
        setConsultants([]);
      });
  }, []);

  useEffect(() => {
    fetchDashboard(query, !hasLoadedOnceRef.current);
  }, [fetchDashboard, query]);

  const handleFilterChange =
    (field: keyof FilterState) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setFilters((current) => ({
        ...current,
        [field]: event.target.value,
      }));
    };

  const topSections = useMemo(() => data.sectionDensity, [data.sectionDensity]);
  const sectionChartHeight = useMemo(
    () => Math.max(320, topSections.length * 34),
    [topSections.length],
  );
  const noAnalyses = (data.kpis?.totalAnalyses ?? 0) === 0;
  const selectedWeekStart = useMemo(
    () => weekValueToWeekStartIso(selectedDigestWeek),
    [selectedDigestWeek],
  );
  const selectedConsultantLabel = useMemo(() => {
    const consultant = consultants.find((candidate) => candidate.id === filters.consultantId);
    return consultant?.email ?? t("allConsultants");
  }, [consultants, filters.consultantId, t]);
  const selectedIssueTypeLabel = useMemo(() => {
    const issueOption = ISSUE_CATEGORY_OPTIONS.find((option) => option.value === filters.issueType);
    return issueOption?.label ?? t("allIssueCategories");
  }, [ISSUE_CATEGORY_OPTIONS, filters.issueType, t]);

  async function handleDigestExport(format: ReportExportFormat) {
    if (!selectedWeekStart) {
      toast.error(t("weeklyDigestExportFailed"), {
        description: t("selectValidCalendarWeek"),
      });
      return;
    }

    try {
      setLoadingDigestFormat(format);
      const file = await analyticsApi.exportWeeklyDigest({
        format,
        weekStart: selectedWeekStart,
        ...(filters.consultantId ? { consultantId: filters.consultantId } : {}),
        ...(filters.issueType ? { issueType: filters.issueType } : {}),
      });

      const objectUrl = URL.createObjectURL(file.blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = file.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);

      toast.success(`${format.toUpperCase()} ${t("digestReadyLowercase")}`, {
        description: `${file.fileName} ${t("hasBeenGenerated")}`,
      });
      setWeeklyDigestOpen(false);
    } catch (exportError) {
      toast.error(t("weeklyDigestExportFailed"), {
        description:
          exportError instanceof Error ? exportError.message : t("unableToExportWeeklyDigest"),
      });
    } finally {
      setLoadingDigestFormat(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-background p-8">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
          <p className="text-base font-semibold text-muted-foreground">{t("loadingQcTrendDashboard")}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-full items-center justify-center bg-background p-8">
        <Card className="max-w-lg rounded-2xl border border-destructive/30 bg-card p-8 text-center text-card-foreground shadow-sm">
          <AlertCircle className="mx-auto mb-4 size-12 text-destructive" />
          <h2 className="mb-2 text-2xl font-bold text-foreground">{t("unableToLoadAnalytics")}</h2>
          <p className="mb-6 text-sm text-destructive">{error}</p>
          <button
            type="button"
            onClick={() => fetchDashboard(query, true)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            {t("retry")}
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background px-6 py-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {t("adminAnalytics")}
            </p>
            <h1 className="text-4xl font-bold text-foreground">{t("qcTrendDashboard")}</h1>
            <p className="mt-2 max-w-3xl text-base text-muted-foreground">
              {t("qcTrendDashboardDescription")}
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 lg:items-end">
            {filterLoading && <p className="text-sm font-semibold text-muted-foreground">{t("refreshingData")}</p>}
            <button
              type="button"
              onClick={() => {
                setWeeklyDigestDialogKey((current) => current + 1);
                setWeeklyDigestOpen(true);
              }}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              {t("weeklyDigest")}
            </button>
          </div>
        </div>

        <Card className="mb-8 ligtas-surface-card-sm rounded-xl p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="size-5 text-foreground" />
            <h2 className="text-lg font-bold text-foreground">{t("dashboardFilters")}</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-sm font-semibold text-foreground">
              <span className="mb-2 flex items-center gap-2">
                <Calendar className="size-4 text-muted-foreground" />
                {t("dateFrom")}
              </span>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={handleFilterChange("dateFrom")}
                className="ligtas-input w-full font-medium"
              />
            </label>
            <label className="text-sm font-semibold text-foreground">
              <span className="mb-2 flex items-center gap-2">
                <Calendar className="size-4 text-muted-foreground" />
                {t("dateTo")}
              </span>
              <input
                type="date"
                value={filters.dateTo}
                onChange={handleFilterChange("dateTo")}
                className="ligtas-input w-full font-medium"
              />
            </label>
            <label className="text-sm font-semibold text-foreground">
              <span className="mb-2 flex items-center gap-2">
                <Users className="size-4 text-muted-foreground" />
                {t("consultant")}
              </span>
              <select
                value={filters.consultantId}
                onChange={handleFilterChange("consultantId")}
                className="ligtas-input w-full font-medium"
              >
                <option value="">{t("allConsultants")}</option>
                {consultants.map((consultant) => (
                  <option key={consultant.id} value={consultant.id}>
                    {consultant.email}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-foreground">
              <span className="mb-2 flex items-center gap-2">
                <Target className="size-4 text-muted-foreground" />
                {t("issueCategory")}
              </span>
              <select
                value={filters.issueType}
                onChange={handleFilterChange("issueType")}
                className="ligtas-input w-full font-medium"
              >
                {ISSUE_CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </Card>

        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title={t("totalQcAnalysesRun")}
            value={String(data.kpis?.totalAnalyses ?? 0)}
            helper={t("completedAnalysesInSelectedRange")}
            icon={Activity}
          />
          <MetricCard
            title={t("analysesWithIssues")}
            value={`${(data.kpis?.analysesWithIssuesPercentage ?? 0).toFixed(1)}%`}
            helper={t("shareOfAnalysesWithIssues")}
            icon={Target}
          />
          <MetricCard
            title={t("averageIssuesPerAnalysis")}
            value={(data.kpis?.averageIssuesPerAnalysis ?? 0).toFixed(2)}
            helper={t("averageStoredQcIssues")}
            icon={FileText}
          />
          <MetricCard
            title={t("distinctIssueCategories")}
            value={String(data.kpis?.distinctIssueCategories ?? 0)}
            helper={t("uniqueIssueCategoriesFiltered")}
            icon={BarChart3}
          />
        </div>

        {noAnalyses && (
          <Card className="mb-8 ligtas-surface-card-sm rounded-xl p-5 text-sm text-muted-foreground shadow-sm">
            {t("noCompletedAnalysesForFilters")}
          </Card>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card className="ligtas-surface-card-sm rounded-xl p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-xl font-bold text-foreground">{t("qcAnalysesOverTime")}</h2>
              <p className="text-sm text-muted-foreground">
                {t("completedAnalysesGroupedByPeriod")}
              </p>
            </div>
            {data.trends.some((point) => point.analyses > 0) ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={data.trends}>
                  <CartesianGrid stroke={LIGTAS_CHART.gridStroke} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={LIGTAS_CHART.axisTick} />
                  <YAxis tick={LIGTAS_CHART.axisTick} allowDecimals={false} />
                  <Tooltip {...LIGTAS_CHART.tooltip} />
                  <Line
                    dataKey="analyses"
                    name={t("analyses")}
                    stroke={LIGTAS_CHART.linePrimary}
                    strokeWidth={3}
                    dot={{ r: 4, fill: LIGTAS_CHART.linePrimary }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message={t("noCompletedAnalysesInRange")} />
            )}
          </Card>

          <Card className="ligtas-surface-card-sm rounded-xl p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-xl font-bold text-foreground">{t("issuesDetectedOverTime")}</h2>
              <p className="text-sm text-muted-foreground">
                {t("issueTotalsAcrossReportingBuckets")}
              </p>
            </div>
            {data.trends.some((point) => point.issues > 0) ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={data.trends}>
                  <CartesianGrid stroke={LIGTAS_CHART.gridStroke} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={LIGTAS_CHART.axisTick} />
                  <YAxis tick={LIGTAS_CHART.axisTick} allowDecimals={false} />
                  <Tooltip {...LIGTAS_CHART.tooltip} />
                  <Line
                    dataKey="issues"
                    name={t("issues")}
                    stroke={LIGTAS_CHART.lineSecondary}
                    strokeWidth={3}
                    dot={{ r: 4, fill: LIGTAS_CHART.lineSecondary }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message={t("noIssuesDetectedForFilters")} />
            )}
          </Card>

          <Card className="ligtas-surface-card-sm rounded-xl p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-xl font-bold text-foreground">{t("currentFalsePositivesOverTime")}</h2>
              <p className="text-sm text-muted-foreground">
                {t("falsePositivesGroupedByPeriod")}
              </p>
            </div>
            {data.trends.some((point) => point.falsePositives > 0) ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={data.trends}>
                  <CartesianGrid stroke={LIGTAS_CHART.gridStroke} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={LIGTAS_CHART.axisTick} />
                  <YAxis tick={LIGTAS_CHART.axisTick} allowDecimals={false} />
                  <Tooltip {...LIGTAS_CHART.tooltip} />
                  <Line
                    dataKey="falsePositives"
                    name={t("falsePositives")}
                    stroke={LIGTAS_CHART.lineAccent}
                    strokeWidth={3}
                    dot={{ r: 4, fill: LIGTAS_CHART.lineAccent }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message={t("noFalsePositivesForFilters")} />
            )}
          </Card>

          <Card className="ligtas-surface-card-sm rounded-xl p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-xl font-bold text-foreground">{t("issueCategoryDistribution")}</h2>
              <p className="text-sm text-muted-foreground">
                {t("mostCommonIssueCategories")}
              </p>
            </div>
            {data.issueTypes.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.issueTypes} margin={{ top: 8, right: 8, left: 0, bottom: 20 }}>
                  <CartesianGrid stroke={LIGTAS_CHART.gridStroke} strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    interval={0}
                    height={54}
                    tick={<IssueCategoryAxisTick />}
                  />
                  <YAxis tick={LIGTAS_CHART.axisTick} allowDecimals={false} />
                  <Tooltip {...LIGTAS_CHART.tooltip} />
                  <Bar dataKey="count" fill={LIGTAS_CHART.barFill} radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message={t("noIssueCategoriesAvailable")} />
            )}
          </Card>

          <Card className="ligtas-surface-card-sm rounded-xl p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-xl font-bold text-foreground">{t("issueDensityByReportSection")}</h2>
              <p className="text-sm text-muted-foreground">
                {t("sectionsWithHighestIssueDensity")}
              </p>
            </div>
            {topSections.length > 0 ? (
              <ResponsiveContainer width="100%" height={sectionChartHeight}>
                <BarChart data={topSections} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid stroke={LIGTAS_CHART.gridStroke} strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={LIGTAS_CHART.axisTick} />
                  <YAxis
                    type="category"
                    dataKey="section"
                    tick={LIGTAS_CHART.axisTick}
                    width={180}
                  />
                  <Tooltip
                    {...LIGTAS_CHART.tooltip}
                    formatter={(value: number | string | undefined, name: string | undefined) =>
                      name === "issueDensity" && typeof value === "number"
                        ? value.toFixed(2)
                        : value ?? ""
                    }
                  />
                  <Bar dataKey="issueCount" name={t("issueCount")} fill={LIGTAS_CHART.barFill} radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message={t("noSectionMetadataAvailable")} />
            )}
          </Card>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6">
          <Card className="ligtas-surface-card-sm rounded-xl p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-xl font-bold text-foreground">{t("recurringIssueRate")}</h2>
              <p className="text-sm text-muted-foreground">
                {t("recurringIssueRateDescription")}
              </p>
            </div>
            {data.recurringIssueRate.some((point) => point.analyses > 0) ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={data.recurringIssueRate}>
                  <CartesianGrid stroke={LIGTAS_CHART.gridStroke} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={LIGTAS_CHART.axisTick} />
                  <YAxis tick={LIGTAS_CHART.axisTick} allowDecimals={false} unit="%" />
                  <Tooltip
                    {...LIGTAS_CHART.tooltip}
                    formatter={(value: number | string | undefined, name: string | undefined) => {
                      if (name === "recurringIssueRate" && typeof value === "number") {
                        return `${value.toFixed(1)}%`;
                      }
                      return value ?? "";
                    }}
                  />
                  <Line
                    dataKey="recurringIssueRate"
                    name={t("recurringIssueRate")}
                    stroke={LIGTAS_CHART.lineSecondary}
                    strokeWidth={3}
                    dot={{ r: 4, fill: LIGTAS_CHART.lineSecondary }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message={t("noRecurringIssueSignal")} />
            )}
          </Card>

          <Card className="ligtas-surface-card-sm rounded-xl p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-xl font-bold text-foreground">{t("consultantQualitySignals")}</h2>
              <p className="text-sm text-muted-foreground">
                {t("consultantQualitySignalsDescription")}
              </p>
            </div>
            {data.consultantSignals.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-2 text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <th className="pb-2">{t("consultant")}</th>
                      <th className="pb-2">{t("qcAnalysesRun")}</th>
                      <th className="pb-2">{t("percentWithIssues")}</th>
                      <th className="pb-2">{t("avgIssuesPerReportShort")}</th>
                      <th className="pb-2">{t("mostFrequentCategory")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.consultantSignals.map((signal) => (
                      <tr key={signal.consultantId} className="rounded-lg bg-muted/40 text-foreground">
                        <td className="rounded-l-lg px-3 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                              {signal.consultantEmail
                                .split("@")[0]
                                .split(/[._-]/)
                                .filter(Boolean)
                                .slice(0, 2)
                                .map((part) => part[0]?.toUpperCase() ?? "")
                                .join("") || "QC"}
                            </div>
                            <AdminUserProfileLink
                              userId={signal.consultantId}
                              isAdmin
                              className="font-medium text-primary underline-offset-2 hover:underline"
                            >
                              {signal.consultantEmail}
                            </AdminUserProfileLink>
                          </div>
                        </td>
                        <td className="px-3 py-3">{signal.analysesRun}</td>
                        <td className="px-3 py-3">
                          <span className="rounded-full bg-muted px-2.5 py-1 font-semibold text-foreground">
                            {signal.withIssuesPercentage.toFixed(0)}%
                          </span>
                        </td>
                        <td className="px-3 py-3">{signal.averageIssuesPerReport.toFixed(1)}</td>
                        <td className="rounded-r-lg px-3 py-3">
                          {signal.mostFrequentCategory ?? t("noIssues")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-4 rounded-lg border border-primary/25 bg-primary/10 px-4 py-3 text-xs text-foreground">
                  <span className="font-semibold">{t("note")}:</span> {t("consultantQualitySignalsNote")}
                </div>
              </div>
            ) : (
              <EmptyChart message={t("noConsultantQualitySignals")} />
            )}
          </Card>
        </div>
      </div>

      <WeeklyDigestDialog
        key={weeklyDigestDialogKey}
        open={weeklyDigestOpen}
        onClose={() => setWeeklyDigestOpen(false)}
        selectedWeek={selectedDigestWeek}
        onSelectedWeekChange={setSelectedDigestWeek}
        consultantLabel={selectedConsultantLabel}
        issueTypeLabel={selectedIssueTypeLabel}
        loadingFormat={loadingDigestFormat}
        onExport={handleDigestExport}
      />
    </div>
  );
}