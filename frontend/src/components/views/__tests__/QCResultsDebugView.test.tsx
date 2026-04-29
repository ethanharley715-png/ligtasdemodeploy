import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QCResultsDebugView } from "../QCResultsDebugView";

const { analyzeMock, getResultsMock } = vi.hoisted(() => ({
  analyzeMock: vi.fn(),
  getResultsMock: vi.fn(),
}));

vi.mock("../../../services/api", async () => {
  const actual = await vi.importActual<typeof import("../../../services/api")>("../../../services/api");
  return {
    ...actual,
    sessionQcApi: {
      analyze: analyzeMock,
      getResults: getResultsMock,
    },
  };
});

describe("QCResultsDebugView", () => {
  beforeEach(() => {
    analyzeMock.mockReset();
    getResultsMock.mockReset();
    localStorage.clear();
  });

  it("triggers analyze and renders summary data", async () => {
    analyzeMock.mockResolvedValueOnce({
      reportSessionId: "session-123",
      reportId: "rep-1",
      filename: "report.pdf",
      scanSource: "rules",
      analysisStatus: "completed",
      summary: {
        totalIssues: 2,
        criticalIssues: 0,
        mediumIssues: 2,
        lowIssues: 0,
        passedQC: true,
        byType: {
          template_artifact: 1,
          unremoved_guidance: 1,
          missing_information: 0,
          contradiction: 0,
          limitation_contradiction: 0,
          incomplete_limitations: 0,
        },
      },
      issues: [
        {
          id: "issue-1",
          type: "template_artifact",
          severity: "medium",
          ruleKey: "placeholder_xxx",
          message: "Placeholder value '[XXX]' detected.",
          suggestion: "Replace placeholder values with real report details.",
          section: "Summary",
          location: { page: 1, section: "Summary" },
          anchor: {
            mode: "page",
            targetText: "[XXX]",
            startPage: 1,
            endPage: 1,
          },
          context: "[XXX]",
        },
      ],
      analyzedAt: "2026-03-06T11:00:00.000Z",
    });

    const user = userEvent.setup();
    render(<QCResultsDebugView />);

    await user.type(screen.getByLabelText(/Report Session ID/i), "session-123");
    await user.click(screen.getByRole("button", { name: /Analyze Session \(Rules\)/i }));

    await waitFor(() => {
      expect(analyzeMock).toHaveBeenCalledWith("session-123", "rules", undefined, undefined);
    });

    expect(await screen.findByText("rep-1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("rules")).toBeInTheDocument();
    expect(screen.getByText("Rule: placeholder_xxx")).toBeInTheDocument();
    expect(screen.getByText("Context: [XXX]")).toBeInTheDocument();
    expect(screen.getByText("Anchor: page | Pages: 1")).toBeInTheDocument();
    expect(screen.getByText("Target text: [XXX]")).toBeInTheDocument();
  });

  it("shows fetch error text", async () => {
    getResultsMock.mockRejectedValueOnce(new Error("QC results not found for this session."));

    const user = userEvent.setup();
    render(<QCResultsDebugView />);

    await user.type(screen.getByLabelText(/Report Session ID/i), "missing-session");
    await user.click(screen.getByRole("button", { name: /Fetch Results/i }));

    expect(await screen.findByText("QC results not found for this session.")).toBeInTheDocument();
  });
});
