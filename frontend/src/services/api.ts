const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

const FETCH_OPTS = { credentials: "include" as RequestCredentials };

export class ApiClientError extends Error {
  public readonly code?: string;
  public readonly retryAfterSeconds?: number;
  public readonly captchaRequired?: boolean;

  constructor(params: {
    message: string;
    code?: string;
    retryAfterSeconds?: number;
    captchaRequired?: boolean;
  }) {
    super(params.message);
    this.name = "ApiClientError";
    this.code = params.code;
    this.retryAfterSeconds = params.retryAfterSeconds;
    this.captchaRequired = params.captchaRequired;
  }
}

function authHeaders(): HeadersInit {
  return {};
}

function jsonAuthHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    ...authHeaders(),
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const payload = data as {
      message?: string;
      code?: string;
      retryAfterSeconds?: number;
      captchaRequired?: boolean;
    };
    throw new ApiClientError({
      message: payload.message || `Request failed: ${res.status}`,
      code: payload.code,
      retryAfterSeconds: payload.retryAfterSeconds,
      captchaRequired: payload.captchaRequired,
    });
  }
  return res.json();
}

async function handleDownloadResponse(
  res: Response,
  fallbackFileName: string,
): Promise<ReportExportFile> {
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { message?: string }).message || `Request failed: ${res.status}`);
  }

  const contentDisposition = res.headers.get("content-disposition") ?? "";
  const match = contentDisposition.match(/filename="?([^"]+)"?/i);

  return {
    blob: await res.blob(),
    fileName: match?.[1] ?? fallbackFileName,
    contentType: res.headers.get("content-type") ?? "application/octet-stream",
  };
}

export const authApi = {
  me() {
    return fetch(`${API_BASE}/logins/me`, { ...FETCH_OPTS }).then(
      handleResponse<{ id: number; name: string; email: string; role: string }>
    );
  },

  async loginEncrypted(
    encryptedPayload: { encryptedKey: string; iv: string; data: string },
    options?: { captchaToken?: string },
  ) {
    return fetch(`${API_BASE}/logins/login`, {
      method: "POST",
      ...FETCH_OPTS,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...encryptedPayload,
        ...(options?.captchaToken ? { captchaToken: options.captchaToken } : {}),
      }),
    }).then(handleResponse<{ message: string; email: string; userType: string; mfaRequired: boolean; userId: number }>);
  },
  changePassword(data: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) {
    return fetch(`${API_BASE}/logins/change-password`, {
      method: "PATCH",
      ...FETCH_OPTS,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(handleResponse<{ message: string }>);
  },

  requestPasswordReset(email: string) {
    return fetch(`${API_BASE}/logins/forgot-password`, {
      method: "POST",
      ...FETCH_OPTS,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).then(handleResponse<{ message: string }>);
  },

  validateResetToken(token: string) {
    return fetch(`${API_BASE}/logins/validate-reset-token`, {
      method: "POST",
      ...FETCH_OPTS,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }).then(handleResponse<{ valid: boolean; message?: string }>);
  },

  resetPasswordWithToken(token: string, newPassword: string, confirmPassword: string) {
    return fetch(`${API_BASE}/logins/reset-password-with-token`, {
      method: "POST",
      ...FETCH_OPTS,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword, confirmPassword }),
    }).then(handleResponse<{ message: string }>);
  },

  logout() {
    return fetch(`${API_BASE}/logins/logout`, { method: "POST", ...FETCH_OPTS }).then(
      handleResponse<object>
    );
  },
};

export type InAppAnnouncementKind = "team_manager" | "admin" | "feature";

export interface InAppAnnouncementDto {
  id: string;
  kind: InAppAnnouncementKind;
  title: string;
  body: string;
  createdAt: string;
}

export const notificationsApi = {
  list() {
    return fetch(`${API_BASE}/notifications`, {
      ...FETCH_OPTS,
      headers: { ...authHeaders() },
    }).then(handleResponse<{ serverTime: string; announcements: InAppAnnouncementDto[] }>);
  },
};

// Reports
export interface ReportListItem {
  id: string;
  fileName: string;
  uploadDate: string;
  analyst: string;
  analystUserId?: number | null;
  status: "passed" | "failed" | "processing";
  issuesFound: number;
  openIssues: number;
  completedIssues: number;
  falsePositiveIssues: number;
  tagStatus: number;
  reviewStatus: "not_started" | "in_review" | "completed";
}

export interface ReportDetail {
  id: string;
  fileName: string;
  status: string;
  uploadedAt: string;
  analyzedAt: string | null;
  processingTimeSeconds: number | null;
  totalIssues: number;
  passedQC: boolean;
  analyst: string;
  analystUserId?: number | null;
  sharingAvailable: boolean;
  sharingUnavailableReason: string | null;
  issues: Array<{
    id: string;
    type: string;
    description: string;
    location: string;
    context: string;
    suggestion: string;
    pageNumber: number | null;
    reviewStatus: "OPEN" | "COMPLETED" | "FALSE_POSITIVE";
    reviewedAt: string | null;
  }>;
}

export type ReportExportFormat = "csv" | "pdf";

export interface ReportExportFile {
  blob: Blob;
  fileName: string;
  contentType: string;
}

export interface AuthSecurityAuditEventDto {
  id: string;
  occurredAt: string;
  eventType:
    | "login_failed"
    | "login_lockout"
    | "login_captcha_required"
    | "login_success"
    | "logout"
    | "audit_view_access";
  outcome: "failed" | "blocked" | "success" | "viewed";
  actorUserId: number | null;
  actorRole: string | null;
  actorEmail: string | null;
  targetEmail: string | null;
  sourceIp: string | null;
  route: string | null;
  detail: string | null;
  retryAfterSeconds: number | null;
  captchaRequired: boolean;
}

export const adminApi = {
  securityEvents() {
    return fetch(`${API_BASE}/logins/security-events`, {
      ...FETCH_OPTS,
      headers: authHeaders(),
    }).then(handleResponse<{ events: AuthSecurityAuditEventDto[] }>);
  },

  manualBackup(body?: { teamId?: string }) {
    return fetch(`${API_BASE}/admin/backup/manual`, {
      method: "POST",
      ...FETCH_OPTS,
      headers: jsonAuthHeaders(),
      body: JSON.stringify(body ?? {}),
    }).then(
      handleResponse<{ ok: boolean; backupId: string; completedAt: string; message: string }>,
    );
  },

  exportAllReports: async (
    format: "csv" | "zip",
    opts?: { teamId?: string },
  ): Promise<ReportExportFile> => {
    const q = new URLSearchParams({ format });
    if (opts?.teamId != null && opts.teamId !== "") {
      q.set("teamId", opts.teamId);
    }
    const res = await fetch(`${API_BASE}/admin/reports/export-all?${q.toString()}`, {
      ...FETCH_OPTS,
      headers: authHeaders(),
    });
    return handleDownloadResponse(res, `all-reports.${format}`);
  },
};

export interface ReportShareResponse {
  recipientEmail: string;
  format: ReportExportFormat;
  fileName: string;
  message: string;
}

export interface ProfileStats {
  totalReports: number;
  completedReports: number;
  failedReports: number;
  processingReports: number;
  totalIssues: number;
  passRate: number;
}

export const reportsApi = {
  list: (params?: { status?: string; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.search) q.set("search", params.search);
    return fetch(`${API_BASE}/reports?${q}`, { ...FETCH_OPTS, headers: authHeaders() }).then(
      handleResponse<ReportListItem[]>
    );
  },

  stats: () =>
    fetch(`${API_BASE}/reports/me/stats`, { ...FETCH_OPTS, headers: authHeaders() }).then(
      handleResponse<ProfileStats>
    ),

  recent: () =>
    fetch(`${API_BASE}/reports/me/recent`, { ...FETCH_OPTS, headers: authHeaders() }).then(
      handleResponse<Array<Pick<ReportListItem, "id" | "fileName" | "uploadDate" | "status" | "issuesFound">>>
    ),

  get: (id: string) =>
    fetch(`${API_BASE}/reports/${id}`, { ...FETCH_OPTS, headers: authHeaders() }).then(
      handleResponse<ReportDetail>
    ),

  create: (fileName: string, fileSizeBytes?: number) =>
    fetch(`${API_BASE}/reports`, {
      method: "POST",
      ...FETCH_OPTS,
      headers: jsonAuthHeaders(),
      body: JSON.stringify({ fileName, fileSizeBytes }),
    }).then(handleResponse<{ id: string; fileName: string; status: string }>),

  complete: (id: string, issues: unknown[], processingTimeSeconds?: number) =>
    fetch(`${API_BASE}/reports/${id}/complete`, {
      method: "PATCH",
      ...FETCH_OPTS,
      headers: jsonAuthHeaders(),
      body: JSON.stringify({ issues, processingTimeSeconds }),
    }).then(handleResponse<ReportDetail>),

  updateTagStatus: (reportId: string, tagStatus: number) =>
    fetch(`${API_BASE}/reports/tags`, {
      method: "PATCH",
      ...FETCH_OPTS,
      headers: jsonAuthHeaders(),
      body: JSON.stringify({ reportId, tagStatus }),
    }).then(handleResponse<{ id: string; tagStatus: number }>),

  exportResult: async (id: string, format: ReportExportFormat): Promise<ReportExportFile> => {
    const res = await fetch(`${API_BASE}/reports/${encodeURIComponent(id)}/export?format=${format}`, {
      ...FETCH_OPTS,
      headers: authHeaders(),
    });
    return handleDownloadResponse(res, `qc-results.${format}`);
  },

  shareResult: (id: string, payload: { format: ReportExportFormat; recipientEmail: string; message?: string }) =>
    fetch(`${API_BASE}/reports/${encodeURIComponent(id)}/share`, {
      method: "POST",
      ...FETCH_OPTS,
      headers: jsonAuthHeaders(),
      body: JSON.stringify(payload),
    }).then(handleResponse<ReportShareResponse>),

  updateIssueReviewStatus: (
    issueId: string,
    status: "OPEN" | "COMPLETED" | "FALSE_POSITIVE",
  ) =>
    fetch(`${API_BASE}/reports/issues/${encodeURIComponent(issueId)}/review`, {
      method: "PATCH",
      ...FETCH_OPTS,
      headers: jsonAuthHeaders(),
      body: JSON.stringify({ status }),
    }).then(
      handleResponse<{
        id: string;
        reviewStatus: "OPEN" | "COMPLETED" | "FALSE_POSITIVE";
        reviewedAt: string | null;
      }>
    ),
};

// Analytics (QC Trend Dashboard)
export interface KPIData {
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
}

export interface IssueTypeItem {
  issueType: string;
  label: string;
  count: number;
}

export interface TrendItem {
  label: string;
  analyses: number;
  issues: number;
  falsePositives: number;
}

export interface SectionDensityItem {
  section: string;
  issueCount: number;
  issueDensity: number;
}

export interface RecurringIssueRateItem {
  label: string;
  analyses: number;
  reportsWithRepeatedCategories: number;
  recurringIssueRate: number;
}

export interface ConsultantQualitySignalItem {
  consultantId: number;
  consultantEmail: string;
  analysesRun: number;
  withIssuesPercentage: number;
  averageIssuesPerReport: number;
  mostFrequentCategory: string | null;
}

export interface AnalyticsQuery {
  timeRange?: string;
  dateFrom?: string;
  dateTo?: string;
  consultantId?: string;
  issueType?: string;
}

export interface TeamAnalyticsQuery {
  dateFrom?: string;
  dateTo?: string;
  issueType?: string;
  teamId?: string;
  consultantId?: string;
}

export interface TeamAnalyticsKPIData {
  totalReportsAnalysed: number;
  totalIssuesFound: number;
  averageIssuesPerReport: number;
  passRate: number;
  failedQcRate: number;
  criticalIssuesCount: number;
}

export interface TeamAnalyticsTrendItem {
  label: string;
  reports: number;
  issues: number;
}

export interface TeamPerformanceItem {
  teamId: string;
  teamName: string;
  reportsAnalysed: number;
  averageIssuesPerReport: number;
  reportsWithIssuesPercentage: number;
  mostFrequentIssueCategory: string | null;
}

export interface ConsultantPerformanceItem {
  consultantId: number;
  consultantName: string;
  consultantEmail: string;
  reportsAnalysed: number;
  averageIssuesPerReport: number;
  reportsWithIssuesPercentage: number;
  passRate: number;
  mostFrequentIssueCategory: string | null;
}

export interface WeeklyDigestQuery {
  weekStart: string;
  consultantId?: string;
  issueType?: string;
}

export interface WeeklyDigestAvailability {
  sharingAvailable: boolean;
  sharingUnavailableReason: string | null;
}

export interface WeeklyDigestShareRequest extends WeeklyDigestQuery {
  format: ReportExportFormat;
  recipientEmail: string;
  message?: string;
}

export interface WeeklyDigestShareResponse {
  recipientEmail: string;
  format: ReportExportFormat;
  fileName: string;
  message: string;
}

function buildAnalyticsQuery(query?: string | AnalyticsQuery): string {
  const params = new URLSearchParams();

  if (typeof query === "string") {
    params.set("timeRange", query);
    return params.toString();
  }

  if (query?.timeRange) params.set("timeRange", query.timeRange);
  if (query?.dateFrom) params.set("dateFrom", query.dateFrom);
  if (query?.dateTo) params.set("dateTo", query.dateTo);
  if (query?.consultantId) params.set("consultantId", query.consultantId);
  if (query?.issueType) params.set("issueType", query.issueType);

  return params.toString();
}

function buildWeeklyDigestQuery(query: WeeklyDigestQuery & { format?: ReportExportFormat }): string {
  const params = new URLSearchParams();

  params.set("weekStart", query.weekStart);
  if (query.format) params.set("format", query.format);
  if (query.consultantId) params.set("consultantId", query.consultantId);
  if (query.issueType) params.set("issueType", query.issueType);

  return params.toString();
}

function buildTeamAnalyticsQuery(query?: TeamAnalyticsQuery): string {
  const params = new URLSearchParams();

  if (query?.dateFrom) params.set("dateFrom", query.dateFrom);
  if (query?.dateTo) params.set("dateTo", query.dateTo);
  if (query?.issueType) params.set("issueType", query.issueType);
  if (query?.teamId) params.set("teamId", query.teamId);
  if (query?.consultantId) params.set("consultantId", query.consultantId);

  return params.toString();
}

export const analyticsApi = {
  kpis: (query?: string | AnalyticsQuery) =>
    fetch(`${API_BASE}/analytics/kpis?${buildAnalyticsQuery(query || "6months")}`, {
      ...FETCH_OPTS,
      headers: authHeaders(),
    }).then(handleResponse<KPIData>),

  issueTypes: (query?: string | AnalyticsQuery) =>
    fetch(`${API_BASE}/analytics/issue-types?${buildAnalyticsQuery(query || "6months")}`, {
      ...FETCH_OPTS,
      headers: authHeaders(),
    }).then(handleResponse<IssueTypeItem[]>),

  trends: (query?: string | AnalyticsQuery) =>
    fetch(`${API_BASE}/analytics/trends?${buildAnalyticsQuery(query || "6months")}`, {
      ...FETCH_OPTS,
      headers: authHeaders(),
    }).then(handleResponse<TrendItem[]>),

  sectionDensity: (query?: string | AnalyticsQuery) =>
    fetch(`${API_BASE}/analytics/section-density?${buildAnalyticsQuery(query || "6months")}`, {
      ...FETCH_OPTS,
      headers: authHeaders(),
    }).then(handleResponse<SectionDensityItem[]>),

  recurringIssueRate: (query?: string | AnalyticsQuery) =>
    fetch(`${API_BASE}/analytics/recurring-issue-rate?${buildAnalyticsQuery(query || "6months")}`, {
      ...FETCH_OPTS,
      headers: authHeaders(),
    }).then(handleResponse<RecurringIssueRateItem[]>),

  consultantSignals: (query?: string | AnalyticsQuery) =>
    fetch(`${API_BASE}/analytics/consultant-signals?${buildAnalyticsQuery(query || "6months")}`, {
      ...FETCH_OPTS,
      headers: authHeaders(),
    }).then(handleResponse<ConsultantQualitySignalItem[]>),

  weeklyDigestAvailability: () =>
    fetch(`${API_BASE}/analytics/weekly-digest/availability`, {
      ...FETCH_OPTS,
      headers: authHeaders(),
    }).then(handleResponse<WeeklyDigestAvailability>),

  exportWeeklyDigest: async (
    query: WeeklyDigestQuery & { format: ReportExportFormat },
  ): Promise<ReportExportFile> => {
    const res = await fetch(
      `${API_BASE}/analytics/weekly-digest/export?${buildWeeklyDigestQuery(query)}`,
      {
        ...FETCH_OPTS,
        headers: authHeaders(),
      },
    );

    return handleDownloadResponse(res, `qc-weekly-digest.${query.format}`);
  },

  shareWeeklyDigest: (payload: WeeklyDigestShareRequest) =>
    fetch(`${API_BASE}/analytics/weekly-digest/share`, {
      method: "POST",
      ...FETCH_OPTS,
      headers: jsonAuthHeaders(),
      body: JSON.stringify(payload),
    }).then(handleResponse<WeeklyDigestShareResponse>),
};

export const teamAnalyticsApi = {
  kpis: (query?: TeamAnalyticsQuery) =>
    fetch(`${API_BASE}/team-analytics/kpis?${buildTeamAnalyticsQuery(query)}`, {
      ...FETCH_OPTS,
      headers: authHeaders(),
    }).then(handleResponse<TeamAnalyticsKPIData>),

  issueTypes: (query?: TeamAnalyticsQuery) =>
    fetch(`${API_BASE}/team-analytics/issue-types?${buildTeamAnalyticsQuery(query)}`, {
      ...FETCH_OPTS,
      headers: authHeaders(),
    }).then(handleResponse<IssueTypeItem[]>),

  trends: (query?: TeamAnalyticsQuery) =>
    fetch(`${API_BASE}/team-analytics/trends?${buildTeamAnalyticsQuery(query)}`, {
      ...FETCH_OPTS,
      headers: authHeaders(),
    }).then(handleResponse<TeamAnalyticsTrendItem[]>),

  teamPerformance: (query?: TeamAnalyticsQuery) =>
    fetch(`${API_BASE}/team-analytics/team-performance?${buildTeamAnalyticsQuery(query)}`, {
      ...FETCH_OPTS,
      headers: authHeaders(),
    }).then(handleResponse<TeamPerformanceItem[]>),

  consultantPerformance: (query?: TeamAnalyticsQuery) =>
    fetch(`${API_BASE}/team-analytics/consultant-performance?${buildTeamAnalyticsQuery(query)}`, {
      ...FETCH_OPTS,
      headers: authHeaders(),
    }).then(handleResponse<ConsultantPerformanceItem[]>),
};

// AI Learning & Training
export interface AILearningStats {
  modelAccuracy: number;
  accuracyChange: number;
  totalExamples: number;
  goodExamples: number;
  badExamples: number;
  lastTrainingDate: string | null;
  feedbackReceivedThisMonth: number;
}

export interface TrainingExampleItem {
  id: string;
  fileName: string;
  uploadDate: string;
  issues: number;
  type: "good" | "bad";
  status: string;
}

export interface FeedbackStats {
  positive: number;
  negative: number;
  satisfactionRate: number;
}

export interface PendingReview {
  reportId: string;
  fileName: string;
  issuesDetected: number;
  criticalIssues: number;
}

export const aiLearningApi = {
  stats: () =>
    fetch(`${API_BASE}/ai-learning/stats`, { ...FETCH_OPTS, headers: authHeaders() }).then(
      handleResponse<AILearningStats>
    ),

  listExamples: (type?: string) => {
    const q = new URLSearchParams();
    if (type) q.set("type", type);
    return fetch(`${API_BASE}/ai-learning/training-examples?${q}`, {
      ...FETCH_OPTS,
      headers: authHeaders(),
    }).then(handleResponse<TrainingExampleItem[]>);
  },

  uploadExample: (file: File, type: "good" | "bad") => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);
    return fetch(`${API_BASE}/ai-learning/training-examples`, {
      method: "POST",
      ...FETCH_OPTS,
      body: formData,
    }).then(handleResponse<{ id: string; fileName: string; type: string; status: string; uploadedAt: string }>);
  },

  deleteExample: (id: string) =>
    fetch(`${API_BASE}/ai-learning/training-examples/${id}`, {
      method: "DELETE",
      ...FETCH_OPTS,
      headers: authHeaders(),
    }).then(() => {}),

  submitFeedback: (reportId: string, rating: "correct" | "needs_improvement", comment?: string) =>
    fetch(`${API_BASE}/ai-learning/feedback`, {
      method: "POST",
      ...FETCH_OPTS,
      headers: jsonAuthHeaders(),
      body: JSON.stringify({ reportId, rating, comment }),
    }).then(handleResponse<{ id: string; reportId: string; rating: string; createdAt: string }>),

  feedbackStats: () =>
    fetch(`${API_BASE}/ai-learning/feedback/stats`, { ...FETCH_OPTS, headers: authHeaders() }).then(
      handleResponse<FeedbackStats>
    ),

  pendingReview: () =>
    fetch(`${API_BASE}/ai-learning/feedback/pending-review`, { ...FETCH_OPTS, headers: authHeaders() }).then(
      handleResponse<PendingReview | null>
    ),
};

// Users (admin)
export interface UserListItem {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  lastActive: string;
  reportsCount: number;
  managedBy?: string | null;
  managedByUserId?: number | null;
  teamId?: string | null;
  teamName?: string | null;
  userType?: string;
}

export interface TeamManagerSummary {
  id: string;
  name: string;
  email: string;
}

export interface TeamMemberSummary {
  id: string;
  name: string;
  email: string;
  role: string;
  reportsCount: number;
  teamId: string | null;
}

export interface TeamListItem {
  id: string;
  name: string;
  manager: TeamManagerSummary | null;
  memberCount: number;
}

export interface TeamDetail {
  id: string;
  name: string;
  manager: TeamManagerSummary | null;
  members: TeamMemberSummary[];
}

export const usersApi = {
  me: () =>
    fetch(`${API_BASE}/users/me`, { ...FETCH_OPTS, headers: authHeaders() }).then(
      handleResponse<UserListItem>
    ),

  updateMe: (data: { name: string }) =>
    fetch(`${API_BASE}/users/me`, {
      method: "PATCH",
      ...FETCH_OPTS,
      headers: jsonAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse<UserListItem>),

  list: () =>
    fetch(`${API_BASE}/users`, { ...FETCH_OPTS, headers: authHeaders() }).then(
      handleResponse<UserListItem[]>
    ),

  team: () =>
    fetch(`${API_BASE}/users/team`, { ...FETCH_OPTS, headers: authHeaders() }).then(
      handleResponse<UserListItem[]>
    ),

  create: (data: { email: string; password: string; role: string; managedByUserId?: number; name: string }) =>
    fetch(`${API_BASE}/users`, {
      method: "POST",
      ...FETCH_OPTS,
      headers: jsonAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse<UserListItem>),

  update: (id: string, data: { email?: string; role?: string; managedByUserId?: number | null; name?: string }) =>
    fetch(`${API_BASE}/users/${id}`, {
      method: "PATCH",
      ...FETCH_OPTS,
      headers: jsonAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse<UserListItem>),

  delete: (id: string) =>
    fetch(`${API_BASE}/users/${id}`, {
      method: "DELETE",
      ...FETCH_OPTS,
      headers: authHeaders(),
    }).then(() => {}),
};

export const teamsApi = {
  list: () =>
    fetch(`${API_BASE}/teams`, { ...FETCH_OPTS, headers: authHeaders() }).then(
      handleResponse<TeamListItem[]>
    ),

  create: (data: { name: string }) =>
    fetch(`${API_BASE}/teams`, {
      method: "POST",
      ...FETCH_OPTS,
      headers: jsonAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse<TeamDetail>),

  get: (id: string) =>
    fetch(`${API_BASE}/teams/${encodeURIComponent(id)}`, {
      ...FETCH_OPTS,
      headers: authHeaders(),
    }).then(handleResponse<TeamDetail>),

  update: (id: string, data: { name?: string; managerUserId?: number | null }) =>
    fetch(`${API_BASE}/teams/${encodeURIComponent(id)}`, {
      method: "PATCH",
      ...FETCH_OPTS,
      headers: jsonAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse<TeamDetail>),

  addMember: (id: string, userId: number) =>
    fetch(`${API_BASE}/teams/${encodeURIComponent(id)}/members`, {
      method: "POST",
      ...FETCH_OPTS,
      headers: jsonAuthHeaders(),
      body: JSON.stringify({ userId }),
    }).then(handleResponse<TeamDetail>),

  removeMember: (id: string, userId: string) =>
    fetch(`${API_BASE}/teams/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}`, {
      method: "DELETE",
      ...FETCH_OPTS,
      headers: authHeaders(),
    }).then(handleResponse<TeamDetail>),

  delete: (id: string) =>
    fetch(`${API_BASE}/teams/${encodeURIComponent(id)}`, {
      method: "DELETE",
      ...FETCH_OPTS,
      headers: authHeaders(),
    }).then(() => {}),

  me: () =>
    fetch(`${API_BASE}/teams/me`, { ...FETCH_OPTS, headers: authHeaders() }).then(
      handleResponse<TeamDetail | null>
    ),

  meRecentReports: () =>
    fetch(`${API_BASE}/teams/me/recent-reports`, { ...FETCH_OPTS, headers: authHeaders() }).then(
      handleResponse<ReportListItem[]>
    ),
};
// Session-scoped QC API used by the upload flow before results are reopened from persisted reports.
export interface SessionQcResult {
  reportSessionId: string;
  reportId: string;
  filename: string;
  scanSource?: "ai" | "rules";
  analysisStatus: "pending" | "completed" | "failed";
  summary: {
    totalIssues: number;
    passedQC: boolean;
    byType: {
      template_artifact: number;
      unremoved_guidance: number;
      missing_information: number;
      contradiction: number;
      limitation_contradiction: number;
      incomplete_limitations: number;
    };
  };
  issues: Array<{
    id: string;
    type: string;
    ruleKey: string | null;
    message: string;
    suggestion: string;
    section: string | null;
    location: {
      page: number | null;
      section: string | null;
    };
    anchor: {
      mode: "page" | "section" | "text";
      targetText: string | null;
      startPage: number | null;
      endPage: number | null;
    };
    context: string;
  }>;
  analyzedAt: string | null;
  processingTimeSeconds?: number;
}

export const sessionQcApi = {
  analyze: (
    reportSessionId: string,
    scanMode?: "ai" | "rules",
    signal?: AbortSignal,
    options?: { aiLocationMode?: "full" | "canonical_only" },
  ) => {
    const query = new URLSearchParams();
    if (scanMode) {
      query.set("scanMode", scanMode);
    }
    if (options?.aiLocationMode) {
      query.set("aiLocationMode", options.aiLocationMode);
    }
    const suffix = query.size > 0 ? `?${query.toString()}` : "";
    return fetch(`${API_BASE}/reports/sessions/${encodeURIComponent(reportSessionId)}/analyze${suffix}`, {
      method: "POST",
      ...FETCH_OPTS,
      headers: authHeaders(),
      signal,
    }).then(handleResponse<SessionQcResult>);
  },
  getResults: (reportSessionId: string) =>
    fetch(`${API_BASE}/reports/sessions/${encodeURIComponent(reportSessionId)}/qc-results`, {
      ...FETCH_OPTS,
      headers: authHeaders(),
    }).then(handleResponse<SessionQcResult>),
};
