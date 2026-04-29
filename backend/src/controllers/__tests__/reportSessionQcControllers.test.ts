import express from "express";
import request from "supertest";
import { describe, beforeEach, expect, it, jest } from "@jest/globals";
import { analyzeReportSessionHandler } from "../analyzeReportSessionController";
import { getSessionQcResultsHandler } from "../getSessionQcResultsController";
import { errorHandler } from "../../middleware/errorHandler";
import { ApiError } from "../../errors/apiError";
import { analyzeReportSession, getSessionQcResults } from "../../services/reportAnalysisService";

jest.mock("../../services/reportAnalysisService", () => ({
  analyzeReportSession: jest.fn(),
  getSessionQcResults: jest.fn(),
}));

describe("session QC controllers", () => {
  let app: express.Express;
  let authUser: { userId: number; role: string } | undefined;
  const analyzeReportSessionMock = analyzeReportSession as jest.MockedFunction<typeof analyzeReportSession>;
  const getSessionQcResultsMock = getSessionQcResults as jest.MockedFunction<typeof getSessionQcResults>;

  beforeEach(() => {
    authUser = { userId: 9, role: "CONSULTANT" };
    analyzeReportSessionMock.mockReset();
    getSessionQcResultsMock.mockReset();

    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as { user?: { userId: number; role: string } }).user = authUser;
      next();
    });
    app.post("/api/reports/sessions/:reportSessionId/analyze", analyzeReportSessionHandler);
    app.get("/api/reports/sessions/:reportSessionId/qc-results", getSessionQcResultsHandler);
    app.use(errorHandler);
  });

  it("returns 201 for first analysis", async () => {
    analyzeReportSessionMock.mockResolvedValueOnce({
      created: true,
      result: {
        reportSessionId: "session-1",
        reportId: "rep-1",
        filename: "report.pdf",
        analysisStatus: "completed",
        summary: {
          totalIssues: 1,
          passedQC: true,
          byType: {
            template_artifact: 1,
            unremoved_guidance: 0,
            missing_information: 0,
            contradiction: 0,
            limitation_contradiction: 0,
            incomplete_limitations: 0,
          },
        },
        issues: [],
        analyzedAt: "2026-03-06T10:00:00.000Z",
      },
    });

    const response = await request(app).post("/api/reports/sessions/session-1/analyze").send({});

    expect(response.status).toBe(201);
    expect(response.body.reportSessionId).toBe("session-1");
  });

  it("returns 200 when analysis already exists", async () => {
    analyzeReportSessionMock.mockResolvedValueOnce({
      created: false,
      result: {
        reportSessionId: "session-1",
        reportId: "rep-1",
        filename: "report.pdf",
        analysisStatus: "completed",
        summary: {
          totalIssues: 0,
          passedQC: true,
          byType: {
            template_artifact: 0,
            unremoved_guidance: 0,
            missing_information: 0,
            contradiction: 0,
            limitation_contradiction: 0,
            incomplete_limitations: 0,
          },
        },
        issues: [],
        analyzedAt: "2026-03-06T10:00:00.000Z",
      },
    });

    const response = await request(app).post("/api/reports/sessions/session-1/analyze").send({});

    expect(response.status).toBe(200);
  });

  it("passes aiLocationMode through to session analysis", async () => {
    analyzeReportSessionMock.mockResolvedValueOnce({
      created: true,
      result: {
        reportSessionId: "session-1",
        reportId: "rep-1",
        filename: "report.pdf",
        analysisStatus: "completed",
        summary: {
          totalIssues: 0,
          passedQC: true,
          byType: {
            template_artifact: 0,
            unremoved_guidance: 0,
            missing_information: 0,
            contradiction: 0,
            limitation_contradiction: 0,
            incomplete_limitations: 0,
          },
        },
        issues: [],
        analyzedAt: "2026-03-06T10:00:00.000Z",
      },
    });

    const response = await request(app)
      .post("/api/reports/sessions/session-1/analyze?scanMode=ai&aiLocationMode=canonical_only")
      .send({});

    expect(response.status).toBe(201);
    expect(analyzeReportSessionMock).toHaveBeenCalledWith(
      "session-1",
      { userAccountId: 9, role: "CONSULTANT" },
      undefined,
      undefined,
      undefined,
      "ai",
      { aiLocationMode: "canonical_only" },
    );
  });

  it("returns 200 for session qc-results retrieval", async () => {
    getSessionQcResultsMock.mockResolvedValueOnce({
      reportSessionId: "session-1",
      reportId: "rep-1",
      filename: "report.pdf",
      analysisStatus: "completed",
      summary: {
        totalIssues: 0,
        passedQC: true,
        byType: {
          template_artifact: 0,
          unremoved_guidance: 0,
          missing_information: 0,
          contradiction: 0,
          limitation_contradiction: 0,
          incomplete_limitations: 0,
        },
      },
      issues: [],
      analyzedAt: "2026-03-06T10:00:00.000Z",
    });

    const response = await request(app).get("/api/reports/sessions/session-1/qc-results");

    expect(response.status).toBe(200);
    expect(response.body.reportId).toBe("rep-1");
  });

  it("maps qc results missing to 404 error envelope", async () => {
    getSessionQcResultsMock.mockRejectedValueOnce(
      new ApiError(404, "qc_results_not_found", "QC results not found for this session."),
    );

    const response = await request(app).get("/api/reports/sessions/session-1/qc-results");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      code: "qc_results_not_found",
      message: "QC results not found for this session.",
    });
  });

  it("returns unauthorized envelope when auth user is missing", async () => {
    authUser = undefined;

    const response = await request(app).post("/api/reports/sessions/session-1/analyze").send({});

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      code: "unauthorized",
      message: "Authentication is required.",
    });
  });
});
