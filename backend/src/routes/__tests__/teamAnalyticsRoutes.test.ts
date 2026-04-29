import express from "express";
import request from "supertest";
import teamAnalyticsRouter from "../teamAnalytics";
import { errorHandler } from "../../middleware/errorHandler";
import { ApiError } from "../../errors/apiError";
import {
  getConsultantPerformance,
  getTeamAnalyticsIssueTypes,
  getTeamAnalyticsKpis,
  getTeamAnalyticsTrends,
  getTeamPerformance,
} from "../../services/teamAnalyticsService";

jest.mock("../../middleware/auth", () => ({
  authenticateToken: jest.fn((req, res, next) => {
    const roleHeader = req.headers["x-test-role"];
    if (!roleHeader) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }
    req.user = {
      userId: Number(req.headers["x-test-user-id"] ?? 7),
      email: "tester@ligtas.com",
      role: String(roleHeader),
    };
    next();
  }),
  requireAdminOrTeamManager: jest.fn((req, res, next) => {
    if (req.user?.role !== "ADMIN" && req.user?.role !== "TEAM_MANAGER") {
      res.status(403).json({ message: "Admin or Team Manager access required" });
      return;
    }
    next();
  }),
}));

jest.mock("../../services/teamAnalyticsService", () => ({
  ...jest.requireActual("../../services/teamAnalyticsService"),
  getTeamAnalyticsKpis: jest.fn(),
  getTeamAnalyticsIssueTypes: jest.fn(),
  getTeamAnalyticsTrends: jest.fn(),
  getTeamPerformance: jest.fn(),
  getConsultantPerformance: jest.fn(),
}));

describe("team analytics routes", () => {
  let app: express.Express;
  const getTeamAnalyticsKpisMock = getTeamAnalyticsKpis as jest.MockedFunction<typeof getTeamAnalyticsKpis>;
  const getTeamAnalyticsIssueTypesMock =
    getTeamAnalyticsIssueTypes as jest.MockedFunction<typeof getTeamAnalyticsIssueTypes>;
  const getTeamAnalyticsTrendsMock =
    getTeamAnalyticsTrends as jest.MockedFunction<typeof getTeamAnalyticsTrends>;
  const getTeamPerformanceMock = getTeamPerformance as jest.MockedFunction<typeof getTeamPerformance>;
  const getConsultantPerformanceMock =
    getConsultantPerformance as jest.MockedFunction<typeof getConsultantPerformance>;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use("/api/team-analytics", teamAnalyticsRouter);
    app.use(errorHandler);
  });

  it("allows admins to fetch KPI data", async () => {
    getTeamAnalyticsKpisMock.mockResolvedValueOnce({
      totalReportsAnalysed: 14,
      totalIssuesFound: 32,
      averageIssuesPerReport: 2.29,
      passRate: 42.86,
      failedQcRate: 57.14,
      criticalIssuesCount: 7,
    });

    const response = await request(app)
      .get("/api/team-analytics/kpis?dateFrom=2026-03-01&dateTo=2026-03-31")
      .set("x-test-role", "ADMIN");

    expect(response.status).toBe(200);
    expect(response.body.totalReportsAnalysed).toBe(14);
    expect(getTeamAnalyticsKpisMock).toHaveBeenCalledWith(
      expect.objectContaining({ role: "ADMIN" }),
      expect.objectContaining({ dateFrom: expect.any(Date), dateTo: expect.any(Date) }),
    );
  });

  it("allows team managers to fetch scoped issue breakdown data", async () => {
    getTeamAnalyticsIssueTypesMock.mockResolvedValueOnce([
      { issueType: "TEMPLATE_ARTIFACT", label: "Template Artifact", count: 5 },
    ]);

    const response = await request(app)
      .get("/api/team-analytics/issue-types?teamId=team_other")
      .set("x-test-role", "TEAM_MANAGER")
      .set("x-test-user-id", "12");

    expect(response.status).toBe(200);
    expect(getTeamAnalyticsIssueTypesMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 12, role: "TEAM_MANAGER" }),
      expect.objectContaining({ teamId: "team_other" }),
    );
  });

  it("denies consultants from team analytics endpoints", async () => {
    const response = await request(app)
      .get("/api/team-analytics/kpis")
      .set("x-test-role", "CONSULTANT");

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "Admin or Team Manager access required" });
  });

  it("returns trend data for allowed users", async () => {
    getTeamAnalyticsTrendsMock.mockResolvedValueOnce([
      { label: "01 Mar", reports: 2, issues: 4 },
    ]);

    const response = await request(app)
      .get("/api/team-analytics/trends?teamId=team_ops")
      .set("x-test-role", "ADMIN");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ label: "01 Mar", reports: 2, issues: 4 }]);
  });

  it("returns team performance data for admins", async () => {
    getTeamPerformanceMock.mockResolvedValueOnce([
      {
        teamId: "team_ops",
        teamName: "Operations Team",
        reportsAnalysed: 6,
        averageIssuesPerReport: 2.5,
        reportsWithIssuesPercentage: 66.67,
        mostFrequentIssueCategory: "Template Artifact",
      },
    ]);

    const response = await request(app)
      .get("/api/team-analytics/team-performance")
      .set("x-test-role", "ADMIN");

    expect(response.status).toBe(200);
    expect(response.body[0].teamName).toBe("Operations Team");
  });

  it("returns consultant performance data for a selected team", async () => {
    getConsultantPerformanceMock.mockResolvedValueOnce([
      {
        consultantId: 21,
        consultantName: "Grace Morgan",
        consultantEmail: "grace.morgan@ligtas.com",
        reportsAnalysed: 4,
        averageIssuesPerReport: 1.5,
        reportsWithIssuesPercentage: 50,
        passRate: 75,
        mostFrequentIssueCategory: "Missing Information",
      },
    ]);

    const response = await request(app)
      .get("/api/team-analytics/consultant-performance?teamId=team_comp")
      .set("x-test-role", "ADMIN");

    expect(response.status).toBe(200);
    expect(response.body[0].consultantEmail).toBe("grace.morgan@ligtas.com");
  });

  it("maps validation errors into the standard error envelope", async () => {
    getConsultantPerformanceMock.mockRejectedValueOnce(
      new ApiError(400, "invalid_request", "consultantId can only be used when teamId is provided."),
    );

    const response = await request(app)
      .get("/api/team-analytics/consultant-performance?consultantId=21")
      .set("x-test-role", "ADMIN");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      code: "invalid_request",
      message: "consultantId can only be used when teamId is provided.",
    });
  });
});
