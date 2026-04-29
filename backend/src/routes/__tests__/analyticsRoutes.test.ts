import express from "express";
import request from "supertest";
import analyticsRouter from "../analytics";
import { errorHandler } from "../../middleware/errorHandler";
import { ApiError } from "../../errors/apiError";
import {
  getConsultantQualitySignals,
  getAnalyticsIssueTypes,
  getAnalyticsKpis,
  getAnalyticsSectionDensity,
  getAnalyticsTrends,
  getRecurringIssueRate,
} from "../../services/analyticsService";
import { exportWeeklyDigestAsCsv, exportWeeklyDigestAsPdf } from "../../services/weeklyDigestExportService";
import { shareWeeklyDigest } from "../../services/weeklyDigestShareService";
import { getMailServiceAvailability } from "../../services/mailService";

jest.mock("../../middleware/auth", () => ({
  authenticateToken: jest.fn((req, res, next) => {
    const roleHeader = req.headers["x-test-role"];
    if (!roleHeader) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }
    req.user = { userId: 7, email: "tester@ligtas.com", role: String(roleHeader) };
    next();
  }),
  requireAdmin: jest.fn((req, res, next) => {
    if (req.user?.role !== "ADMIN") {
      res.status(403).json({ message: "Admin access required" });
      return;
    }
    next();
  }),
}));

jest.mock("../../services/analyticsService", () => ({
  ...jest.requireActual("../../services/analyticsService"),
  getAnalyticsKpis: jest.fn(),
  getAnalyticsIssueTypes: jest.fn(),
  getAnalyticsTrends: jest.fn(),
  getAnalyticsSectionDensity: jest.fn(),
  getRecurringIssueRate: jest.fn(),
  getConsultantQualitySignals: jest.fn(),
}));

jest.mock("../../services/weeklyDigestExportService", () => ({
  exportWeeklyDigestAsCsv: jest.fn(),
  exportWeeklyDigestAsPdf: jest.fn(),
}));

jest.mock("../../services/weeklyDigestShareService", () => ({
  shareWeeklyDigest: jest.fn(),
}));

jest.mock("../../services/mailService", () => ({
  getMailServiceAvailability: jest.fn(() => ({
    available: false,
    reason: "Email sharing is not configured in this environment.",
  })),
}));

describe("analytics routes", () => {
  let app: express.Express;
  const getAnalyticsKpisMock = getAnalyticsKpis as jest.MockedFunction<typeof getAnalyticsKpis>;
  const getAnalyticsIssueTypesMock =
    getAnalyticsIssueTypes as jest.MockedFunction<typeof getAnalyticsIssueTypes>;
  const getAnalyticsTrendsMock = getAnalyticsTrends as jest.MockedFunction<typeof getAnalyticsTrends>;
  const getAnalyticsSectionDensityMock =
    getAnalyticsSectionDensity as jest.MockedFunction<typeof getAnalyticsSectionDensity>;
  const getRecurringIssueRateMock =
    getRecurringIssueRate as jest.MockedFunction<typeof getRecurringIssueRate>;
  const getConsultantQualitySignalsMock =
    getConsultantQualitySignals as jest.MockedFunction<typeof getConsultantQualitySignals>;
  const exportWeeklyDigestAsCsvMock =
    exportWeeklyDigestAsCsv as jest.MockedFunction<typeof exportWeeklyDigestAsCsv>;
  const exportWeeklyDigestAsPdfMock =
    exportWeeklyDigestAsPdf as jest.MockedFunction<typeof exportWeeklyDigestAsPdf>;
  const shareWeeklyDigestMock =
    shareWeeklyDigest as jest.MockedFunction<typeof shareWeeklyDigest>;
  const getMailServiceAvailabilityMock =
    getMailServiceAvailability as jest.MockedFunction<typeof getMailServiceAvailability>;

  beforeEach(() => {
    jest.clearAllMocks();
    getMailServiceAvailabilityMock.mockReturnValue({
      available: false,
      reason: "Email sharing is not configured in this environment.",
    });
    app = express();
    app.use(express.json());
    app.use("/api/analytics", analyticsRouter);
    app.use(errorHandler);
  });

  it("allows admins to fetch analytics KPIs", async () => {
    getAnalyticsKpisMock.mockResolvedValueOnce({
      totalAnalyses: 5,
      analysesWithIssuesPercentage: 80,
      averageIssuesPerAnalysis: 1.2,
      distinctIssueCategories: 3,
      reportsThisMonth: 5,
      reportsLastMonth: 4,
      avgIssuesPerReport: 1.2,
      avgIssuesLastMonth: 1.5,
      passRate: 20,
      passRateLastMonth: 25,
      timeSaved: 75,
    });

    const response = await request(app)
      .get("/api/analytics/kpis?dateFrom=2026-03-01&dateTo=2026-03-31")
      .set("x-test-role", "ADMIN");

    expect(response.status).toBe(200);
    expect(response.body.totalAnalyses).toBe(5);
    expect(getAnalyticsKpisMock).toHaveBeenCalledTimes(1);
  });

  it("denies consultants from analytics endpoints", async () => {
    const response = await request(app)
      .get("/api/analytics/kpis")
      .set("x-test-role", "CONSULTANT");

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "Admin access required" });
  });

  it("returns section-density data for admins", async () => {
    getAnalyticsSectionDensityMock.mockResolvedValueOnce([
      { section: "Summary", issueCount: 3, issueDensity: 0.75 },
    ]);

    const response = await request(app)
      .get("/api/analytics/section-density?issueType=TEMPLATE_ARTIFACT")
      .set("x-test-role", "ADMIN");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { section: "Summary", issueCount: 3, issueDensity: 0.75 },
    ]);
  });

  it("maps invalid requests into the standard error envelope", async () => {
    getAnalyticsIssueTypesMock.mockRejectedValueOnce(
      new ApiError(400, "invalid_request", "issueType must be a valid issue category."),
    );

    const response = await request(app)
      .get("/api/analytics/issue-types?issueType=BAD_TYPE")
      .set("x-test-role", "ADMIN");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      code: "invalid_request",
      message: "issueType must be a valid issue category.",
    });
  });

  it("returns trend data for admins", async () => {
    getAnalyticsTrendsMock.mockResolvedValueOnce([
      { label: "01 Mar", analyses: 2, issues: 5, falsePositives: 1 },
    ]);

    const response = await request(app)
      .get("/api/analytics/trends")
      .set("x-test-role", "ADMIN");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ label: "01 Mar", analyses: 2, issues: 5, falsePositives: 1 }]);
  });

  it("returns recurring issue rate data for admins", async () => {
    getRecurringIssueRateMock.mockResolvedValueOnce([
      {
        label: "W/C 03 Mar",
        analyses: 6,
        reportsWithRepeatedCategories: 2,
        recurringIssueRate: 33.33,
      },
    ]);

    const response = await request(app)
      .get("/api/analytics/recurring-issue-rate")
      .set("x-test-role", "ADMIN");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        label: "W/C 03 Mar",
        analyses: 6,
        reportsWithRepeatedCategories: 2,
        recurringIssueRate: 33.33,
      },
    ]);
  });

  it("returns consultant quality signals for admins", async () => {
    getConsultantQualitySignalsMock.mockResolvedValueOnce([
      {
        consultantId: 5,
        consultantEmail: "sarah@ligtas.com",
        analysesRun: 8,
        withIssuesPercentage: 62.5,
        averageIssuesPerReport: 3.4,
        mostFrequentCategory: "Template Artifact",
      },
    ]);

    const response = await request(app)
      .get("/api/analytics/consultant-signals")
      .set("x-test-role", "ADMIN");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        consultantId: 5,
        consultantEmail: "sarah@ligtas.com",
        analysesRun: 8,
        withIssuesPercentage: 62.5,
        averageIssuesPerReport: 3.4,
        mostFrequentCategory: "Template Artifact",
      },
    ]);
  });

  it("returns a weekly digest CSV attachment for admins", async () => {
    exportWeeklyDigestAsCsvMock.mockResolvedValueOnce({
      fileName: "qc-weekly-digest__2026-03-16__to__2026-03-22__generated-2026-03-23T09-00-00Z.csv",
      contentType: "text/csv; charset=utf-8",
      buffer: Buffer.from("section,key,value\nsummary,total_analyses,12\n", "utf-8"),
    });

    const response = await request(app)
      .get("/api/analytics/weekly-digest/export?format=csv&weekStart=2026-03-18&consultantId=5")
      .set("x-test-role", "ADMIN");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.headers["content-disposition"]).toContain(
      "qc-weekly-digest__2026-03-16__to__2026-03-22__generated-2026-03-23T09-00-00Z.csv",
    );
    expect(exportWeeklyDigestAsCsvMock).toHaveBeenCalledWith({
      weekStart: "2026-03-18",
      consultantId: "5",
      issueType: undefined,
    });
  });

  it("returns a weekly digest PDF attachment for admins", async () => {
    exportWeeklyDigestAsPdfMock.mockResolvedValueOnce({
      fileName: "qc-weekly-digest__2026-03-16__to__2026-03-22__generated-2026-03-23T09-00-00Z.pdf",
      contentType: "application/pdf",
      buffer: Buffer.from("%PDF-1.7", "utf-8"),
    });

    const response = await request(app)
      .get("/api/analytics/weekly-digest/export?format=pdf&weekStart=2026-03-18&issueType=TEMPLATE_ARTIFACT")
      .set("x-test-role", "ADMIN");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/pdf");
    expect(exportWeeklyDigestAsPdfMock).toHaveBeenCalledWith({
      weekStart: "2026-03-18",
      consultantId: undefined,
      issueType: "TEMPLATE_ARTIFACT",
    });
  });

  it("rejects invalid weekly digest export formats", async () => {
    const response = await request(app)
      .get("/api/analytics/weekly-digest/export?format=docx&weekStart=2026-03-18")
      .set("x-test-role", "ADMIN");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      code: "invalid_request",
      message: "format must be csv or pdf.",
    });
  });

  it("maps weekly digest validation errors into the standard error envelope", async () => {
    exportWeeklyDigestAsCsvMock.mockRejectedValueOnce(
      new ApiError(400, "invalid_request", "weekStart is required."),
    );

    const response = await request(app)
      .get("/api/analytics/weekly-digest/export?format=csv")
      .set("x-test-role", "ADMIN");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      code: "invalid_request",
      message: "weekStart is required.",
    });
  });

  it("returns weekly digest share availability for admins", async () => {
    const response = await request(app)
      .get("/api/analytics/weekly-digest/availability")
      .set("x-test-role", "ADMIN");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      sharingAvailable: false,
      sharingUnavailableReason: "Email sharing is not configured in this environment.",
    });
  });

  it("returns 400 for invalid weekly digest share formats", async () => {
    const response = await request(app)
      .post("/api/analytics/weekly-digest/share")
      .set("x-test-role", "ADMIN")
      .send({
        format: "docx",
        weekStart: "2026-03-18",
        recipientEmail: "reviewer@example.com",
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      code: "invalid_request",
      message: "format must be csv or pdf.",
    });
    expect(shareWeeklyDigestMock).not.toHaveBeenCalled();
  });

  it("validates required weekly digest share fields before calling the service", async () => {
    const response = await request(app)
      .post("/api/analytics/weekly-digest/share")
      .set("x-test-role", "ADMIN")
      .send({
        format: "pdf",
        weekStart: "2026-03-18",
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      code: "invalid_request",
      message: "recipientEmail is required.",
    });
    expect(shareWeeklyDigestMock).not.toHaveBeenCalled();
  });

  it("returns 200 when the weekly digest email is sent", async () => {
    shareWeeklyDigestMock.mockResolvedValueOnce({
      recipientEmail: "reviewer@example.com",
      format: "pdf",
      fileName: "qc-weekly-digest__2026-03-16__to__2026-03-22__generated-2026-03-23T09-00-00Z.pdf",
    });

    const response = await request(app)
      .post("/api/analytics/weekly-digest/share")
      .set("x-test-role", "ADMIN")
      .send({
        format: "pdf",
        weekStart: "2026-03-18",
        consultantId: "5",
        issueType: "TEMPLATE_ARTIFACT",
        recipientEmail: "reviewer@example.com",
        message: "Please review this week's summary.",
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      recipientEmail: "reviewer@example.com",
      format: "pdf",
      fileName: "qc-weekly-digest__2026-03-16__to__2026-03-22__generated-2026-03-23T09-00-00Z.pdf",
      message: "Weekly digest email sent successfully.",
    });
    expect(shareWeeklyDigestMock).toHaveBeenCalledWith({
      format: "pdf",
      weekStart: "2026-03-18",
      consultantId: "5",
      issueType: "TEMPLATE_ARTIFACT",
      recipientEmail: "reviewer@example.com",
      actorUserId: 7,
      message: "Please review this week's summary.",
      senderEmail: "tester@ligtas.com",
      senderRole: "ADMIN",
    });
  });

  it("maps weekly digest share validation errors into the standard error envelope", async () => {
    shareWeeklyDigestMock.mockRejectedValueOnce(
      new ApiError(400, "invalid_request", "recipientEmail must be a valid email address."),
    );

    const response = await request(app)
      .post("/api/analytics/weekly-digest/share")
      .set("x-test-role", "ADMIN")
      .send({
        format: "csv",
        weekStart: "2026-03-18",
        recipientEmail: "not-an-email",
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      code: "invalid_request",
      message: "recipientEmail must be a valid email address.",
    });
  });

  it("maps weekly digest rate limiting into the standard error envelope", async () => {
    shareWeeklyDigestMock.mockRejectedValueOnce(
      new ApiError(429, "rate_limited", "Too many email share requests. Please try again later."),
    );

    const response = await request(app)
      .post("/api/analytics/weekly-digest/share")
      .set("x-test-role", "ADMIN")
      .send({
        format: "pdf",
        weekStart: "2026-03-18",
        recipientEmail: "reviewer@example.com",
      });

    expect(response.status).toBe(429);
    expect(response.body).toEqual({
      code: "rate_limited",
      message: "Too many email share requests. Please try again later.",
    });
  });
});
