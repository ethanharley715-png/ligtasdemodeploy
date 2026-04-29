/**
 * ReportDetailPage.tsx:
 * Displays detailed report data and integrates QCResultsview for a more structured visualisation.
 * The design decisions I took included the following:
 * . A backend report format which is then converted into a UI friendly structure for reuse in QCResultsView.
 * . Seperation of certain concerns allow for the backend schema to decouple from the frontend components.
 * 
 * Overall this improves maintainability and makes sure the UI components to remain consistent regardless
 * if the backend models change.
*/

import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AdminUserProfileLink } from "../components/admin/AdminUserProfileLink";
import { toast } from "sonner";

import IssueList from "../components/IssueList";
import type { AttachedPdfReviewIssue } from "../components/reports/AttachedPdfReviewPanel";
import { AttachedPdfReviewDialog } from "../components/reports/AttachedPdfReviewDialog";
import { ExportResultsDialog } from "../components/reports/ExportResultsDialog";
import type { IssueReviewStatus } from "../components/reports/issueReviewStatus";
import { useColourBlindMode } from "../hooks/useColourBlindMode";
import { authApi, reportsApi, type ReportDetail, type ReportExportFormat } from "../services/api";
import { buildAnnotatedPdfExport } from "../utils/annotatedPdfExport";

type SortOption = "type-asc" | "type-desc" | "location-asc" | "location-desc";

function formatIssueType(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function formatProcessingTime(seconds: number | null | undefined) {
  if (seconds == null) return "—";

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="ligtas-surface-card-sm rounded-xl p-4 shadow-sm">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 break-words text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-3 last:border-b-0">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className="break-words text-right text-sm text-foreground">{value}</span>
    </div>
  );
}

function BackToReportsButton({ onBack }: Readonly<{ onBack: () => void }>) {
  return (
    <button
      type="button"
      onClick={onBack}
      aria-label="Back to Reports"
      title="Return to report history"
      className="inline-flex items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-sm font-medium text-foreground transition hover:border-border hover:bg-muted/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
      Back to Reports
    </button>
  );
}

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const colourBlind = useColourBlindMode();

  const [report, setReport] = useState<ReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportDialogKey, setExportDialogKey] = useState(0);
  const [loadingExportFormat, setLoadingExportFormat] = useState<ReportExportFormat | null>(null);
  const [loadingAnnotatedExport, setLoadingAnnotatedExport] = useState(false);
  const [pdfReviewOpen, setPdfReviewOpen] = useState(false);
  const [updatingIssueId, setUpdatingIssueId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("All");
  const [pageFilter, setPageFilter] = useState<string>("All");
  const [reviewFilter, setReviewFilter] = useState<"All" | IssueReviewStatus>("All");
  const [sortBy, setSortBy] = useState<SortOption>("location-asc");
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [viewerIsAdmin, setViewerIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void authApi
      .me()
      .then((me) => {
        if (!cancelled) {
          setViewerIsAdmin(me.role === "admin");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setViewerIsAdmin(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!id) {
      setError("Report ID is missing.");
      setLoading(false);
      return;
    }

    const reportId = id;
    let cancelled = false;

    async function loadReport() {
      try {
        setLoading(true);
        setError(null);

        const data = await reportsApi.get(reportId);

        if (!cancelled) {
          setReport(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load report");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadReport();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const issueTypes = useMemo(() => {
    const types = new Set(report?.issues.map((issue) => issue.type) ?? []);
    return ["All", ...Array.from(types).sort((a, b) => a.localeCompare(b))];
  }, [report]);

  const pageOptions = useMemo(() => {
    const pages = new Set(
      report?.issues
        .map((issue) => issue.pageNumber)
        .filter((page): page is number => page != null) ?? [],
    );

    return ["All", ...Array.from(pages).sort((a, b) => a - b).map(String)];
  }, [report]);

  const visibleIssues = useMemo(() => {
    if (!report) return [];

    return [...report.issues]
      .filter((issue) => {
        const matchesType = typeFilter === "All" || issue.type === typeFilter;
        const matchesPage = pageFilter === "All" || String(issue.pageNumber ?? "") === pageFilter;
        const matchesReview = reviewFilter === "All" || issue.reviewStatus === reviewFilter;
        return matchesType && matchesPage && matchesReview;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "type-asc":
            return a.type.localeCompare(b.type);
          case "type-desc":
            return b.type.localeCompare(a.type);
          case "location-asc": {
            const aLocation = `${String(a.pageNumber ?? 99999).padStart(5, "0")}-${a.location ?? ""}`;
            const bLocation = `${String(b.pageNumber ?? 99999).padStart(5, "0")}-${b.location ?? ""}`;
            return aLocation.localeCompare(bLocation);
          }
          case "location-desc": {
            const aLocation = `${String(a.pageNumber ?? 99999).padStart(5, "0")}-${a.location ?? ""}`;
            const bLocation = `${String(b.pageNumber ?? 99999).padStart(5, "0")}-${b.location ?? ""}`;
            return bLocation.localeCompare(aLocation);
          }
          default:
            return 0;
        }
      });
  }, [report, typeFilter, pageFilter, reviewFilter, sortBy]);

  const issueBreakdown = useMemo(() => {
    if (!report) return [];

    const counts = report.issues.reduce<Record<string, number>>((acc, issue) => {
      acc[issue.type] = (acc[issue.type] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [report]);

  function downloadBlob(blob: Blob, fileName: string) {
    const objectUrl = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  }

  async function handleExport(format: ReportExportFormat) {
    if (!report) return;

    try {
      setLoadingExportFormat(format);
      const file = await reportsApi.exportResult(report.id, format);
      downloadBlob(file.blob, file.fileName);

      toast.success(`${format.toUpperCase()} export ready`, {
        description: `${file.fileName} has been generated.`,
      });

      setExportOpen(false);
    } catch (err) {
      toast.error("Export failed", {
        description: err instanceof Error ? err.message : "Unable to export this report.",
      });
    } finally {
      setLoadingExportFormat(null);
    }
  }

  async function handleAnnotatedPdfExport(sourcePdf: File) {
    if (!report) return;

    try {
      setLoadingAnnotatedExport(true);
      const annotatedExport = await buildAnnotatedPdfExport({
        sourceFile: sourcePdf,
        reportId: report.id,
        reportFileName: report.fileName,
        issues: report.issues,
      });

      downloadBlob(annotatedExport.blob, annotatedExport.fileName);

      toast.success("Annotated PDF export ready", {
        description: `${annotatedExport.fileName} was generated locally with ${annotatedExport.annotatedIssueCount} on-page issue annotations.`,
      });

      setExportOpen(false);
    } catch (err) {
      toast.error("Annotated PDF export failed", {
        description: err instanceof Error ? err.message : "Unable to annotate this PDF.",
      });
    } finally {
      setLoadingAnnotatedExport(false);
    }
  }

  async function handleIssueReviewStatusChange(issueId: string, status: IssueReviewStatus) {
    if (!report) return;

    const previous = report;
    const reviewedAt = status === "OPEN" ? null : new Date().toISOString();

    // Optimistically update the issue card, then restore the previous report if persistence fails.
    setUpdatingIssueId(issueId);
    setReport({
      ...report,
      issues: report.issues.map((issue) => // Maps the backend issue fields into the standardised UI format with enforced severity typing.
        issue.id === issueId
          ? {
              ...issue,
              reviewStatus: status,
              reviewedAt,
            }
          : issue,
      ),
    });

    try {
      const updated = await reportsApi.updateIssueReviewStatus(issueId, status);

      setReport((current) =>
        current
          ? {
              ...current,
              issues: current.issues.map((issue) =>
                issue.id === issueId
                  ? {
                      ...issue,
                      reviewStatus: updated.reviewStatus,
                      reviewedAt: updated.reviewedAt,
                    }
                  : issue,
              ),
            }
          : current,
      );
    } catch (err) {
      setReport(previous);
      toast.error("Failed to update issue", {
        description: err instanceof Error ? err.message : "Issue review status could not be updated.",
      });
    } finally {
      setUpdatingIssueId(null);
    }
  }

  function handleIssueSelect(issue: AttachedPdfReviewIssue) {
    setSelectedIssueId(issue.id);
    if (issue.pageNumber != null) {
      setPageFilter(String(issue.pageNumber));
    }
  }

  function handleViewerPageFocus(page: number) {
    setPageFilter(String(page));
    setSelectedIssueId(null);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-7xl space-y-4">
          <BackToReportsButton onBack={() => navigate("/reports")} />
          <div className="ligtas-surface-card-sm rounded-xl p-8 shadow-sm">
            <p className="text-sm text-muted-foreground">Loading report...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-7xl space-y-4">
          <BackToReportsButton onBack={() => navigate("/reports")} />
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-destructive shadow-sm">
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-7xl space-y-4">
          <BackToReportsButton onBack={() => navigate("/reports")} />
          <div className="ligtas-surface-card-sm rounded-xl p-6 text-card-foreground shadow-sm">
            Report not found.
          </div>
        </div>
      </div>
    );
  }

  const isCompleted = report.status === "COMPLETED";

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="ligtas-surface-card-sm rounded-2xl p-6 shadow-sm">
          <div className="mb-4 flex justify-start">
            <BackToReportsButton onBack={() => navigate("/reports")} />
          </div>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                QC Report
              </p>
              <h1 className="mt-1 break-words text-3xl font-semibold text-foreground">
                {report.fileName}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Review QC findings, filter flagged issues, and export the final results.
              </p>
            </div>

            <div className="flex flex-col items-start gap-3 lg:items-end">
              <span
                className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${
                  colourBlind
                    ? report.passedQC
                      ? "border-2 border-solid border-blue-700 bg-blue-50 text-blue-900 dark:border-blue-400 dark:bg-blue-950/50 dark:text-blue-100"
                      : "border-2 border-dashed border-amber-700 bg-amber-50 text-amber-900 dark:border-amber-500 dark:bg-amber-950/50 dark:text-amber-100"
                    : report.passedQC
                      ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                      : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                }`}
              >
                {colourBlind
                  ? report.passedQC
                    ? "? Passed QC"
                    : "? Failed"
                  : report.passedQC
                    ? "Passed QC"
                    : "Failed"}
              </span>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPdfReviewOpen(true)}
                  className="ligtas-btn-outline rounded-lg px-4 py-2 text-sm font-semibold"
                >
                  Open PDF review
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setExportDialogKey((current) => current + 1);
                    setExportOpen(true);
                  }}
                  disabled={!isCompleted}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Export results
                </button>
              </div>

              {!isCompleted && (
                <p className="text-xs text-muted-foreground">
                  Export becomes available once QC analysis is complete.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Issues" value={report.totalIssues} />
          <StatCard label="Issue Types" value={issueBreakdown.length} />
          <StatCard label="Status" value={report.status} />
          <StatCard
            label="Processing Time"
            value={formatProcessingTime(report.processingTimeSeconds)}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <div className="ligtas-surface-card-sm rounded-2xl p-5 shadow-sm">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-foreground">Issues</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Showing {visibleIssues.length} of {report.issues.length} issues
                </p>
              </div>

              <div className="grid gap-4 border-b border-border pb-5 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    Filter by type
                  </label>
                  <select
                    className="ligtas-input w-full"
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                  >
                    {issueTypes.map((type) => (
                      <option key={type} value={type}>
                        {type === "All" ? "All issue types" : formatIssueType(type)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    Filter by page
                  </label>
                  <select
                    className="ligtas-input w-full"
                    value={pageFilter}
                    onChange={(e) => setPageFilter(e.target.value)}
                  >
                    {pageOptions.map((page) => (
                      <option key={page} value={page}>
                        {page === "All" ? "All pages" : `Page ${page}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    Review status
                  </label>
                  <select
                    className="ligtas-input w-full"
                    value={reviewFilter}
                    onChange={(e) => setReviewFilter(e.target.value as "All" | IssueReviewStatus)}
                  >
                    <option value="All">All review statuses</option>
                    <option value="OPEN">Open</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="FALSE_POSITIVE">False positives</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    Sort by
                  </label>
                  <select
                    className="ligtas-input w-full"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                  >
                    <option value="location-asc">Location: Earliest first</option>
                    <option value="location-desc">Location: Latest first</option>
                    <option value="type-asc">Type: A to Z</option>
                    <option value="type-desc">Type: Z to A</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setTypeFilter("All");
                    setPageFilter("All");
                    setReviewFilter("All");
                    setSortBy("location-asc");
                    setSelectedIssueId(null);
                  }}
                  className="ligtas-btn-outline rounded-lg px-4 py-2 text-sm font-medium"
                >
                  Clear filters
                </button>
              </div>

              <div className="mt-5">
                {visibleIssues.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
                    <h3 className="text-base font-semibold text-foreground">No matching issues</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Try changing the selected filters to view more results.
                    </p>
                  </div>
                ) : (
                  <IssueList
                    issues={visibleIssues}
                    onSelectIssue={handleIssueSelect}
                    selectedIssueId={selectedIssueId}
                    onChangeIssueReviewStatus={handleIssueReviewStatusChange}
                    busyIssueId={updatingIssueId}
                  />
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="ligtas-surface-card-sm rounded-2xl p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-foreground">Report Details</h2>
              <div className="mt-4">
                <div className="flex items-start justify-between gap-4 border-b border-border py-3 last:border-b-0">
                  <span className="text-sm font-medium text-muted-foreground">Analyst</span>
                  <span className="break-words text-right text-sm text-foreground">
                    <AdminUserProfileLink
                      userId={report.analystUserId}
                      isAdmin={viewerIsAdmin}
                      className={
                        viewerIsAdmin
                          ? "font-medium text-primary underline-offset-2 hover:underline"
                          : "text-foreground"
                      }
                    >
                      {report.analyst || "—"}
                    </AdminUserProfileLink>
                  </span>
                </div>
                <InfoRow label="Uploaded" value={formatDateTime(report.uploadedAt)} />
                <InfoRow label="Analyzed" value={formatDateTime(report.analyzedAt)} />
                <InfoRow label="File Name" value={report.fileName} />
              </div>
            </div>

            <div className="ligtas-surface-card-sm rounded-2xl p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-foreground">Breakdown by Issue Type</h2>

              <div className="mt-4 space-y-3">
                {issueBreakdown.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No issues recorded for this report.</p>
                ) : (
                  issueBreakdown.map(([type, count]) => {
                    const percentage = report.issues.length > 0 ? Math.round((count / report.issues.length) * 100) : 0;

                    return (
                      <div key={type} className="space-y-1">
                        <div className="flex items-center justify-between gap-4 text-sm">
                          <span className="font-medium text-foreground">
                            {formatIssueType(type)}
                          </span>
                          <span className="text-muted-foreground">
                            {count} ({percentage}%)
                          </span>
                        </div>

                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        <ExportResultsDialog
          key={exportDialogKey}
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          onExport={handleExport}
          reportId={report.id}
          fileName={report.fileName}
          isExportable={isCompleted}
          loadingFormat={loadingExportFormat}
          loadingAnnotatedExport={loadingAnnotatedExport}
          onAnnotatedPdfExport={handleAnnotatedPdfExport}
        />
        <AttachedPdfReviewDialog
          open={pdfReviewOpen}
          onClose={() => setPdfReviewOpen(false)}
          issues={report.issues}
          selectedIssueId={selectedIssueId}
          onSelectIssue={handleIssueSelect}
          onFocusPage={handleViewerPageFocus}
          onChangeIssueReviewStatus={handleIssueReviewStatusChange}
          busyIssueId={updatingIssueId}
        />
      </div>
    </div>
  );
}
