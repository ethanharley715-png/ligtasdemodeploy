import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp,
  TrendingDown,
  FileText,
  FileCheck,
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
  Upload,
  BarChart3,
} from "lucide-react";
import { AdminUserProfileLink } from "../admin/AdminUserProfileLink";
import { Card } from "../ui/card";
import {
  analyticsApi,
  reportsApi,
  teamAnalyticsApi,
  teamsApi,
  type ConsultantPerformanceItem,
  type ProfileStats,
  type ReportListItem,
  type TeamAnalyticsKPIData,
  type TeamAnalyticsQuery,
  type TeamDetail,
} from "../../services/api";
import { useLanguage } from "../../context/useLanguage";

function defaultTeamDashboardQuery(): TeamAnalyticsQuery {
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 29);
  return {
    dateFrom: from.toISOString().slice(0, 10),
    dateTo: today.toISOString().slice(0, 10),
  };
}

interface DashboardViewProps {
  userRole: "admin" | "team_manager" | "consultant";
  userName: string;
  onNavigate?: (view: string) => void;
}

export function DashboardView({ userRole, userName, onNavigate }: DashboardViewProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [recentReports, setRecentReports] = useState<ReportListItem[]>([]);
  const [kpis, setKpis] = useState<{
    reportsThisMonth: number;
    reportsLastMonth: number;
    avgIssuesPerReport: number;
    passRate: number;
    passRateLastMonth: number;
    timeSaved: number;
  } | null>(null);
  const [consultantStats, setConsultantStats] = useState<ProfileStats | null>(null);
  const [teamManagerTeam, setTeamManagerTeam] = useState<TeamDetail | null>(null);
  const [teamManagerKpis, setTeamManagerKpis] = useState<TeamAnalyticsKPIData | null>(null);
  const [teamConsultantPerf, setTeamConsultantPerf] = useState<ConsultantPerformanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        if (userRole === "consultant") {
          const [reportsRes, statsRes] = await Promise.all([reportsApi.list(), reportsApi.stats()]);
          if (!cancelled) {
            setRecentReports(reportsRes.slice(0, 5));
            setConsultantStats(statsRes);
            setKpis(null);
            setTeamManagerTeam(null);
            setTeamManagerKpis(null);
            setTeamConsultantPerf([]);
          }
        } else if (userRole === "team_manager") {
          const teamRes = await teamsApi.me();
          if (!cancelled) {
            setTeamManagerTeam(teamRes);
            setKpis(null);
            setConsultantStats(null);
          }
          if (!teamRes) {
            if (!cancelled) {
              setTeamManagerKpis(null);
              setRecentReports([]);
              setTeamConsultantPerf([]);
            }
          } else {
            const q = defaultTeamDashboardQuery();
            const [kpisRes, recentRes, perfRes] = await Promise.all([
              teamAnalyticsApi.kpis(q),
              teamsApi.meRecentReports(),
              teamAnalyticsApi.consultantPerformance(q),
            ]);
            if (!cancelled) {
              setTeamManagerKpis(kpisRes);
              setRecentReports(recentRes.slice(0, 5));
              setTeamConsultantPerf(perfRes);
            }
          }
        } else {
          const [reportsRes, kpisRes] = await Promise.all([
            reportsApi.list(),
            analyticsApi.kpis("30days"),
          ]);
          if (!cancelled) {
            setRecentReports(reportsRes.slice(0, 5));
            setKpis(kpisRes);
            setConsultantStats(null);
            setTeamManagerTeam(null);
            setTeamManagerKpis(null);
            setTeamConsultantPerf([]);
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t("failedToLoadDashboard"));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [t, userRole]);

  const reportChange =
    kpis && kpis.reportsLastMonth > 0
      ? (((kpis.reportsThisMonth - kpis.reportsLastMonth) / kpis.reportsLastMonth) * 100).toFixed(1)
      : null;

  const passRateChange =
    kpis && kpis.passRateLastMonth > 0
      ? (kpis.passRate - kpis.passRateLastMonth).toFixed(1)
      : null;

  const isConsultant = userRole === "consultant";
  const isTeamManager = userRole === "team_manager";
  const consultantAvgIssues =
    consultantStats && consultantStats.completedReports > 0
      ? (consultantStats.totalIssues / consultantStats.completedReports).toFixed(1)
      : "—";

  const teamManagerTimeSaved =
    teamManagerKpis != null ? teamManagerKpis.totalReportsAnalysed * 15 : 0;

  const teamConsultantMembers = useMemo(() => {
    if (!teamManagerTeam?.members) {
      return [] as TeamDetail["members"];
    }
    return teamManagerTeam.members.filter((m) => m.role === "Consultant");
  }, [teamManagerTeam]);

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center p-8">
        <p className="text-gray-600 dark:text-gray-400">{t("loadingDashboard")}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-full p-8">
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-full p-8">
      <div className="mb-8">
        <h1 className="mb-2 text-4xl font-bold text-foreground">
          {t("welcomeBack")}, {userName}
        </h1>
        {isConsultant ? (
          <>
            <p className="mb-2 text-base font-semibold text-gray-800 dark:text-gray-200">{t("consultant")}</p>
            <p className="text-lg text-gray-600 dark:text-gray-400">{t("consultantDashboardDescription")}</p>
          </>
        ) : isTeamManager ? (
          <>
            <p className="mb-2 text-lg text-gray-800 dark:text-gray-200">
              <span className="font-semibold text-foreground">{t("teamManager")}</span>
              <span className="mx-2 text-gray-400 dark:text-gray-500">·</span>
              <span className="font-semibold text-foreground">{teamManagerTeam?.name ?? "—"}</span>
            </p>
            <p className="text-lg text-gray-600 dark:text-gray-400">{t("teamManagerDashboardDescription")}</p>
          </>
        ) : (
          <p className="text-lg text-gray-600 dark:text-gray-400">{t("dashboardDescription")}</p>
        )}
      </div>

      {isTeamManager && !teamManagerTeam ? (
        <p
          className="mb-8 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
          role="status"
        >
          {t("notAssignedToManageTeam")}
        </p>
      ) : null}

      {isTeamManager && teamManagerTeam ? (
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="ligtas-surface-card rounded-xl p-6">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="mb-1 text-sm font-semibold text-gray-600 dark:text-gray-400">
                  {t("dashboardTeamTotalReports")}
                </p>
                <p className="text-4xl font-bold text-foreground">
                  {teamManagerKpis?.totalReportsAnalysed ?? 0}
                </p>
              </div>
              <div className="ligtas-icon-tile-lg">
                <FileText className="size-6 text-primary-foreground" />
              </div>
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">{t("teamStatsPeriodHint")}</span>
          </Card>

          <Card className="ligtas-surface-card rounded-xl p-6">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="mb-1 text-sm font-semibold text-gray-600 dark:text-gray-400">{t("passRate")}</p>
                <p className="text-4xl font-bold text-foreground">
                  {teamManagerKpis != null ? teamManagerKpis.passRate.toFixed(1) : "—"}%
                </p>
              </div>
              <div className="ligtas-icon-tile-lg">
                <CheckCircle className="size-6 text-primary-foreground" />
              </div>
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">{t("teamStatsPeriodHint")}</span>
          </Card>

          <Card className="ligtas-surface-card rounded-xl p-6">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="mb-1 text-sm font-semibold text-gray-600 dark:text-gray-400">
                  {t("avgIssuesPerReport")}
                </p>
                <p className="text-4xl font-bold text-foreground">
                  {teamManagerKpis != null ? teamManagerKpis.averageIssuesPerReport.toFixed(1) : "—"}
                </p>
              </div>
              <div className="ligtas-icon-tile-lg">
                <AlertTriangle className="size-6 text-primary-foreground" />
              </div>
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">{t("teamStatsPeriodHint")}</span>
          </Card>

          <Card className="ligtas-surface-card rounded-xl p-6">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="mb-1 text-sm font-semibold text-gray-600 dark:text-gray-400">{t("qcTimeSaved")}</p>
                <p className="text-4xl font-bold text-foreground">{teamManagerTimeSaved}h</p>
              </div>
              <div className="ligtas-icon-tile-lg">
                <Clock className="size-6 text-primary-foreground" />
              </div>
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">{t("estimatedThisPeriod")}</span>
          </Card>
        </div>
      ) : isConsultant ? (
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          <Card className="ligtas-surface-card rounded-xl p-6">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="mb-1 text-sm font-semibold text-gray-600 dark:text-gray-400">
                  {t("totalReportsSubmitted")}
                </p>
                <p className="text-4xl font-bold text-foreground">
                  {consultantStats?.totalReports ?? 0}
                </p>
              </div>
              <div className="ligtas-icon-tile-lg">
                <FileText className="size-6 text-primary-foreground" />
              </div>
            </div>
          </Card>

          <Card className="ligtas-surface-card rounded-xl p-6">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="mb-1 text-sm font-semibold text-gray-600 dark:text-gray-400">{t("passRate")}</p>
                <p className="text-4xl font-bold text-foreground">
                  {consultantStats != null ? consultantStats.passRate.toFixed(1) : "—"}%
                </p>
              </div>
              <div className="ligtas-icon-tile-lg">
                <CheckCircle className="size-6 text-primary-foreground" />
              </div>
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">{t("fromCompletedReports")}</span>
          </Card>

          <Card className="ligtas-surface-card rounded-xl p-6">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="mb-1 text-sm font-semibold text-gray-600 dark:text-gray-400">
                  {t("avgIssuesPerReport")}
                </p>
                <p className="text-4xl font-bold text-foreground">{consultantAvgIssues}</p>
              </div>
              <div className="ligtas-icon-tile-lg">
                <AlertTriangle className="size-6 text-primary-foreground" />
              </div>
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">{t("fromCompletedReports")}</span>
          </Card>
        </div>
      ) : isTeamManager ? null : (
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="ligtas-surface-card rounded-xl p-6">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="mb-1 text-sm font-semibold text-gray-600 dark:text-gray-400">
                  {t("totalReports")}
                </p>
                <p className="text-4xl font-bold text-foreground">{kpis?.reportsThisMonth ?? 0}</p>
              </div>
              <div className="ligtas-icon-tile-lg">
                <FileText className="size-6 text-primary-foreground" />
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              {reportChange != null && (
                <>
                  {Number(reportChange) >= 0 ? (
                    <TrendingUp className="size-4 text-foreground" />
                  ) : (
                    <TrendingDown className="size-4 text-foreground" />
                  )}
                  <span className="font-semibold text-foreground">{reportChange}%</span>
                </>
              )}
              <span className="text-gray-500 dark:text-gray-400">{t("vsLastPeriod")}</span>
            </div>
          </Card>

          <Card className="ligtas-surface-card rounded-xl p-6">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="mb-1 text-sm font-semibold text-gray-600 dark:text-gray-400">
                  {t("avgIssuesPerReport")}
                </p>
                <p className="text-4xl font-bold text-foreground">
                  {kpis?.avgIssuesPerReport?.toFixed(1) ?? "—"}
                </p>
              </div>
              <div className="ligtas-icon-tile-lg">
                <AlertTriangle className="size-6 text-primary-foreground" />
              </div>
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">{t("fromCompletedReports")}</span>
          </Card>

          <Card className="ligtas-surface-card rounded-xl p-6">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="mb-1 text-sm font-semibold text-gray-600 dark:text-gray-400">{t("passRate")}</p>
                <p className="text-4xl font-bold text-foreground">{kpis?.passRate?.toFixed(1) ?? "—"}%</p>
              </div>
              <div className="ligtas-icon-tile-lg">
                <CheckCircle className="size-6 text-primary-foreground" />
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              {passRateChange != null && (
                <>
                  <TrendingUp className="size-4 text-foreground" />
                  <span className="font-semibold text-foreground">{passRateChange}%</span>
                </>
              )}
              <span className="text-gray-500 dark:text-gray-400">{t("vsLastPeriod")}</span>
            </div>
          </Card>

          <Card className="ligtas-surface-card rounded-xl p-6">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="mb-1 text-sm font-semibold text-gray-600 dark:text-gray-400">{t("qcTimeSaved")}</p>
                <p className="text-4xl font-bold text-foreground">{kpis?.timeSaved ?? 0}h</p>
              </div>
              <div className="ligtas-icon-tile-lg">
                <Clock className="size-6 text-primary-foreground" />
              </div>
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">{t("estimatedThisPeriod")}</span>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="ligtas-surface-card rounded-xl lg:col-span-2">
          <div className="border-b-2 border-border p-6">
            <h2 className="text-xl font-bold text-foreground">
              {isConsultant
                ? t("yourRecentReports")
                : isTeamManager
                  ? t("teamRecentReportsTitle")
                  : t("recentReports")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isConsultant
                ? t("yourRecentReportsSubtitle")
                : isTeamManager
                  ? t("teamRecentReportsSubtitle")
                  : t("latestQualityControlChecks")}
            </p>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {recentReports.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400">{t("noReportsYet")}</p>
              ) : (
                recentReports.map((report) => (
                  <button
                    key={report.id}
                    type="button"
                    onClick={() => navigate(`/reports/${report.id}`)}
                    className="flex w-full items-center justify-between rounded-lg border border-border bg-muted/40 p-4 text-left transition-colors hover:bg-muted/70"
                  >
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-3">
                        <FileText className="size-5 text-gray-600 dark:text-gray-400" />
                        <p className="font-semibold text-foreground">{report.fileName}</p>
                      </div>
                      {(isTeamManager || userRole === "admin") && (
                        <p className="mb-1 text-xs text-gray-600 dark:text-gray-400">
                          <AdminUserProfileLink
                            userId={report.analystUserId}
                            isAdmin={userRole === "admin"}
                            className={
                              userRole === "admin"
                                ? "text-xs font-medium text-primary underline-offset-2 hover:underline"
                                : "text-xs text-gray-600 dark:text-gray-400"
                            }
                          >
                            {report.analyst}
                          </AdminUserProfileLink>
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                        <span className="font-mono">{report.id}</span>
                        <span>
                          {new Date(report.uploadDate).toLocaleString(undefined, {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {report.status === "passed" && (
                        <div className="flex items-center gap-2 rounded border-2 border-green-700 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-900 dark:border-green-500 dark:bg-green-950/60 dark:text-green-100">
                          <CheckCircle className="size-3" />
                          {t("passed").toUpperCase()}
                        </div>
                      )}

                      {report.status === "failed" && (
                        <div className="flex flex-col items-end">
                          <div className="mb-1 flex items-center gap-2 rounded border-2 border-red-700 bg-red-600 px-3 py-1.5 text-xs font-semibold text-white dark:border-red-500 dark:bg-red-900">
                            <AlertTriangle className="size-3" />
                            {t("failed").toUpperCase()}
                          </div>
                          <span className="text-xs text-gray-600 dark:text-gray-500" />
                        </div>
                      )}

                      {report.status === "processing" && (
                        <div
                          className={
                            isConsultant
                              ? "flex items-center gap-2 rounded border-2 border-amber-600 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-950 dark:border-amber-500 dark:bg-amber-950/50 dark:text-amber-100"
                              : "flex items-center gap-2 rounded border-2 border-gray-400 bg-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-800 dark:border-gray-500 dark:bg-gray-700 dark:text-gray-100"
                          }
                        >
                          <Clock className="size-3" />
                          {(isConsultant ? t("pending") : t("processing")).toUpperCase()}
                        </div>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </Card>

        <Card className="ligtas-surface-card rounded-xl">
          <div className="border-b-2 border-border p-6">
            <h2 className="text-xl font-bold text-foreground">{t("quickActions")}</h2>
            <p className="text-sm text-muted-foreground">{t("navigateFromSidebar")}</p>
          </div>
          <div className="space-y-4 p-6">
            <button
              type="button"
              onClick={() => onNavigate?.("upload")}
              className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted/50"
            >
              <div className="rounded-full bg-primary p-1.5 text-primary-foreground">
                <Upload className="size-4 text-primary-foreground" />
              </div>
              <p className="text-sm font-semibold text-foreground">{t("uploadReport")}</p>
            </button>

            {userRole === "consultant" && (
              <button
                type="button"
                onClick={() => onNavigate?.("results")}
                className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted/50"
              >
                <div className="rounded-full bg-primary p-1.5 text-primary-foreground">
                  <FileCheck className="size-4 text-primary-foreground" />
                </div>
                <p className="text-sm font-semibold text-foreground">{t("qcResults")}</p>
              </button>
            )}

            {userRole === "team_manager" && (
              <button
                type="button"
                onClick={() => onNavigate?.("team-analytics")}
                className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted/50"
              >
                <div className="rounded-full bg-primary p-1.5 text-primary-foreground">
                  <TrendingUp className="size-4 text-primary-foreground" />
                </div>
                <p className="text-sm font-semibold text-foreground">{t("myTeamAnalytics")}</p>
              </button>
            )}

            <button
              type="button"
              onClick={() => onNavigate?.("history")}
              className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted/50"
            >
              <div className="rounded-full bg-primary p-1.5 text-primary-foreground">
                <FileText className="size-4 text-primary-foreground" />
              </div>
              <p className="text-sm font-semibold text-foreground">{t("reportHistory")}</p>
            </button>

            {userRole === "admin" && (
              <button
                type="button"
                onClick={() => onNavigate?.("analytics")}
                className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted/50"
              >
                <div className="rounded-full bg-primary p-1.5 text-primary-foreground">
                  <BarChart3 className="size-4 text-primary-foreground" />
                </div>
                <p className="text-sm font-semibold text-foreground">{t("qcTrendDashboard")}</p>
              </button>
            )}

            {userRole === "admin" && (
              <button
                type="button"
                onClick={() => onNavigate?.("users")}
                className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted/50"
              >
                <div className="rounded-full bg-primary p-1.5 text-primary-foreground">
                  <Users className="size-4 text-primary-foreground" />
                </div>
                <p className="text-sm font-semibold text-foreground">{t("userManagement")}</p>
              </button>
            )}

          </div>
        </Card>
      </div>

      {isTeamManager && teamManagerTeam && (
        <Card className="ligtas-surface-card mt-6 rounded-xl">
          <div className="border-b-2 border-border p-6">
            <h2 className="text-xl font-bold text-foreground">{t("teamMembersPanelTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t("teamMembersPanelSubtitle")}</p>
          </div>
          <div className="p-6">
            {teamConsultantMembers.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">{t("noConsultantsAssigned")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-2 text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      <th className="pb-2">{t("consultant")}</th>
                      <th className="pb-2">{t("reports")}</th>
                      <th className="pb-2">{t("passRate")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamConsultantMembers.map((member) => {
                      const perf = teamConsultantPerf.find(
                        (p) => p.consultantId === Number(member.id),
                      );
                      const reportCount = perf?.reportsAnalysed ?? 0;
                      const passRateLabel =
                        perf != null && perf.reportsAnalysed > 0
                          ? `${perf.passRate.toFixed(1)}%`
                          : "—";

                      return (
                        <tr
                          key={member.id}
                          className="rounded-lg bg-muted/40 text-foreground"
                        >
                          <td className="rounded-l-lg px-3 py-3">
                            <div className="font-semibold text-foreground">{member.name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{member.email}</div>
                          </td>
                          <td className="px-3 py-3">{reportCount}</td>
                          <td className="rounded-r-lg px-3 py-3">{passRateLabel}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}