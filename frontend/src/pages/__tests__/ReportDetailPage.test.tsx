import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ReportDetailPage from "../ReportDetailPage";
import { reportsApi } from "../../services/api";
import { buildAnnotatedPdfExport } from "../../utils/annotatedPdfExport";

const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock("../../services/api", () => ({
  reportsApi: {
    get: vi.fn(),
    exportResult: vi.fn(),
    updateIssueReviewStatus: vi.fn(),
  },
  authApi: {
    me: vi.fn().mockResolvedValue({ id: 1, name: "Test", email: "test@ligtas.com", role: "consultant" }),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

vi.mock("../../utils/annotatedPdfExport", () => ({
  buildAnnotatedPdfExport: vi.fn(),
}));

describe("ReportDetailPage", () => {
  const getMock = vi.mocked(reportsApi.get);
  const exportMock = vi.mocked(reportsApi.exportResult);
  const annotatedExportMock = vi.mocked(buildAnnotatedPdfExport);
  const updateIssueReviewStatusMock = vi.mocked(reportsApi.updateIssueReviewStatus);

  beforeEach(() => {
    vi.clearAllMocks();
    URL.createObjectURL = vi.fn(() => "blob:mock-url");
    URL.revokeObjectURL = vi.fn();
  });

  function renderPage(initialEntry = "/reports/rep_123") {
    return render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/reports" element={<div>Report history</div>} />
          <Route path="/reports/:id" element={<ReportDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it("navigates to report history when Back to Reports is clicked", async () => {
    getMock.mockResolvedValueOnce({
      id: "rep_123",
      fileName: "Fire Risk Assessment.pdf",
      status: "COMPLETED",
      uploadedAt: "2026-03-20T09:00:00.000Z",
      analyzedAt: "2026-03-20T09:05:00.000Z",
      processingTimeSeconds: 5,
      totalIssues: 0,
      passedQC: true,
      analyst: "consultant@ligtas.com",
      sharingAvailable: true,
      sharingUnavailableReason: null,
      issues: [],
    });

    renderPage();

    await screen.findByRole("heading", { name: /fire risk assessment\.pdf/i });
    const back = screen.getByRole("button", { name: /back to reports/i });
    expect(back).toBeVisible();
    expect(back).toHaveAttribute("aria-label", "Back to Reports");
    expect(back.className).toMatch(/hover:bg-muted/);
    await userEvent.click(back);

    expect(await screen.findByText("Report history")).toBeInTheDocument();
  });

  it("shows the export action for completed reports and triggers CSV download", async () => {
    const appendSpy = vi.spyOn(document.body, "appendChild");
    const removeSpy = vi.spyOn(HTMLElement.prototype, "remove");
    const clickSpy = vi.spyOn(HTMLElement.prototype, "click").mockImplementation(() => {});

    getMock.mockResolvedValueOnce({
      id: "rep_123",
      fileName: "Fire Risk Assessment.pdf",
      status: "COMPLETED",
      uploadedAt: "2026-03-20T09:00:00.000Z",
      analyzedAt: "2026-03-20T09:05:00.000Z",
      processingTimeSeconds: 5,
      totalIssues: 1,
      passedQC: false,
      analyst: "consultant@ligtas.com",
      sharingAvailable: true,
      sharingUnavailableReason: null,
      issues: [
        {
          id: "issue-1",
          type: "Template Artifact",
          description: "Placeholder value detected.",
          location: "Summary",
          context: "[XXX]",
          suggestion: "Replace placeholder values with real report details.",
          pageNumber: 1,
          reviewStatus: "OPEN",
          reviewedAt: null,
        },
      ],
    });

    exportMock.mockResolvedValueOnce({
      blob: new Blob(["csv"], { type: "text/csv" }),
      fileName:
        "Fire-Risk-Assessment__rep_123__qc-results__2026-03-20__generated-2026-03-20T12-00-00Z.csv",
      contentType: "text/csv",
    });

    renderPage();

    await screen.findByRole("heading", { name: /fire risk assessment\.pdf/i });
    await userEvent.click(screen.getByRole("button", { name: /export results/i }));
    await userEvent.click(screen.getByRole("button", { name: /download csv/i }));

    await waitFor(() => {
      expect(exportMock).toHaveBeenCalledWith("rep_123", "csv");
    });

    expect(appendSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
    expect(toastSuccessMock).toHaveBeenCalled();
  });

  it("disables export when the report is still processing", async () => {
    getMock.mockResolvedValueOnce({
      id: "rep_456",
      fileName: "Processing Report.pdf",
      status: "PROCESSING",
      uploadedAt: "2026-03-20T09:00:00.000Z",
      analyzedAt: null,
      processingTimeSeconds: null,
      totalIssues: 0,
      passedQC: false,
      analyst: "consultant@ligtas.com",
      sharingAvailable: false,
      sharingUnavailableReason: "Email sharing is not configured in this environment.",
      issues: [],
    });

    renderPage();

    const button = await screen.findByRole("button", { name: /export results/i });
    expect(button).toBeDisabled();
    expect(screen.getByText(/export becomes available once qc analysis is complete/i)).toBeInTheDocument();
  });

  it("filters issues when the page filter is changed", async () => {
    getMock.mockResolvedValueOnce({
      id: "rep_789",
      fileName: "Mapped Report.pdf",
      status: "COMPLETED",
      uploadedAt: "2026-03-20T09:00:00.000Z",
      analyzedAt: "2026-03-20T09:05:00.000Z",
      processingTimeSeconds: 6,
      totalIssues: 2,
      passedQC: false,
      analyst: "consultant@ligtas.com",
      sharingAvailable: true,
      sharingUnavailableReason: null,
      issues: [
        {
          id: "issue-page-4",
          type: "Template Artifact",
          description: "Page four issue.",
          location: "1. Summary",
          context: "Page four issue.",
          suggestion: "Fix page four.",
          pageNumber: 4,
          reviewStatus: "OPEN",
          reviewedAt: null,
        },
        {
          id: "issue-page-12",
          type: "Missing Information",
          description: "Page twelve issue.",
          location: "5.7. Construction Details",
          context: "Page twelve issue.",
          suggestion: "Fix page twelve.",
          pageNumber: 12,
          reviewStatus: "OPEN",
          reviewedAt: null,
        },
      ],
    });

    renderPage();

    await screen.findByRole("heading", { name: /mapped report\.pdf/i });
    await userEvent.selectOptions(screen.getByDisplayValue(/all pages/i), "12");

    expect(screen.getByText(/showing 1 of 2 issues/i)).toBeInTheDocument();
    expect(screen.getAllByText(/page twelve issue\./i).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/page four issue\./i)).toHaveLength(0);
  });

  it("shows the PDF review action on the report page", async () => {
    getMock.mockResolvedValueOnce({
      id: "rep_modal",
      fileName: "Reviewable Report.pdf",
      status: "COMPLETED",
      uploadedAt: "2026-03-20T09:00:00.000Z",
      analyzedAt: "2026-03-20T09:05:00.000Z",
      processingTimeSeconds: 6,
      totalIssues: 1,
      passedQC: false,
      analyst: "consultant@ligtas.com",
      sharingAvailable: true,
      sharingUnavailableReason: null,
      issues: [
        {
          id: "issue-1",
          type: "Template Artifact",
          description: "Placeholder value detected.",
          location: "Summary",
          context: "[XXX]",
          suggestion: "Replace placeholder values with real report details.",
          pageNumber: 4,
          reviewStatus: "OPEN",
          reviewedAt: null,
        },
      ],
    });

    renderPage();

    await screen.findByRole("heading", { name: /reviewable report\.pdf/i });
    expect(screen.getByRole("button", { name: /open pdf review/i })).toBeInTheDocument();
  });

  it("generates an annotated PDF export from a locally attached PDF", async () => {
    const appendSpy = vi.spyOn(document.body, "appendChild");
    const removeSpy = vi.spyOn(HTMLElement.prototype, "remove");
    const clickSpy = vi.spyOn(HTMLElement.prototype, "click").mockImplementation(() => {});

    getMock.mockResolvedValueOnce({
      id: "rep_annotated",
      fileName: "Annotated Report.pdf",
      status: "COMPLETED",
      uploadedAt: "2026-03-20T09:00:00.000Z",
      analyzedAt: "2026-03-20T09:05:00.000Z",
      processingTimeSeconds: 6,
      totalIssues: 1,
      passedQC: false,
      analyst: "consultant@ligtas.com",
      sharingAvailable: true,
      sharingUnavailableReason: null,
      issues: [
        {
          id: "issue-1",
          type: "Template Artifact",
          description: "Placeholder value detected.",
          location: "Summary",
          context: "[XXX]",
          suggestion: "Replace placeholder values with real report details.",
          pageNumber: 1,
          reviewStatus: "OPEN",
          reviewedAt: null,
        },
      ],
    });
    annotatedExportMock.mockResolvedValueOnce({
      blob: new Blob(["%PDF"], { type: "application/pdf" }),
      fileName: "Annotated-Report__rep_annotated__annotated-qc__generated-test.pdf",
      annotatedIssueCount: 1,
      skippedIssueCount: 0,
    });

    renderPage("/reports/rep_annotated");

    await screen.findByRole("heading", { name: /annotated report\.pdf/i });
    await userEvent.click(screen.getByRole("button", { name: /export results/i }));

    const sourcePdf = new File(["source"], "source.pdf", { type: "application/pdf" });
    await userEvent.upload(screen.getByLabelText(/source pdf for annotated pdf/i), sourcePdf);
    await userEvent.click(screen.getByRole("button", { name: /download annotated pdf/i }));

    await waitFor(() => {
      expect(annotatedExportMock).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceFile: sourcePdf,
          reportId: "rep_annotated",
          reportFileName: "Annotated Report.pdf",
        }),
      );
    });
    expect(appendSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
    expect(toastSuccessMock).toHaveBeenCalledWith(
      "Annotated PDF export ready",
      expect.objectContaining({
        description: expect.stringContaining("generated locally"),
      }),
    );
  });

  it("keeps mark complete as an issue review action", async () => {
    getMock.mockResolvedValueOnce({
      id: "rep_issue_complete",
      fileName: "Issue Complete Report.pdf",
      status: "COMPLETED",
      uploadedAt: "2026-03-20T09:00:00.000Z",
      analyzedAt: "2026-03-20T09:05:00.000Z",
      processingTimeSeconds: 6,
      totalIssues: 1,
      passedQC: false,
      analyst: "consultant@ligtas.com",
      sharingAvailable: true,
      sharingUnavailableReason: null,
      issues: [
        {
          id: "issue-complete",
          type: "Template Artifact",
          description: "Placeholder value detected.",
          location: "Summary",
          context: "[XXX]",
          suggestion: "Replace placeholder values with real report details.",
          pageNumber: 4,
          reviewStatus: "OPEN",
          reviewedAt: null,
        },
      ],
    });
    updateIssueReviewStatusMock.mockResolvedValueOnce({
      id: "issue-complete",
      reviewStatus: "COMPLETED",
      reviewedAt: "2026-03-20T10:00:00.000Z",
    });

    renderPage("/reports/rep_issue_complete");

    await screen.findByRole("heading", { name: /issue complete report\.pdf/i });
    await userEvent.click(screen.getByRole("button", { name: /mark complete/i }));

    await waitFor(() => {
      expect(updateIssueReviewStatusMock).toHaveBeenCalledWith("issue-complete", "COMPLETED");
    });
    expect(screen.getAllByText("Completed").length).toBeGreaterThan(0);
  });

  it("flags an open issue as false positive from the issue card header", async () => {
    getMock.mockResolvedValueOnce({
      id: "rep_false_positive",
      fileName: "False Positive Report.pdf",
      status: "COMPLETED",
      uploadedAt: "2026-03-20T09:00:00.000Z",
      analyzedAt: "2026-03-20T09:05:00.000Z",
      processingTimeSeconds: 6,
      totalIssues: 1,
      passedQC: false,
      analyst: "consultant@ligtas.com",
      sharingAvailable: true,
      sharingUnavailableReason: null,
      issues: [
        {
          id: "issue-false-positive",
          type: "Template Artifact",
          description: "Placeholder value detected.",
          location: "Summary",
          context: "[XXX]",
          suggestion: "Replace placeholder values with real report details.",
          pageNumber: 4,
          reviewStatus: "OPEN",
          reviewedAt: null,
        },
      ],
    });
    updateIssueReviewStatusMock.mockResolvedValueOnce({
      id: "issue-false-positive",
      reviewStatus: "FALSE_POSITIVE",
      reviewedAt: "2026-03-20T10:00:00.000Z",
    });

    renderPage("/reports/rep_false_positive");

    await screen.findByRole("heading", { name: /false positive report\.pdf/i });
    await userEvent.click(screen.getByRole("button", { name: /flag as false positive/i }));

    await waitFor(() => {
      expect(updateIssueReviewStatusMock).toHaveBeenCalledWith("issue-false-positive", "FALSE_POSITIVE");
    });
    expect(await screen.findByRole("button", { name: /remove false positive flag/i })).toBeInTheDocument();
  });

  it("removes a false positive flag from the issue card header", async () => {
    getMock.mockResolvedValueOnce({
      id: "rep_unflag",
      fileName: "Unflag Report.pdf",
      status: "COMPLETED",
      uploadedAt: "2026-03-20T09:00:00.000Z",
      analyzedAt: "2026-03-20T09:05:00.000Z",
      processingTimeSeconds: 6,
      totalIssues: 1,
      passedQC: false,
      analyst: "consultant@ligtas.com",
      sharingAvailable: true,
      sharingUnavailableReason: null,
      issues: [
        {
          id: "issue-unflag",
          type: "Template Artifact",
          description: "Placeholder value detected.",
          location: "Summary",
          context: "[XXX]",
          suggestion: "Replace placeholder values with real report details.",
          pageNumber: 4,
          reviewStatus: "FALSE_POSITIVE",
          reviewedAt: "2026-03-20T10:00:00.000Z",
        },
      ],
    });
    updateIssueReviewStatusMock.mockResolvedValueOnce({
      id: "issue-unflag",
      reviewStatus: "OPEN",
      reviewedAt: null,
    });

    renderPage("/reports/rep_unflag");

    await screen.findByRole("heading", { name: /unflag report\.pdf/i });
    await userEvent.click(screen.getByRole("button", { name: /remove false positive flag/i }));

    await waitFor(() => {
      expect(updateIssueReviewStatusMock).toHaveBeenCalledWith("issue-unflag", "OPEN");
    });
    expect(await screen.findByRole("button", { name: /flag as false positive/i })).toBeInTheDocument();
  });

  it("restores the previous issue status when false positive flag update fails", async () => {
    getMock.mockResolvedValueOnce({
      id: "rep_flag_error",
      fileName: "Flag Error Report.pdf",
      status: "COMPLETED",
      uploadedAt: "2026-03-20T09:00:00.000Z",
      analyzedAt: "2026-03-20T09:05:00.000Z",
      processingTimeSeconds: 6,
      totalIssues: 1,
      passedQC: false,
      analyst: "consultant@ligtas.com",
      sharingAvailable: true,
      sharingUnavailableReason: null,
      issues: [
        {
          id: "issue-flag-error",
          type: "Template Artifact",
          description: "Placeholder value detected.",
          location: "Summary",
          context: "[XXX]",
          suggestion: "Replace placeholder values with real report details.",
          pageNumber: 4,
          reviewStatus: "OPEN",
          reviewedAt: null,
        },
      ],
    });
    updateIssueReviewStatusMock.mockRejectedValueOnce(new Error("Unable to update issue."));

    renderPage("/reports/rep_flag_error");

    await screen.findByRole("heading", { name: /flag error report\.pdf/i });
    await userEvent.click(screen.getByRole("button", { name: /flag as false positive/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalled();
    });
    expect(screen.getByRole("button", { name: /flag as false positive/i })).toBeInTheDocument();
  });

  it("shows an error toast when export fails", async () => {
    getMock.mockResolvedValueOnce({
      id: "rep_123",
      fileName: "Fire Risk Assessment.pdf",
      status: "COMPLETED",
      uploadedAt: "2026-03-20T09:00:00.000Z",
      analyzedAt: "2026-03-20T09:05:00.000Z",
      processingTimeSeconds: 5,
      totalIssues: 1,
      passedQC: false,
      analyst: "consultant@ligtas.com",
      sharingAvailable: true,
      sharingUnavailableReason: null,
      issues: [],
    });

    exportMock.mockRejectedValueOnce(new Error("QC results are not ready for export yet."));

    renderPage();

    await screen.findByRole("heading", { name: /fire risk assessment\.pdf/i });
    await userEvent.click(screen.getByRole("button", { name: /export results/i }));
    await userEvent.click(screen.getByRole("button", { name: /download pdf/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalled();
    });
  });

  it("opens a Gmail draft from the export dialog as a manual fallback", async () => {
    const appendSpy = vi.spyOn(document.body, "appendChild");
    const clickSpy = vi.spyOn(HTMLElement.prototype, "click").mockImplementation(() => {});

    getMock.mockResolvedValueOnce({
      id: "rep_123",
      fileName: "Fire Risk Assessment.pdf",
      status: "COMPLETED",
      uploadedAt: "2026-03-20T09:00:00.000Z",
      analyzedAt: "2026-03-20T09:05:00.000Z",
      processingTimeSeconds: 5,
      totalIssues: 1,
      passedQC: false,
      analyst: "consultant@ligtas.com",
      sharingAvailable: true,
      sharingUnavailableReason: null,
      issues: [],
    });

    renderPage();

    await screen.findByRole("heading", { name: /fire risk assessment\.pdf/i });
    await userEvent.click(screen.getByRole("button", { name: /export results/i }));
    await userEvent.click(screen.getByRole("button", { name: /open gmail/i }));

    expect(clickSpy).toHaveBeenCalled();
    const anchor = appendSpy.mock.calls.at(-1)?.[0] as HTMLAnchorElement;
    const url = new URL(anchor.href);
    expect(url.origin).toBe("https://mail.google.com");
    expect(url.pathname).toBe("/mail/");
    expect(url.searchParams.get("su")).toBe("QC results export for report rep_123");
    expect(url.searchParams.get("body")).toContain("Please find the QC results for report rep_123");
  });
});


