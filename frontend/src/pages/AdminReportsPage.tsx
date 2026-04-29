/**
 * AdminReportPage.tsx
 * 
 * This page allows admins to view reports for specific users.
 * 
 * The design decisions I made were the following:
 * . I used user selection which will dynamically load reports up via query parameters.
 * . I seperated the user list and the report panel which will improve navigation intuitiveness.
 * 
 * Overall this improves role based visibility and improves the admin workflow efficiency.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useLanguage } from "../context/useLanguage";
import { LIGTAS_CHART } from "../lib/chartTheme";
import { adminUserAnalyticsHref } from "../utils/adminUserAnalytics";

type User = {
  id: string;
  name: string;
  email: string;
};

type ReportStatus = "PROCESSING" | "COMPLETED" | "FAILED";

type Report = {
  id: string;
  fileName: string;
  passedQC: boolean;
  uploadedAt: string;
  status?: ReportStatus;
  totalIssues?: number;
  issues?: { id?: string }[];
  analyzedAt?: string | null;
};

type LeaderboardUser = {
  userId: number;
  name: string;
  totalReports: number;
  averageIssues: number;
  score: number;
};

type UserReportAnalytics = {
  totalReports: number;
  passCount: number;
  failCount: number;
  finishedForRates: number;
  passRatePercent: number | null;
  failRatePercent: number | null;
  averageScore: number | null;
  mostRecentActivity: Date | null;
};

function dayKeyFromIso(iso: string): string {
  return iso.slice(0, 10);
}

function issueCountForReport(r: Report): number {
  if (Array.isArray(r.issues)) return r.issues.length;
  return r.totalIssues ?? 0;
}

function computeUserReportAnalytics(reports: Report[]): UserReportAnalytics {
  const totalReports = reports.length;

  const passCount = reports.filter((r) => r.status === "COMPLETED" && r.passedQC).length;
  const failCount = reports.filter(
    (r) => r.status === "FAILED" || (r.status === "COMPLETED" && !r.passedQC),
  ).length;
  const finishedForRates = passCount + failCount;

  const passRatePercent =
    finishedForRates > 0 ? Math.round((passCount / finishedForRates) * 1000) / 10 : null;
  const failRatePercent =
    finishedForRates > 0 ? Math.round((failCount / finishedForRates) * 1000) / 10 : null;

  const completed = reports.filter((r) => r.status === "COMPLETED");
  const averageScore =
    completed.length === 0
      ? null
      : (() => {
          const avgIssues =
            completed.reduce((sum, r) => sum + issueCountForReport(r), 0) / completed.length;
          return Math.round(Math.max(0, 100 - avgIssues * 2) * 10) / 10;
        })();

  const mostRecentActivity = reports.reduce<Date | null>((latest, r) => {
    const times = [r.uploadedAt, r.analyzedAt].filter(Boolean) as string[];
    for (const raw of times) {
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) continue;
      if (!latest || d > latest) latest = d;
    }
    return latest;
  }, null);

  return {
    totalReports,
    passCount,
    failCount,
    finishedForRates,
    passRatePercent,
    failRatePercent,
    averageScore,
    mostRecentActivity,
  };
}

type TrendRow = { label: string; passed: number; failed: number; sortKey: string; dateFull: string };

function buildPassFailTrendData(reports: Report[]): TrendRow[] {
  const byDay = new Map<string, { passed: number; failed: number }>();

  for (const r of reports) {
    if (r.status === "PROCESSING") continue;
    const key = dayKeyFromIso(r.uploadedAt);
    if (!byDay.has(key)) {
      byDay.set(key, { passed: 0, failed: 0 });
    }
    const bucket = byDay.get(key)!;
    if (r.status === "COMPLETED" && r.passedQC) {
      bucket.passed += 1;
    } else if (r.status === "FAILED" || (r.status === "COMPLETED" && !r.passedQC)) {
      bucket.failed += 1;
    }
  }

  const rows: TrendRow[] = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([sortKey, counts]) => {
      const noon = new Date(`${sortKey}T12:00:00`);
      return {
        sortKey,
        dateFull: noon.toLocaleDateString(undefined, {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        label: noon.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
        passed: counts.passed,
        failed: counts.failed,
      };
    });

  return rows;
}

function formatPercent(value: number | null): string {
  if (value == null) return "—";
  return `${value}%`;
}

const REPORT_LIST_PAGE_SIZE = 10;

export default function AdminReportsPage() {
  const { t } = useLanguage();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [listQuery, setListQuery] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState<"all" | "passed" | "failed">("all");
  const [listPageRaw, setListPageRaw] = useState(1);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const reportsUserIdRef = useRef<string | null>(null);

  const params = useParams<{ userId?: string }>();
  const [searchParams] = useSearchParams();
  /** Prefer dedicated route param; keep query param as fallback for bookmarks/tests. */
  const selectedUserId = params.userId ?? searchParams.get("userId") ?? null;
  const navigate = useNavigate();

  const fetchUsers = async () => { // Fetches users for the admin selection panel
    try {
      const res = await fetch("http://localhost:4000/api/users", {
        credentials: "include",
      });
      const data = await res.json();
      setUsers(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchLeaderboard = async () => { // Fetches the leaderboard data for the performance ranking display.
    try {
      const res = await fetch("http://localhost:4000/api/analytics/leaderboard", {
        credentials: "include",
      });
      const data = await res.json();
      setLeaderboard(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await fetchUsers();
        if (!cancelled) await fetchLeaderboard();
      } catch {
        /* errors logged in fetch helpers */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedUserId || users.length === 0) return;
    const foundUser = users.find((u) => u.id === selectedUserId);
    if (!foundUser) return;

    const switchedUser = reportsUserIdRef.current !== selectedUserId;
    reportsUserIdRef.current = selectedUserId;

    let cancelled = false;
    void (async () => {
      try {
        if (!cancelled) setSelectedUser(foundUser);
        const res = await fetch(`http://localhost:4000/api/users/${foundUser.id}/reports`, {
          credentials: "include",
        });
        const data = await res.json();
        if (cancelled) return;
        setReports(data);
        if (switchedUser) {
          setListQuery("");
          setOutcomeFilter("all");
          setListPageRaw(1);
        }
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [users, selectedUserId]);

  const handleUserClick = (user: User) => {
    void navigate(adminUserAnalyticsHref(user.id));
  };

  const filteredUsers = useMemo(() => {
    const q = userSearchQuery.trim().toLowerCase();
    if (q.length === 0) return users;
    return users.filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  }, [users, userSearchQuery]);

  const analytics = useMemo(() => computeUserReportAnalytics(reports), [reports]);
  const trendData = useMemo(() => buildPassFailTrendData(reports), [reports]);
  const recentActivityLabel = useMemo(() => {
    if (analytics.mostRecentActivity) {
      return analytics.mostRecentActivity.toLocaleString();
    }
    if (analytics.totalReports === 0) {
      return t("adminReportsNoActivityYet");
    }
    return "—";
  }, [analytics.mostRecentActivity, analytics.totalReports, t]);

  const filteredReports = useMemo(() => {
    const q = listQuery.trim().toLowerCase();
    return reports.filter((r) => {
      if (q.length > 0 && !r.fileName.toLowerCase().includes(q)) {
        return false;
      }
      if (outcomeFilter === "passed" && !r.passedQC) {
        return false;
      }
      if (outcomeFilter === "failed" && r.passedQC) {
        return false;
      }
      return true;
    });
  }, [reports, listQuery, outcomeFilter]);

  const listPassCount = useMemo(
    () => filteredReports.filter((r) => r.passedQC).length,
    [filteredReports],
  );
  const listFailCount = filteredReports.length - listPassCount;

  const listTotalPages = Math.max(1, Math.ceil(filteredReports.length / REPORT_LIST_PAGE_SIZE));

  const listPageSafe = Math.min(Math.max(1, listPageRaw), listTotalPages);
  const listPageOffset = (listPageSafe - 1) * REPORT_LIST_PAGE_SIZE;
  const paginatedReports = filteredReports.slice(listPageOffset, listPageOffset + REPORT_LIST_PAGE_SIZE);
  const listRangeStart = filteredReports.length === 0 ? 0 : listPageOffset + 1;
  const listRangeEnd = filteredReports.length === 0 ? 0 : listPageOffset + paginatedReports.length;

  const getMedal = (index: number) => { // Gives visual ranking indicators for the top users.
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return `#${index + 1}`;
  };

  const leaderboardRowClass = (index: number) => {
    if (index === 0) return "border-amber-500/40 bg-amber-500/10";
    if (index === 1) return "border-border bg-muted/40";
    if (index === 2) return "border-orange-500/35 bg-orange-500/10";
    return "border-border bg-card";
  };

  const statTile = (title: string, value: string, helper?: string) => (
    <div className="rounded-lg border border-border bg-muted/30 p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="mt-2 text-2xl font-bold text-card-foreground">{value}</p>
      {helper ? <p className="mt-1 text-xs text-muted-foreground">{helper}</p> : null}
    </div>
  );

  return (
    <div className="min-h-screen bg-background px-4 py-6 text-foreground md:px-8">
      <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-3">
        <section className="self-start rounded-xl border-2 border-border bg-card p-4 shadow-sm md:p-5">
          <h2 className="mb-3 text-lg font-semibold text-card-foreground">{t("users")}</h2>
          <Input
            type="search"
            value={userSearchQuery}
            onChange={(e) => setUserSearchQuery(e.target.value)}
            placeholder={t("adminReportsUserSearchPlaceholder")}
            className="mb-3"
            aria-label={t("adminReportsUserSearchPlaceholder")}
          />
          <div className="max-h-[min(70vh,32rem)] space-y-2 overflow-y-auto pr-1">
            {filteredUsers.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">{t("adminReportsUserListNoMatches")}</p>
            ) : (
              filteredUsers.map((u) => {
                const isSelected = selectedUser?.id === u.id || selectedUserId === u.id;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleUserClick(u)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring ${
                      isSelected
                        ? "border-primary bg-muted ring-1 ring-ring"
                        : "border-border bg-card hover:bg-muted/60"
                    }`}
                  >
                    <p className="font-medium text-card-foreground">{u.name}</p>
                    <p className="text-sm text-muted-foreground">{u.email}</p>
                  </button>
                );
              })
            )}
          </div>
        </section>

        <section className="rounded-xl border-2 border-border bg-card p-4 shadow-sm md:col-span-2 md:p-5">
          <Button
            type="button"
            variant="secondary"
            size="default"
            onClick={() => {
              sessionStorage.setItem("ligtas-next-dashboard-view", "users");
              void navigate("/", { replace: false });
            }}
            className="mb-6 inline-flex h-auto min-h-10 w-full flex-wrap items-center justify-center gap-2 border-2 border-border bg-muted/80 px-4 py-2.5 text-sm font-semibold text-foreground shadow-md transition-colors hover:bg-muted sm:w-auto"
          >
            <ArrowLeft className="size-4 shrink-0 opacity-90" aria-hidden />
            {t("adminReportsBackToUserManagement")}
          </Button>
          <h2 className="mb-1 text-lg font-semibold text-card-foreground">
            {selectedUser ? selectedUser.name : t("adminReportsSelectUser")}
          </h2>
          {selectedUser ? (
            <p className="mb-6 text-sm text-muted-foreground">{t("adminReportsAnalyticsProfile")}</p>
          ) : (
            <p className="mb-6 text-sm text-muted-foreground">{t("adminReportsSelectUser")}</p>
          )}

          {selectedUser && (
            <>
              <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {statTile(t("adminReportsTotalReports"), String(analytics.totalReports))}
                {statTile(t("adminReportsPassRate"), formatPercent(analytics.passRatePercent))}
                {statTile(t("adminReportsFailRate"), formatPercent(analytics.failRatePercent))}
                {statTile(
                  t("adminReportsAverageScore"),
                  analytics.averageScore == null ? "—" : `${analytics.averageScore}%`,
                  t("adminReportsAverageScoreHint"),
                )}
                {statTile(t("adminReportsMostRecentActivity"), recentActivityLabel)}
              </div>

              <div className="mb-8 rounded-lg border border-border bg-muted/20 p-4">
                <h3 className="text-base font-semibold text-card-foreground">
                  {t("adminReportsPassFailTrendTitle")}
                </h3>
                <p className="mb-4 text-xs text-muted-foreground">{t("adminReportsPassFailTrendSubtitle")}</p>
                {trendData.length === 0 ? (
                  <div className="flex h-[280px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-sm text-muted-foreground">
                    {t("adminReportsChartEmpty")}
                  </div>
                ) : (
                  <div className="h-[300px] w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke={LIGTAS_CHART.gridStroke} vertical={false} />
                        <XAxis dataKey="label" tick={LIGTAS_CHART.axisTick} tickMargin={8} />
                        <YAxis allowDecimals={false} tick={LIGTAS_CHART.axisTick} width={36} />
                        <Tooltip
                          contentStyle={LIGTAS_CHART.tooltip.contentStyle}
                          wrapperStyle={LIGTAS_CHART.tooltip.wrapperStyle}
                          labelFormatter={(_, payload) => {
                            const row = (payload?.[0]?.payload ?? undefined) as TrendRow | undefined;
                            return row?.dateFull ?? "";
                          }}
                        />
                        <Legend />
                        <Bar
                          dataKey="passed"
                          name={t("adminReportsChartPassed")}
                          stackId="qc"
                          fill="rgb(16 185 129)"
                          radius={[0, 0, 0, 0]}
                        />
                        <Bar
                          dataKey="failed"
                          name={t("adminReportsChartFailed")}
                          stackId="qc"
                          fill="rgb(239 68 68)"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="mb-4 flex flex-col gap-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("adminReportsAllReportsTitle")}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full border border-emerald-700/40 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-900 dark:border-emerald-600 dark:text-emerald-200">
                        {listPassCount} {t("passed")}
                      </span>
                      <span className="inline-flex items-center rounded-full border border-red-800/40 bg-destructive/10 px-2.5 py-0.5 text-xs font-semibold text-destructive dark:border-red-700 dark:text-red-200">
                        {listFailCount} {t("failed")}
                      </span>
                    </div>
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:max-w-xl lg:justify-end">
                    <Input
                      type="search"
                      value={listQuery}
                      onChange={(e) => {
                        setListQuery(e.target.value);
                        setListPageRaw(1);
                      }}
                      placeholder={t("adminReportsListSearchPlaceholder")}
                      className="sm:min-w-[200px] sm:flex-1"
                      aria-label={t("searchReports")}
                    />
                    <div className="flex shrink-0 flex-wrap gap-1 rounded-md border border-border bg-muted/40 p-1">
                      <Button
                        type="button"
                        size="sm"
                        variant={outcomeFilter === "all" ? "default" : "ghost"}
                        className="h-8 px-3"
                        onClick={() => {
                          setOutcomeFilter("all");
                          setListPageRaw(1);
                        }}
                      >
                        {t("adminReportsListFilterAll")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={outcomeFilter === "passed" ? "default" : "ghost"}
                        className="h-8 px-3"
                        onClick={() => {
                          setOutcomeFilter("passed");
                          setListPageRaw(1);
                        }}
                      >
                        {t("passed")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={outcomeFilter === "failed" ? "default" : "ghost"}
                        className="h-8 px-3"
                        onClick={() => {
                          setOutcomeFilter("failed");
                          setListPageRaw(1);
                        }}
                      >
                        {t("failed")}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="space-y-3">
            {selectedUser == null && (
              <p className="text-sm text-muted-foreground">{t("adminReportsSelectUser")}</p>
            )}
            {selectedUser != null && reports.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("adminReportsNoReportsForUser")}</p>
            )}
            {selectedUser != null && reports.length > 0 && filteredReports.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("adminReportsListNoMatches")}</p>
            )}
            {selectedUser != null &&
              reports.length > 0 &&
              filteredReports.length > 0 &&
              paginatedReports.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-card-foreground">{r.fileName}</p>
                    <p className="text-sm text-muted-foreground">{new Date(r.uploadedAt).toLocaleString()}</p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${
                      r.passedQC
                        ? "border-emerald-700/40 bg-emerald-500/10 text-emerald-900 dark:border-emerald-600 dark:text-emerald-200"
                        : "border-red-800/40 bg-destructive/10 text-destructive dark:border-red-700 dark:text-red-200"
                    }`}
                  >
                    {r.passedQC ? t("passed") : t("failed")}
                  </span>
                </div>
              ))}
            {selectedUser != null && reports.length > 0 && filteredReports.length > 0 && (
              <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  {t("showing")} {listRangeStart}–{listRangeEnd} {t("of")} {filteredReports.length}
                  {listTotalPages > 1 ? (
                    <>
                      {" · "}
                      {t("page")} {listPageSafe} {t("of")} {listTotalPages}
                    </>
                  ) : null}
                </p>
                {listTotalPages > 1 ? (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={listPageSafe <= 1}
                      onClick={() => {
                        setListPageRaw((p) => {
                          const maxP = Math.max(
                            1,
                            Math.ceil(filteredReports.length / REPORT_LIST_PAGE_SIZE),
                          );
                          const clamped = Math.min(Math.max(1, p), maxP);
                          return Math.max(1, clamped - 1);
                        });
                      }}
                    >
                      {t("adminReportsPaginationPrevious")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={listPageSafe >= listTotalPages}
                      onClick={() => {
                        setListPageRaw((p) => {
                          const maxP = Math.max(
                            1,
                            Math.ceil(filteredReports.length / REPORT_LIST_PAGE_SIZE),
                          );
                          const clamped = Math.min(Math.max(1, p), maxP);
                          return Math.min(maxP, clamped + 1);
                        });
                      }}
                    >
                      {t("next")}
                    </Button>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="mx-auto mt-6 max-w-7xl">
        <section className="rounded-xl border-2 border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-card-foreground">🏆 User Quality Leaderboard</h2>
          <div className="space-y-3">
            {leaderboard.map((user, index) => (
              <div
                key={user.userId}
                className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${leaderboardRowClass(index)}`}
              >
                <div className="flex min-w-0 items-center gap-4">
                  <span className="text-2xl" aria-hidden>
                    {getMedal(index)}
                  </span>
                  <div>
                    <p className="font-semibold text-card-foreground">{user.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Reports: {user.totalReports} | Avg Issues: {user.averageIssues}
                    </p>
                  </div>
                </div>
                {user.score > 0 && (
                  <span className="inline-flex shrink-0 rounded-md border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-foreground">
                    {user.score}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
