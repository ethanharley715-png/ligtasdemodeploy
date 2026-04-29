import { useEffect, useMemo, useState } from "react";
import { History } from "lucide-react";
import { Link } from "react-router-dom";
import { AdminUserProfileLink } from "../admin/AdminUserProfileLink";
import { reportsApi, type ReportListItem } from "../../services/api";
import { useLanguage } from "../../context/useLanguage";
import { Chip, IconButton, Menu, MenuItem } from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";

interface ReportHistoryViewProps {
  readonly userRole: "admin" | "team_manager" | "consultant";
}

function TagRibbon({ status }: { status: number }) {
  if (status === 1) {
    return (
      <span className="inline-block px-3 py-1.5 text-xs font-bold text-yellow-900 bg-yellow-400 rounded-md shadow-sm">
        TO DO
      </span>
    );
  }

  if (status === 2) {
    return (
      <span className="inline-block px-3 py-1.5 text-xs font-bold text-white bg-green-500 rounded-md shadow-sm">
        EDITED
      </span>
    );
  }

  return (
    <MoreVertIcon fontSize="small" className="text-slate-600 dark:text-white" />
  );
}

export function ReportHistoryView({ userRole }: ReportHistoryViewProps) {
  const { t } = useLanguage();
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tagFilter, setTagFilter] = useState<number | "all">("all");
  const [selectedDate, setSelectedDate] = useState("");
  const [analystFilter, setAnalystFilter] = useState("all");

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, reportId: string) => {
    setAnchorEl(event.currentTarget);
    setSelectedReportId(reportId);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedReportId(null);
  };

  async function handleTagUpdate(reportId: string, tagStatus: number) {
    try {
      // Persist tag changes so report history stays consistent after refresh or on another device.
      const updated = await reportsApi.updateTagStatus(reportId, tagStatus);

      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, tagStatus: updated.tagStatus } : r)),
      );

      handleMenuClose();
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadReports() {
      try {
        setLoading(true);
        setError("");
        const data = await reportsApi.list();

        if (!cancelled) {
          setReports(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t("failedToLoadReports"));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadReports();

    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    if (userRole !== "admin") {
      setAnalystFilter("all");
    }
  }, [userRole]);

  function formatStatus(status: ReportListItem["status"]) {
    if (status === "passed") return t("passed");
    if (status === "failed") return t("failed");
    return t("processing");
  }

  function statusClasses(status: ReportListItem["status"]) {
    if (status === "passed") {
      return "border border-emerald-500/35 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100";
    }
    if (status === "failed") {
      return "border border-destructive/40 bg-destructive/10 text-destructive";
    }
    return "border border-border bg-muted/50 text-muted-foreground";
  }

  function reportDateKey(uploadDate: string) {
    const date = new Date(uploadDate);
    if (Number.isNaN(date.getTime())) return "";

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function analystKey(report: ReportListItem) {
    return report.analystUserId != null ? String(report.analystUserId) : report.analyst;
  }

  const analystOptions = useMemo(() => {
    const analysts = new Map<string, string>();

    reports.forEach((report) => {
      const key = analystKey(report);
      if (key && !analysts.has(key)) {
        analysts.set(key, report.analyst);
      }
    });

    return Array.from(analysts, ([value, label]) => ({ value, label })).sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  }, [reports]);

  const filteredReports = reports.filter((report) => {
    if (tagFilter !== "all" && report.tagStatus !== tagFilter) return false;

    const uploadedDate = reportDateKey(report.uploadDate);
    if (selectedDate && uploadedDate !== selectedDate) return false;

    if (userRole === "admin" && analystFilter !== "all" && analystKey(report) !== analystFilter) {
      return false;
    }

    return true;
  });

  const filtersActive =
    tagFilter !== "all" || selectedDate !== "" || analystFilter !== "all";

  function clearFilters() {
    setTagFilter("all");
    setSelectedDate("");
    setAnalystFilter("all");
  }


  return (
    <div className="min-h-full p-8">
      <div className="mb-8">
        <h1 className="mb-2 text-4xl font-bold text-foreground">{t("reportHistoryTitle")}</h1>
        <p className="text-lg text-muted-foreground">
          {t("reportHistoryDescriptionLong")}
        </p>
      </div>

      <div className="ligtas-surface-card-sm rounded-2xl shadow-sm">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">{t("allReports")}</h2>
        </div>

        <div className="flex flex-wrap gap-2 px-6 py-4">
          <Chip
            label="All"
            clickable
            onClick={() => setTagFilter("all")}
            sx={{
              bgcolor: tagFilter === "all" ? "#4b5563" : "#9ca3af",
              color: "#fff",
              fontWeight: "bold",
            }}
          />

          <Chip
            label="To Do"
            clickable
            onClick={() => setTagFilter(1)}
            sx={{
              bgcolor: tagFilter === 1 ? "#eab308" : "#facc15",
              color: "#000",
              fontWeight: "bold",
            }}
          />

          <Chip
            label="Edited"
            clickable
            onClick={() => setTagFilter(2)}
            sx={{
              bgcolor: tagFilter === 2 ? "#16a34a" : "#22c55e",
              color: "#fff",
              fontWeight: "bold",
            }}
          />

          <Chip
            label="No Tag"
            clickable
            onClick={() => setTagFilter(0)}
            sx={{
              bgcolor: tagFilter === 0 ? "#4b5563" : "#9ca3af",
              color: "#fff",
              fontWeight: "bold",
            }}
          />
        </div>

        <div className="flex flex-wrap items-end gap-3 border-t border-border px-6 py-4">
          <label className="flex min-w-44 flex-col gap-1 text-sm font-medium text-foreground">
            Upload date
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </label>

          {userRole === "admin" && (
            <label className="flex min-w-64 flex-col gap-1 text-sm font-medium text-foreground">
              Analyst
              <select
                value={analystFilter}
                onChange={(event) => setAnalystFilter(event.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              >
                <option value="all">All analysts</option>
                {analystOptions.map((analyst) => (
                  <option key={analyst.value} value={analyst.value}>
                    {analyst.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <button
            type="button"
            onClick={clearFilters}
            disabled={!filtersActive}
            className="h-10 rounded-md border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            Clear filters
          </button>

          {!loading && !error && reports.length > 0 && (
            <p className="ml-auto text-sm text-muted-foreground">
              Showing {filteredReports.length} of {reports.length} reports
            </p>
          )}
        </div>

        {loading ? (
          <div className="px-6 py-10 text-center text-muted-foreground">{t("loadingReports")}</div>
        ) : error ? (
          <div className="px-6 py-10 text-center text-destructive">{error}</div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <History className="mb-4 size-16 text-muted-foreground/50" />
            <p className="text-lg text-muted-foreground">{t("noReportsFound")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/40">
                <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Set Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("report")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("analyst")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("uploaded")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("issues")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("status")}
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border bg-card">
                {filteredReports.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-sm text-muted-foreground">
                      No reports match the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredReports.map((report) => (
                    <tr key={report.id} className="transition-colors hover:bg-muted/40">
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        <div className="flex items-center justify-between gap-2">
                          <IconButton
                            size="small"
                            onClick={(e) => handleMenuOpen(e, report.id)}
                          >
                            <TagRibbon status={report.tagStatus} />
                          </IconButton>

                          <Menu
                            anchorEl={anchorEl}
                            open={selectedReportId === report.id}
                            onClose={handleMenuClose}
                          >
                            <MenuItem onClick={() => handleTagUpdate(report.id, 1)}>
                              <Chip label="To Do" size="small" sx={{ bgcolor: "#facc15" }} />
                            </MenuItem>

                            <MenuItem onClick={() => handleTagUpdate(report.id, 2)}>
                              <Chip
                                label="Edited"
                                size="small"
                                sx={{ bgcolor: "#22c55e", color: "#fff" }}
                              />
                            </MenuItem>

                            <MenuItem onClick={() => handleTagUpdate(report.id, 0)}>
                              <Chip
                                label="No Tag"
                                size="small"
                                sx={{ bgcolor: "gray", color: "#fff" }}
                              />
                            </MenuItem>
                          </Menu>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          to={`/reports/${report.id}`}
                          className="font-medium text-primary underline-offset-2 hover:underline"
                        >
                          {report.fileName}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        <AdminUserProfileLink
                          userId={report.analystUserId}
                          isAdmin={userRole === "admin"}
                          className={
                            userRole === "admin"
                              ? "font-medium text-primary underline-offset-2 hover:underline"
                              : "text-muted-foreground"
                          }
                        >
                          {report.analyst}
                        </AdminUserProfileLink>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {new Date(report.uploadDate).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{report.issuesFound}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${statusClasses(report.status)}`}
                        >
                          {formatStatus(report.status)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
