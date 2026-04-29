import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  type SelectChangeEvent,
} from "@mui/material";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Flag } from "lucide-react";
import { toast } from "sonner";

import { AttachedPdfReviewDialog } from "../reports/AttachedPdfReviewDialog";
import type { IssueReviewStatus } from "../reports/issueReviewStatus";
import { useColourBlindMode } from "../../hooks/useColourBlindMode";
import { useIsDarkMode } from "../../hooks/useIsDarkMode";
import { type QCReport, type QCIssue } from "../types/qc";
import { AdminUserProfileLink } from "../admin/AdminUserProfileLink";
import { reportsApi, type ReportDetail } from "../../services/api";
import { useLanguage } from "../../context/useLanguage";
import type { TranslationKey } from "../../i18n/translations";
interface Props {
  report: QCReport;
  readonly reportId: string | null;
  readonly fileName: string | null;
  readonly viewerRole?: "admin" | "team_manager" | "consultant";
}

type SortOption = "type-asc" | "type-desc" | "location-asc" | "location-desc";

const formatIssueType = (value: string) =>
  value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const formatIssueLocation = (location: string | null | undefined, pageNumber: number | null | undefined) => {
  const trimmedLocation = location?.trim() ?? "";

  if (!trimmedLocation) {
    return pageNumber != null ? `Page ${pageNumber}` : "";
  }

  if (pageNumber == null) {
    return trimmedLocation;
  }

  const withoutLeadingPage = trimmedLocation.replace(/^Page\s+\d+\s*-\s*/i, "");
  return `Page ${pageNumber} - ${withoutLeadingPage}`;
};

function StatCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
}) {
  return (
    <Card
      variant="outlined"
      sx={{ borderRadius: 3, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
    >
      <CardContent sx={{ py: 3, textAlign: "center" }}>
        <Typography variant="h4" fontWeight={700}>
          {value}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
            {subtitle}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "space-between",
        gap: 2,
        py: 1.5,
        flexWrap: "wrap",
      }}
    >
      <Typography variant="body2" color="text.secondary" fontWeight={500}>
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={500}>
        {value}
      </Typography>
    </Box>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.75 }}>
      {children}
    </Typography>
  );
}

function PassFailChip({ passed, colourBlind }: { passed: boolean; colourBlind: boolean }) {
  const { t } = useLanguage();

  if (colourBlind) {
    return (
      <Chip
        label={passed ? `✓ ${t("passUpper")}` : `✕ ${t("failUpper")}`}
        variant="outlined"
        sx={{
          px: 1.5,
          py: 2.5,
          fontWeight: 800,
          borderRadius: 3,
          borderWidth: 3,
          borderStyle: passed ? "solid" : "dashed",
          borderColor: passed ? "#1d4ed8" : "#c2410c",
          color: passed ? "#1e3a8a" : "#9a3412",
          bgcolor: passed ? "rgba(29, 78, 216, 0.1)" : "rgba(194, 65, 12, 0.1)",
        }}
      />
    );
  }
  return (
    <Chip
      label={passed ? t("passUpper") : t("failUpper")}
      color={passed ? "success" : "error"}
      sx={{ px: 1.5, py: 2.5, fontWeight: 800, borderRadius: 3 }}
    />
  );
}

function formatIssueReviewStatus(
  status: IssueReviewStatus,
  t: (key: TranslationKey) => string,
) {
  switch (status) {
    case "COMPLETED":
      return t("completed");
    case "FALSE_POSITIVE":
      return t("falsePositiveTitle");
    default:
      return t("openCapitalized");
  }
}

function IssueItem({
  issue,
  busy,
  onChangeStatus,
}: {
  issue: QCIssue;
  busy?: boolean;
  onChangeStatus?: (status: IssueReviewStatus) => void;
}) {
  const { t } = useLanguage();
  const reviewStatus = issue.reviewStatus ?? "OPEN";
  const isFalsePositive = reviewStatus === "FALSE_POSITIVE";
  const falsePositiveFlagLabel = isFalsePositive
    ? "Remove false positive flag"
    : "Flag as false positive";

    console.log(issue);

  return (
    <Accordion
      disableGutters
      elevation={0}
      sx={{
        mb: 2,
        overflow: "hidden",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 3,
        bgcolor: "background.paper",
        "&:before": { display: "none" },
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        sx={{
          px: 3,
          py: 1.5,
          "&:hover": { backgroundColor: "action.hover" },
        }}
      >
        <Box sx={{ display: "flex", width: "100%", gap: 2, alignItems: "flex-start" }}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center", mb: 1 }}>
              <Chip
                size="small"
                label={formatIssueType(issue.type)}
                variant="outlined"
                sx={{ fontWeight: 600 }}
              />
              <Chip
                size="small"
                label={formatIssueReviewStatus(reviewStatus, t)}
                sx={{
                  fontWeight: 700,
                  bgcolor:
                    reviewStatus === "COMPLETED"
                      ? "rgba(16, 185, 129, 0.12)"
                      : reviewStatus === "FALSE_POSITIVE"
                        ? "rgba(245, 158, 11, 0.12)"
                        : "action.hover",
                  color:
                    reviewStatus === "COMPLETED"
                      ? "success.main"
                      : reviewStatus === "FALSE_POSITIVE"
                        ? "warning.main"
                        : "text.secondary",
                }}
              />
              {issue.location && (
                <Typography variant="body2" color="text.secondary">
                  {issue.location}
                </Typography>
              )}
            </Box>

            <Typography fontWeight={600}>{issue.message}</Typography>
          </Box>

          {onChangeStatus ? (
            <IconButton
              size="small"
              color="error"
              aria-label={falsePositiveFlagLabel}
              title={falsePositiveFlagLabel}
              aria-pressed={isFalsePositive}
              disabled={busy}
              onClick={(event) => {
                event.stopPropagation();
                onChangeStatus(isFalsePositive ? "OPEN" : "FALSE_POSITIVE");
              }}
              onKeyDown={(event) => {
                event.stopPropagation();
              }}
              sx={{
                flexShrink: 0,
                mt: 0.25,
                border: "1px solid",
                borderColor: isFalsePositive ? "error.main" : "rgba(239, 68, 68, 0.35)",
                bgcolor: isFalsePositive ? "rgba(239, 68, 68, 0.14)" : "transparent",
                color: "error.main",
                "&:hover": {
                  bgcolor: "rgba(239, 68, 68, 0.12)",
                  borderColor: "error.main",
                },
              }}
            >
              <Flag size={16} fill={isFalsePositive ? "currentColor" : "none"} />
            </IconButton>
          ) : null}
        </Box>
      </AccordionSummary>

      <AccordionDetails
        sx={{
          px: 3,
          py: 3,
          borderTop: "1px solid",
          borderColor: "divider",
          bgcolor: "action.hover",
        }}
      >
        <Box sx={{ display: "grid", gap: 2 }}>
          <Box>
            <SectionTitle>{t("reviewStatusUpper")}</SectionTitle>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.25 }}>
              {reviewStatus === "OPEN" ? (
                <>
                  <Button
                    size="small"
                    variant="outlined"
                    color="success"
                    disabled={busy}
                    onClick={() => onChangeStatus?.("COMPLETED")}
                  >
                    {t("markComplete")}
                  </Button>
                </>
              ) : (
                <Button
                  size="small"
                  variant="outlined"
                  disabled={busy}
                  onClick={() => onChangeStatus?.("OPEN")}
                >
                  {t("reopen")}
                </Button>
              )}
              {issue.reviewedAt ? (
                <Typography variant="caption" color="text.secondary" sx={{ alignSelf: "center" }}>
                  {t("reviewed")} {new Date(issue.reviewedAt).toLocaleString()}
                </Typography>
              ) : null}
            </Box>
          </Box>

          <Box>
            <SectionTitle>{t("fullDescriptionUpper")}</SectionTitle>
            <Typography variant="body2" sx={{ lineHeight: 1.7 }}>
              {issue.message}
            </Typography>
          </Box>

          {issue.location && (
            <Box>
              <SectionTitle>{t("locationUpper")}</SectionTitle>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: "background.default",
                  border: "1px solid",
                  borderColor: "divider",
                }}
              >
                <Typography component="code" variant="body2" sx={{ fontFamily: "monospace" }}>
                  {issue.location} 
                </Typography>
              </Box>
            </Box>
          )}

          <Box>
            <SectionTitle>{t("suggestedActionUpper")}</SectionTitle>
            <Typography variant="body2" sx={{ lineHeight: 1.7 }}>
              {t("reviewIssueAndUpdate")}
            </Typography>
          </Box>
        </Box>
      </AccordionDetails>
    </Accordion>
  );
}

export default function QCReportPage({
  report,
  reportId,
  fileName,
  viewerRole = "consultant",
}: Props) {
  const { t } = useLanguage();
  const colourBlind = useColourBlindMode();
  const isDark = useIsDarkMode();
  const [persistedReport, setPersistedReport] = useState<ReportDetail | null>(null);
  const [loadingPersistedReport, setLoadingPersistedReport] = useState(false);
  const [persistedReportError, setPersistedReportError] = useState<string | null>(null);
  const [pdfReviewOpen, setPdfReviewOpen] = useState(false);
  const [updatingIssueId, setUpdatingIssueId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [reviewFilter, setReviewFilter] = useState<"All" | IssueReviewStatus>("All");
  const [sortBy, setSortBy] = useState<SortOption>("location-asc");

  useEffect(() => {
    if (!reportId) {
      setPersistedReport(null);
      setPersistedReportError(null);
      return;
    }

    const resolvedReportId = reportId;
    let cancelled = false;

    async function loadPersistedReport() {
      try {
        setLoadingPersistedReport(true);
        setPersistedReportError(null);
        const loaded = await reportsApi.get(resolvedReportId);

        if (!cancelled) {
          setPersistedReport(loaded);
        }
      } catch {
        if (!cancelled) {
          setPersistedReport(null);
          setPersistedReportError(t("unableToLoadPersistedQcResults"));
        }
      } finally {
        if (!cancelled) {
          setLoadingPersistedReport(false);
        }
      }
    }

    void loadPersistedReport();

    return () => {
      cancelled = true;
    };
  }, [reportId, t]);

  const resolvedReport = useMemo<QCReport>(() => {
    if (!reportId) {
      return report;
    }

    if (!persistedReport) {
      return {
        summary: {
          totalIssues: 0,
          passed: false,
        },
        issues: [],
      };
    }

    return {
      summary: {
        totalIssues: persistedReport.totalIssues,
        passed: persistedReport.passedQC,
      },
      issues: persistedReport.issues.map((issue) => ({
        id: issue.id,
        type: issue.type,
        message: issue.description,
        location: formatIssueLocation(issue.location, issue.pageNumber),
        reviewStatus: issue.reviewStatus,
        reviewedAt: issue.reviewedAt,
      })),
    };
  }, [persistedReport, report, reportId]);

  const resolvedReportId = persistedReport?.id ?? reportId;
  const resolvedFileName = persistedReport?.fileName ?? fileName;
  const { summary, issues } = resolvedReport;

  const issueCounts = useMemo(
    () =>
      issues.reduce<Record<string, number>>((acc, issue) => {
        acc[issue.type] = (acc[issue.type] || 0) + 1;
        return acc;
      }, {}),
    [issues],
  );

  const issueTypes = useMemo(
    () => ["All", ...Object.keys(issueCounts).sort()],
    [issueCounts],
  );

  const filteredIssues = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    const result = issues.filter((issue) => {
      const matchesType = typeFilter === "All" || issue.type === typeFilter;
      const matchesReview = reviewFilter === "All" || (issue.reviewStatus ?? "OPEN") === reviewFilter;
      const matchesSearch =
        !search ||
        `${issue.type} ${issue.message} ${issue.location ?? ""}`.toLowerCase().includes(search);

      return matchesType && matchesReview && matchesSearch;
    });

    return result.sort((a, b) => {
      if (sortBy === "type-asc") return a.type.localeCompare(b.type);
      if (sortBy === "type-desc") return b.type.localeCompare(a.type);
      if (sortBy === "location-desc") return (b.location ?? "").localeCompare(a.location ?? "");
      return (a.location ?? "").localeCompare(b.location ?? "");
    });
  }, [issues, searchTerm, typeFilter, reviewFilter, sortBy]);

  const breakdown = useMemo(
    () => Object.entries(issueCounts).sort((a, b) => b[1] - a[1]),
    [issueCounts],
  );

  const clearFilters = () => {
    setSearchTerm("");
    setTypeFilter("All");
    setReviewFilter("All");
    setSortBy("location-asc");
  };

  async function handleIssueReviewStatusChange(issueId: string, status: IssueReviewStatus) {
    if (!persistedReport) {
      return;
    }

    const previous = persistedReport;
    const reviewedAt = status === "OPEN" ? null : new Date().toISOString();

    setUpdatingIssueId(issueId);
    setPersistedReport({
      ...persistedReport,
      issues: persistedReport.issues.map((issue) =>
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

      setPersistedReport((current) =>
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
      setPersistedReport(previous);
      toast.error(t("failedToUpdateIssue"), {
        description: err instanceof Error ? err.message : t("issueReviewStatusCouldNotBeUpdated"),
      });
    } finally {
      setUpdatingIssueId(null);
    }
  }

  const muiTheme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: isDark ? "dark" : "light",
        },
      }),
    [isDark],
  );

  return (
    <ThemeProvider theme={muiTheme}>
      <Box
        sx={{
          minHeight: "100vh",
          background: isDark
            ? "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)"
            : "linear-gradient(180deg, #f8fafc 0%, #f5f5f5 100%)",
          py: { xs: 3, md: 5 },
          px: { xs: 2, md: 6 },
        }}
      >
        <Box sx={{ maxWidth: 1400, mx: "auto" }}>
          <Box
            sx={{
              mb: 4,
              p: { xs: 3, md: 4 },
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 3,
              flexWrap: "wrap",
              borderRadius: 3,
              border: "1px solid",
              borderColor: "divider",
              bgcolor: "background.paper",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}
          >
            <Box>
              <Typography variant="overline" sx={{ color: isDark ? "#94a3b8" : "#6b7280", fontWeight: 700 }}>
                {t("reportResultsUpper")}
              </Typography>
              <Typography variant="h4" fontWeight={800} sx={{ mb: 1, color: isDark ? "#f1f5f9" : undefined }}>
                {t("qcAnalysisResults")}
              </Typography>
              <Typography sx={{ color: isDark ? "#cbd5e1" : "#4b5563" }}>
                {t("summaryOfQcChecks")}
              </Typography>
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
              <Button
                variant="outlined"
                onClick={() => setPdfReviewOpen(true)}
                disabled={!persistedReport || loadingPersistedReport}
                sx={{
                  borderRadius: 2,
                  px: 2,
                  py: 1,
                  fontSize: "0.875rem",
                  fontWeight: 700,
                  textTransform: "none",
                  color: isDark ? "#f3f4f6" : "#111827",
                  borderColor: isDark ? "#4b5563" : "#d1d5db",
                  "&:hover": {
                    borderColor: isDark ? "#4b5563" : "#d1d5db",
                    backgroundColor: isDark ? "#1f2937" : "#f3f4f6",
                  },
                  "&.Mui-disabled": {
                    color: isDark ? "#6b7280" : "#9ca3af",
                    borderColor: isDark ? "#374151" : "#e5e7eb",
                  },
                }}
              >
                {t("openPdfReview")}
              </Button>
              <PassFailChip passed={summary.passed} colourBlind={colourBlind} />
            </Box>
          </Box>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1.2fr" },
              gap: 3,
              mb: 4,
            }}
          >
            <StatCard
              title={t("totalIssuesFound")}
              value={summary.totalIssues}
              subtitle={t("allFlaggedIssues")}
            />
            <StatCard
              title={t("issueTypesFound")}
              value={breakdown.length}
              subtitle={t("distinctIssueCategoriesDetected")}
            />

            <Card variant="outlined" sx={{ borderRadius: 3, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <CardContent>
                <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
                  {t("reportDetails")}
                </Typography>
                <InfoRow label={t("reportId")} value={resolvedReportId ?? "—"} />
                <Divider />
                <InfoRow label={t("filename")} value={resolvedFileName ?? "—"} />
                {persistedReport ? (
                  <>
                    <Divider />
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 2,
                        py: 1.5,
                        flexWrap: "wrap",
                      }}
                    >
                      <Typography variant="body2" color="text.secondary" fontWeight={500}>
                        {t("analyst")}
                      </Typography>
                      <Typography variant="body2" fontWeight={500} sx={{ textAlign: "right" }}>
                        <AdminUserProfileLink
                          userId={persistedReport.analystUserId}
                          isAdmin={viewerRole === "admin"}
                          className={
                            viewerRole === "admin"
                              ? "font-medium text-primary underline-offset-2 hover:underline"
                              : undefined
                          }
                        >
                          {persistedReport.analyst}
                        </AdminUserProfileLink>
                      </Typography>
                    </Box>
                  </>
                ) : null}
              </CardContent>
            </Card>
          </Box>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", xl: "1.65fr 1fr" },
              gap: 4,
              alignItems: "start",
            }}
          >
            <Box>
              <Box sx={{ mb: 2 }}>
                <Typography variant="h6" fontWeight={700}>
                  {t("detailedIssues")}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {persistedReportError
                    ? persistedReportError
                    : loadingPersistedReport
                      ? t("loadingPersistedReportResults")
                      : `${t("showing")} ${filteredIssues.length} ${t("of")} ${issues.length} ${t("issuesLowercase")}`}
                </Typography>
              </Box>

              <Card variant="outlined" sx={{ mb: 3, borderRadius: 3, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                <CardContent>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", md: "1fr 1fr", xl: "1fr 1fr 1fr 1fr auto" },
                      gap: 2,
                      alignItems: "end",
                    }}
                  >
                    <TextField
                      label={t("searchIssues")}
                      size="small"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder={t("searchByIssueTextOrLocation")}
                      fullWidth
                    />

                    <FormControl fullWidth size="small">
                      <InputLabel id="issue-type-filter-label">{t("filterByType")}</InputLabel>
                      <Select
                        labelId="issue-type-filter-label"
                        value={typeFilter}
                        label={t("filterByType")}
                        onChange={(e: SelectChangeEvent<string>) => setTypeFilter(e.target.value)}
                      >
                        {issueTypes.map((type) => (
                          <MenuItem key={type} value={type}>
                            {type === "All" ? t("allIssueTypes") : formatIssueType(type)}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <FormControl fullWidth size="small">
                      <InputLabel id="sort-by-label">{t("sortBy")}</InputLabel>
                      <Select
                        labelId="sort-by-label"
                        value={sortBy}
                        label={t("sortBy")}
                        onChange={(e: SelectChangeEvent<string>) =>
                          setSortBy(e.target.value as SortOption)
                        }
                      >
                        <MenuItem value="location-asc">{t("locationAToZ")}</MenuItem>
                        <MenuItem value="location-desc">{t("locationZToA")}</MenuItem>
                        <MenuItem value="type-asc">{t("typeAToZ")}</MenuItem>
                        <MenuItem value="type-desc">{t("typeZToA")}</MenuItem>
                      </Select>
                    </FormControl>

                    <FormControl fullWidth size="small">
                      <InputLabel id="review-status-filter-label">{t("reviewStatus")}</InputLabel>
                      <Select
                        labelId="review-status-filter-label"
                        value={reviewFilter}
                        label={t("reviewStatus")}
                        onChange={(e: SelectChangeEvent<string>) =>
                          setReviewFilter(e.target.value as "All" | IssueReviewStatus)
                        }
                      >
                        <MenuItem value="All">{t("allReviewStatuses")}</MenuItem>
                        <MenuItem value="OPEN">{t("openCapitalized")}</MenuItem>
                        <MenuItem value="COMPLETED">{t("completed")}</MenuItem>
                        <MenuItem value="FALSE_POSITIVE">{t("falsePositives")}</MenuItem>
                      </Select>
                    </FormControl>

                    <Button variant="outlined" onClick={clearFilters} sx={{ height: 40 }}>
                      {t("clearFilters")}
                    </Button>
                  </Box>
                </CardContent>
              </Card>

              {filteredIssues.length === 0 ? (
                <Card variant="outlined" sx={{ borderRadius: 3, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                  <CardContent sx={{ py: 6, textAlign: "center" }}>
                    <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
                      {t("noMatchingIssues")}
                    </Typography>
                    <Typography color="text.secondary">
                      {t("tryChangingFilters")}
                    </Typography>
                  </CardContent>
                </Card>
              ) : (
                filteredIssues.map((issue) => (
                  <IssueItem
                    key={issue.id}
                    issue={issue}
                    busy={updatingIssueId === issue.id}
                    onChangeStatus={
                      persistedReport ? (status) => void handleIssueReviewStatusChange(issue.id, status) : undefined
                    }
                  />
                ))
              )}
            </Box>

            <Card
              variant="outlined"
              sx={{
                borderRadius: 3,
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                position: { xl: "sticky" },
                top: { xl: 24 },
              }}
            >
              <CardContent sx={{ p: 0 }}>
                <Typography variant="h6" fontWeight={700} sx={{ px: 3, pt: 2.5 }}>
                  {t("breakdownByIssueType")}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ px: 3, pb: 2, borderBottom: "1px solid", borderColor: "divider" }}
                >
                  {t("clickCategoryToFilter")}
                </Typography>

                {breakdown.length === 0 ? (
                  <Box sx={{ px: 3, py: 4 }}>
                    <Typography color="text.secondary">{t("noIssuesFoundInReport")}</Typography>
                  </Box>
                ) : (
                  breakdown.map(([type, count], index) => {
                    const percentage = issues.length ? Math.round((count / issues.length) * 100) : 0;
                    const active = typeFilter === type;

                    return (
                      <Box
                        key={type}
                        onClick={() => setTypeFilter(active ? "All" : type)}
                        sx={(theme) => ({
                          px: 3,
                          py: 2,
                          cursor: "pointer",
                          backgroundColor: active
                            ? theme.palette.mode === "dark"
                              ? "rgba(255,255,255,0.06)"
                              : theme.palette.grey[50]
                            : theme.palette.background.paper,
                          borderLeft: active
                            ? `4px solid ${theme.palette.mode === "dark" ? theme.palette.grey[100] : "#111827"}`
                            : "4px solid transparent",
                          borderBottom:
                            index < breakdown.length - 1 ? `1px solid ${theme.palette.divider}` : "none",
                          "&:hover": {
                            backgroundColor:
                              theme.palette.mode === "dark" ? "rgba(255,255,255,0.08)" : theme.palette.grey[50],
                          },
                        })}
                      >
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            mb: 1,
                            gap: 2,
                          }}
                        >
                          <Typography fontWeight={active ? 700 : 500}>
                            {formatIssueType(type)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" fontWeight={600}>
                            {count} ({percentage}%)
                          </Typography>
                        </Box>

                        <Box sx={{ height: 8, borderRadius: 999, bgcolor: "action.hover" }}>
                          <Box
                            sx={(theme) => ({
                              height: "100%",
                              width: `${percentage}%`,
                              borderRadius: 999,
                              bgcolor:
                                theme.palette.mode === "dark"
                                  ? active
                                    ? theme.palette.grey[300]
                                    : theme.palette.grey[600]
                                  : active
                                    ? "#111827"
                                    : "#4b5563",
                            })}
                          />
                        </Box>
                      </Box>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </Box>
        </Box>

        <AttachedPdfReviewDialog
          open={pdfReviewOpen}
          onClose={() => setPdfReviewOpen(false)}
          issues={persistedReport?.issues ?? []}
          onChangeIssueReviewStatus={(issueId, status) => void handleIssueReviewStatusChange(issueId, status)}
          busyIssueId={updatingIssueId}
        />
      </Box>
    </ThemeProvider>
  );
}
