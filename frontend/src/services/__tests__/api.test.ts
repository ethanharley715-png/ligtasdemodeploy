import { describe, expect, it, vi, afterEach } from "vitest";
import { sessionQcApi } from "../api";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("sessionQcApi", () => {
  it("uses cookie auth and does not depend on browser token storage", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        reportSessionId: "s1",
        reportId: "r1",
        filename: "report.pdf",
        analysisStatus: "completed",
        summary: {
          totalIssues: 0,
          criticalIssues: 0,
          mediumIssues: 0,
          lowIssues: 0,
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
        analyzedAt: null,
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    await sessionQcApi.analyze("session-123");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0];
    expect(options?.credentials).toBe("include");
    expect(options?.headers).toEqual({});
  });

  it("appends scanMode when requested", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        reportSessionId: "s1",
        reportId: "r1",
        filename: "report.pdf",
        scanSource: "rules",
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
        analyzedAt: null,
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    await sessionQcApi.analyze("session-123", "rules");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/reports/sessions/session-123/analyze?scanMode=rules",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });

  it("throws with message from error response body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ message: "Server exploded" }),
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(sessionQcApi.getResults("session-404")).rejects.toThrow("Server exploded");
  });
});
