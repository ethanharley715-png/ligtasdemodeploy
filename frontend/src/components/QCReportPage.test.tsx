import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import QCReportPage from "./views/QCResultsView";
import type { QCReport } from "./types/qc";

const { getReportMock } = vi.hoisted(() => ({
  getReportMock: vi.fn(),
}));

vi.mock("../services/api", async () => {
  const actual = await vi.importActual<typeof import("../services/api")>("../services/api");

  return {
    ...actual,
    reportsApi: {
      ...actual.reportsApi,
      get: getReportMock,
    },
  };
});

const mockReport: QCReport = {
  summary: {
    passed: false,
    totalIssues: 3,
  },
  issues: [
    {
      id: "1",
      type: "Fire Safety",
      message: "Missing fire escape plan",
      location: "Section 4.2",
    },
    {
      id: "2",
      type: "Documentation",
      message: "Incomplete emergency procedures",
    },
    {
      id: "3",
      type: "Fire Safety",
      message: "Minor formatting issue",
    },
  ],
};

describe("QCReportPage", () => {
  beforeEach(() => {
    getReportMock.mockReset();
    getReportMock.mockRejectedValue(new Error("not needed"));
  });

  it("renders page header", () => {
    render(<QCReportPage reportId={null} fileName={null} report={mockReport} />);

    expect(screen.getByText("QC Analysis Results")).toBeInTheDocument();

    expect(
      screen.getByText(
        "Summary of quality control checks performed on your uploaded report.",
      ),
    ).toBeInTheDocument();
  });

  it("shows fail chip when report fails", () => {
    render(<QCReportPage reportId={null} fileName={null} report={mockReport} />);

    expect(screen.getByText("FAIL")).toBeInTheDocument();
  });

  it("renders summary cards", async () => {
    getReportMock.mockResolvedValueOnce({
      id: "report-123",
      fileName: "Fire Risk Assessment.pdf",
      status: "COMPLETED",
      uploadedAt: "2026-04-02T10:00:00.000Z",
      analyzedAt: "2026-04-02T10:00:05.000Z",
      processingTimeSeconds: 5,
      totalIssues: 3,
      passedQC: false,
      analyst: "consultant@ligtas.com",
      sharingAvailable: false,
      sharingUnavailableReason: null,
      issues: [],
    });

    render(
      <QCReportPage
        reportId="report-123"
        fileName="Fire Risk Assessment.pdf"
        report={mockReport}
      />,
    );

    expect(await screen.findByText("Total Issues Found")).toBeInTheDocument();
    expect(screen.getByText("Report ID")).toBeInTheDocument();
    expect(screen.getByText("Filename")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("3")).toBeInTheDocument();
      expect(screen.getByText("report-123")).toBeInTheDocument();
      expect(screen.getByText("Fire Risk Assessment.pdf")).toBeInTheDocument();
    });
  });

  it("renders breakdown by issue type", () => {
    render(<QCReportPage reportId={null} fileName={null} report={mockReport} />);

    expect(screen.getByText("Breakdown by Issue Type")).toBeInTheDocument();

    expect(screen.getAllByText("Fire Safety").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Documentation").length).toBeGreaterThan(0);
  });

  it("renders detailed issues", () => {
    render(<QCReportPage reportId={null} fileName={null} report={mockReport} />);

    expect(screen.getByText("Detailed Issues")).toBeInTheDocument();

    expect(screen.getAllByText("Missing fire escape plan").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Incomplete emergency procedures").length).toBeGreaterThan(0);
  });

  it("renders location when provided", () => {
    render(<QCReportPage reportId={null} fileName={null} report={mockReport} />);

    expect(screen.getByText("LOCATION")).toBeInTheDocument();
    expect(screen.getAllByText("Section 4.2").length).toBeGreaterThan(0);
  });

  it("shows PASS chip when report passes", () => {
    const passingReport: QCReport = {
      ...mockReport,
      summary: { ...mockReport.summary, passed: true },
    };

    render(<QCReportPage reportId={null} fileName={null} report={passingReport} />);

    expect(screen.getByText("PASS")).toBeInTheDocument();
  });
});
