import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  Activity,
  AlertCircle,
  BarChart3,
  Building2,
  Calendar,
  FileWarning,
  Target,
  TrendingUp,
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
import { AdminUserProfileLink } from "../admin/AdminUserProfileLink";
import { Card } from "../ui/card";
import {
  teamAnalyticsApi,
  teamsApi,
  type ConsultantPerformanceItem,
  type IssueTypeItem,
  type TeamAnalyticsKPIData,
  type TeamAnalyticsQuery,
  type TeamAnalyticsTrendItem,
  type TeamDetail,
  type TeamListItem,
  type TeamPerformanceItem,
} from "../../services/api";
import { IssueCategoryAxisTick } from "../analytics/IssueCategoryAxisTick";
import { useLanguage } from "../../context/useLanguage";
import { LIGTAS_CHART } from "../../lib/chartTheme";

type TeamAnalyticsViewProps = {
  userRole: "admin" | "team_manager";
};

type DashboardData = {
  kpis: TeamAnalyticsKPIData | null;
  issueTypes: IssueTypeItem[];
  trends: TeamAnalyticsTrendItem[];
  teamPerformance: TeamPerformanceItem[];
  consultantPerformance: ConsultantPerformanceItem[];
};

type FilterState = {
  dateFrom: string;
  dateTo: string;
  issueType: string;
  teamId: string;
  consultantId: string;
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
    issueType: "",
    teamId: "",
    consultantId: "",
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
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
          <p className="mt-2 text-4xl font-bold text-foreground">{value}</p>
        </div>
        <div className="ligtas-icon-tile-lg rounded-full">
          <Icon className="size-5 text-primary-foreground" />
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{helper}</p>
    </Card>
  );
}

function buildQuery(filters: FilterState, teamId: string | null): TeamAnalyticsQuery {
  return {
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    ...(filters.issueType ? { issueType: filters.issueType } : {}),
    ...(teamId ? { teamId } : {}),
    ...(teamId && filters.consultantId ? { consultantId: filters.consultantId } : {}),
  };
}

export function TeamAnalyticsView({ userRole }: TeamAnalyticsViewProps) {
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
  const [teams, setTeams] = useState<TeamListItem[]>([]);
  const [scopedTeam, setScopedTeam] = useState<TeamDetail | null>(null);
  const [data, setData] = useState<DashboardData>({
    kpis: null,
    issueTypes: [],
    trends: [],
    teamPerformance: [],
    consultantPerformance: [],
  });
  const [loadingScope, setLoadingScope] = useState(true);
  const [loading, setLoading] = useState(true);
  const [filterLoading, setFilterLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedOnceRef = useRef(false);

  const effectiveTeamId = userRole === "team_manager" ? scopedTeam?.id ?? null : filters.teamId || null;
  const consultants = useMemo(() => scopedTeam?.members ?? [], [scopedTeam]);
  const query = useMemo(() => buildQuery(filters, effectiveTeamId), [effectiveTeamId, filters]);
  const showConsultantTable = Boolean(effectiveTeamId);
  const scopeTitle = userRole === "admin" ? t("teamAnalytics") : t("myTeamAnalytics");
  const scopeLabel = userRole === "admin" ? t("adminAnalytics") : t("teamManagerAnalytics");

  const fetchDashboard = useCallback(
    async (currentQuery: TeamAnalyticsQuery, isInitialLoad: boolean) => {
      if (isInitialLoad) {
        setLoading(true);
      } else {
        setFilterLoading(true);
      }
      setError(null);

      try {
        const [kpis, issueTypes, trends, performance] = await Promise.all([
          teamAnalyticsApi.kpis(currentQuery),
          teamAnalyticsApi.issueTypes(currentQuery),
          teamAnalyticsApi.trends(currentQuery),
          showConsultantTable
            ? teamAnalyticsApi.consultantPerformance(currentQuery)
            : teamAnalyticsApi.teamPerformance(currentQuery),
        ]);

        setData({
          kpis,
          issueTypes,
          trends,
          teamPerformance: showConsultantTable ? [] : (performance as TeamPerformanceItem[]),
          consultantPerformance: showConsultantTable ? (performance as ConsultantPerformanceItem[]) : [],
        });
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : t("failedToLoadTeamAnalytics"));
      } finally {
        setLoading(false);
        setFilterLoading(false);
        hasLoadedOnceRef.current = true;
      }
    },
    [showConsultantTable, t],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadScope() {
      setLoadingScope(true);
      setError(null);

      try {
        if (userRole === "admin") {
          const nextTeams = await teamsApi.list();
          if (!cancelled) {
            setTeams(nextTeams);
          }
          return;
        }

        const managedTeam = await teamsApi.me();
        if (!cancelled) {
          setScopedTeam(managedTeam);
        }
      } catch (scopeError) {
        if (!cancelled) {
          setError(scopeError instanceof Error ? scopeError.message : t("failedToLoadTeamScope"));
        }
      } finally {
        if (!cancelled) {
          setLoadingScope(false);
        }
      }
    }

    void loadScope();

    return () => {
      cancelled = true;
    };
  }, [userRole, t]);

  useEffect(() => {
    if (userRole !== "admin") {
      return;
    }

    if (!filters.teamId) {
      setScopedTeam(null);
      setFilters((current) => (current.consultantId ? { ...current, consultantId: "" } : current));
      return;
    }

    let cancelled = false;
    teamsApi
      .get(filters.teamId)
      .then((team) => {
        if (!cancelled) {
          setScopedTeam(team);
          setFilters((current) =>
            current.consultantId && !team.members.some((member) => member.id === current.consultantId)
              ? { ...current, consultantId: "" }
              : current,
          );
        }
      })
      .catch((teamError) => {
        if (!cancelled) {
          setError(teamError instanceof Error ? teamError.message : t("failedToLoadTeamDetails"));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [filters.teamId, userRole, t]);

  useEffect(() => {
    if (loadingScope) {
      return;
    }

    if (userRole === "team_manager" && !scopedTeam) {
      setLoading(false);
      setFilterLoading(false);
      return;
    }

    void fetchDashboard(query, !hasLoadedOnceRef.current);
  }, [fetchDashboard, loadingScope, query, scopedTeam, userRole]);

  const handleFilterChange =
    (field: keyof FilterState) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = event.target.value;
      setFilters((current) => {
        if (field === "teamId") {
          return {
            ...current,
            teamId: value,
            consultantId: "",
          };
        }

        return {
          ...current,
          [field]: value,
        };
      });
    };

  const selectedIssueTypeLabel = useMemo(() => {
    const issueOption = ISSUE_CATEGORY_OPTIONS.find((option) => option.value === filters.issueType);
    return issueOption?.label ?? t("allIssueCategories");
  }, [ISSUE_CATEGORY_OPTIONS, filters.issueType, t]);

  const performanceRows = showConsultantTable ? data.consultantPerformance : data.teamPerformance;
  const hasTrendData = data.trends.some((point) => point.reports > 0 || point.issues > 0);
  const noReports = (data.kpis?.totalReportsAnalysed ?? 0) === 0;

  if (loadingScope || loading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-background p-8">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
          <p className="text-base font-semibold text-muted-foreground">{t("loadingTeamAnalytics")}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-full items-center justify-center bg-background p-8">
        <Card className="max-w-lg rounded-2xl border border-destructive/30 bg-card p-8 text-center text-card-foreground shadow-sm">
          <AlertCircle className="mx-auto mb-4 size-12 text-destructive" />
          <h2 className="mb-2 text-2xl font-bold text-foreground">{t("unableToLoadTeamAnalytics")}</h2>
          <p className="mb-6 text-sm text-destructive">{error}</p>
          <button
            type="button"
            onClick={() => void fetchDashboard(query, true)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            {t("retry")}
          </button>
        </Card>
      </div>
    );
  }

  if (userRole === "team_manager" && !scopedTeam) {
    return (
      <div className="min-h-full bg-background px-6 py-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">{scopeLabel}</p>
            <h1 className="text-4xl font-bold text-foreground">{scopeTitle}</h1>
            <p className="mt-2 max-w-3xl text-base text-muted-foreground">
              {t("teamAnalyticsDescriptionManager")}
            </p>
          </div>
          <Card className="ligtas-surface-card-sm rounded-xl p-8 text-sm text-muted-foreground shadow-sm">
            {t("notAssignedToManageTeam")}
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background px-6 py-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">{scopeLabel}</p>
            <h1 className="text-4xl font-bold text-foreground">{scopeTitle}</h1>
            <p className="mt-2 max-w-3xl text-base text-muted-foreground">
              {t("teamAnalyticsDescription")}
            </p>
          </div>
          <div className="ligtas-surface-card-sm rounded-2xl px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{t("currentScope")}</p>
            <p className="mt-2 text-lg font-bold text-foreground">
              {effectiveTeamId ? scopedTeam?.name ?? t("selectedTeam") : t("allTeams")}
            </p>
            <p className="text-sm text-muted-foreground">{selectedIssueTypeLabel}</p>
          </div>
        </div>

        <Card className="mb-8 ligtas-surface-card-sm rounded-xl p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="size-5 text-foreground" />
            <h2 className="text-lg font-bold text-foreground">{t("analyticsFilters")}</h2>
          </div>
          <div className={`grid grid-cols-1 gap-4 ${userRole === "admin" ? "xl:grid-cols-5" : "xl:grid-cols-4"}`}>
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
            {userRole === "admin" && (
              <label className="text-sm font-semibold text-foreground">
                <span className="mb-2 flex items-center gap-2">
                  <Building2 className="size-4 text-muted-foreground" />
                  {t("team")}
                </span>
                <select
                  aria-label={t("team")}
                  value={filters.teamId}
                  onChange={handleFilterChange("teamId")}
                  className="ligtas-input w-full font-medium"
                >
                  <option value="">{t("allTeams")}</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="text-sm font-semibold text-foreground">
              <span className="mb-2 flex items-center gap-2">
                <Users className="size-4 text-muted-foreground" />
                {t("consultant")}
              </span>
              <select
                aria-label={t("consultant")}
                value={filters.consultantId}
                onChange={handleFilterChange("consultantId")}
                disabled={!effectiveTeamId}
                className="ligtas-input w-full font-medium disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">{effectiveTeamId ? t("allConsultants") : t("selectTeamFirst")}</option>
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
                aria-label={t("issueCategory")}
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
          {filterLoading && <p className="mt-4 text-sm font-semibold text-muted-foreground">{t("refreshingAnalytics")}</p>}
        </Card>

        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <MetricCard
            title={t("totalReportsAnalysed")}
            value={String(data.kpis?.totalReportsAnalysed ?? 0)}
            helper={t("completedPersistedReportsInScope")}
            icon={Activity}
          />
          <MetricCard
            title={t("totalIssuesFound")}
            value={String(data.kpis?.totalIssuesFound ?? 0)}
            helper={t("storedIssueRecordsMatching")}
            icon={FileWarning}
          />
          <MetricCard
            title={t("averageIssuesPerReport")}
            value={(data.kpis?.averageIssuesPerReport ?? 0).toFixed(2)}
            helper={t("averagePersistedIssuesPerReport")}
            icon={TrendingUp}
          />
          <MetricCard
            title={t("passRate")}
            value={`${(data.kpis?.passRate ?? 0).toFixed(1)}%`}
            helper={t("shareOfReportsPassedQc")}
            icon={Target}
          />
          <MetricCard
            title={t("failedQcRate")}
            value={`${(data.kpis?.failedQcRate ?? 0).toFixed(1)}%`}
            helper={t("shareOfReportsFailedQc")}
            icon={BarChart3}
          />
        </div>

        {noReports && (
          <Card className="mb-8 ligtas-surface-card-sm rounded-xl p-5 text-sm text-muted-foreground shadow-sm">
            {t("noCompletedPersistedReportsForFilters")}
          </Card>
        )}

        <Card className="mb-8 ligtas-surface-card-sm rounded-xl p-6 shadow-sm">
          <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-xl font-bold text-foreground">
                {showConsultantTable ? t("consultantPerformance") : t("teamPerformance")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {showConsultantTable
                  ? t("consultantLevelQualityIndicators")
                  : t("organisationWideTeamComparison")}
              </p>
            </div>
            <div className="text-sm font-medium text-muted-foreground">
              {showConsultantTable ? scopedTeam?.name ?? t("selectedTeam") : `${data.teamPerformance.length} ${t("teamsLowercase")}`}
            </div>
          </div>
          {performanceRows.length > 0 ? (
            <div className="overflow-x-auto">
              {showConsultantTable ? (
                <table className="min-w-full border-separate border-spacing-y-2 text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <th className="pb-2">{t("consultant")}</th>
                      <th className="pb-2">{t("reportsAnalysed")}</th>
                      <th className="pb-2">{t("avgIssuesPerReportShort")}</th>
                      <th className="pb-2">{t("reportsContainingIssues")}</th>
                      <th className="pb-2">{t("mostFrequentIssueCategory")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.consultantPerformance.map((row) => (
                      <tr key={row.consultantId} className="rounded-lg bg-muted/40 text-foreground">
                        <td className="rounded-l-lg px-3 py-3">
                          <div className="font-semibold text-foreground">
                            <AdminUserProfileLink
                              userId={row.consultantId}
                              isAdmin={userRole === "admin"}
                              className={
                                userRole === "admin"
                                  ? "font-semibold text-primary underline-offset-2 hover:underline"
                                  : undefined
                              }
                            >
                              {row.consultantName}
                            </AdminUserProfileLink>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            <AdminUserProfileLink
                              userId={row.consultantId}
                              isAdmin={userRole === "admin"}
                              className={
                                userRole === "admin"
                                  ? "text-primary underline-offset-2 hover:underline"
                                  : undefined
                              }
                            >
                              {row.consultantEmail}
                            </AdminUserProfileLink>
                          </div>
                        </td>
                        <td className="px-3 py-3">{row.reportsAnalysed}</td>
                        <td className="px-3 py-3">{row.averageIssuesPerReport.toFixed(2)}</td>
                        <td className="px-3 py-3">{row.reportsWithIssuesPercentage.toFixed(1)}%</td>
                        <td className="rounded-r-lg px-3 py-3">{row.mostFrequentIssueCategory ?? t("noIssues")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="min-w-full border-separate border-spacing-y-2 text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <th className="pb-2">{t("team")}</th>
                      <th className="pb-2">{t("reportsAnalysed")}</th>
                      <th className="pb-2">{t("avgIssuesPerReportShort")}</th>
                      <th className="pb-2">{t("reportsContainingIssues")}</th>
                      <th className="pb-2">{t("mostFrequentIssueCategory")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.teamPerformance.map((row) => (
                      <tr key={row.teamId} className="rounded-lg bg-muted/40 text-foreground">
                        <td className="rounded-l-lg px-3 py-3 font-semibold text-foreground">{row.teamName}</td>
                        <td className="px-3 py-3">{row.reportsAnalysed}</td>
                        <td className="px-3 py-3">{row.averageIssuesPerReport.toFixed(2)}</td>
                        <td className="px-3 py-3">{row.reportsWithIssuesPercentage.toFixed(1)}%</td>
                        <td className="rounded-r-lg px-3 py-3">{row.mostFrequentIssueCategory ?? t("noIssues")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : (
            <EmptyChart
              message={
                showConsultantTable
                  ? t("noConsultantPerformanceData")
                  : t("noTeamPerformanceData")
              }
            />
          )}
        </Card>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card className="ligtas-surface-card-sm rounded-xl p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-xl font-bold text-foreground">{t("reportsAnalysedOverTime")}</h2>
              <p className="text-sm text-muted-foreground">
                {t("completedPersistedReportsGrouped")}
              </p>
            </div>
            {hasTrendData ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={data.trends}>
                  <CartesianGrid stroke={LIGTAS_CHART.gridStroke} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={LIGTAS_CHART.axisTick} />
                  <YAxis tick={LIGTAS_CHART.axisTick} allowDecimals={false} />
                  <Tooltip {...LIGTAS_CHART.tooltip} />
                  <Line
                    dataKey="reports"
                    name={t("reports")}
                    stroke={LIGTAS_CHART.linePrimary}
                    strokeWidth={3}
                    dot={{ r: 4, fill: LIGTAS_CHART.linePrimary }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message={t("noReportActivityInRange")} />
            )}
          </Card>

          <Card className="ligtas-surface-card-sm rounded-xl p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-xl font-bold text-foreground">{t("issuesDetectedOverTime")}</h2>
              <p className="text-sm text-muted-foreground">
                {t("issueTotalsAcrossReportingBuckets")}
              </p>
            </div>
            {hasTrendData ? (
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
              <EmptyChart message={t("noIssueActivityForFilters")} />
            )}
          </Card>

          <Card className="ligtas-surface-card-sm rounded-xl p-6 shadow-sm xl:col-span-2">
            <div className="mb-5">
              <h2 className="text-xl font-bold text-foreground">{t("issueTypeBreakdown")}</h2>
              <p className="text-sm text-muted-foreground">
                {t("issueCategoriesDerivedFromPersisted")}
              </p>
            </div>
            {data.issueTypes.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
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
              <EmptyChart message={t("noPersistedIssuesForFilters")} />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
