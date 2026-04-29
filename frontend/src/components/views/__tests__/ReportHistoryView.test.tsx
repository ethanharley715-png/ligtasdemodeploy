import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LanguageProvider } from "../../../context/LanguageContext";
import { reportsApi, type ReportListItem } from "../../../services/api";
import { ReportHistoryView } from "../ReportHistoryView";

vi.mock("../../../services/api", () => ({
  reportsApi: {
    list: vi.fn(),
    updateTagStatus: vi.fn(),
  },
}));

describe("ReportHistoryView", () => {
  const listMock = vi.mocked(reportsApi.list);

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("ligtas-language", "en");
  });

  function renderView(userRole: "admin" | "team_manager" | "consultant" = "consultant") {
    return render(
      <LanguageProvider>
        <MemoryRouter>
          <ReportHistoryView userRole={userRole} />
        </MemoryRouter>
      </LanguageProvider>,
    );
  }

  function report(overrides: Partial<ReportListItem>): ReportListItem {
    return {
      id: "rep_123",
      fileName: "Fire Risk Assessment.pdf",
      uploadDate: "2026-03-20T09:00:00.000Z",
      analyst: "consultant@ligtas.com",
      analystUserId: 1,
      status: "failed",
      issuesFound: 1,
      openIssues: 0,
      completedIssues: 1,
      falsePositiveIssues: 0,
      tagStatus: 1,
      reviewStatus: "completed",
      ...overrides,
    };
  }

  it("uses tag status as the report-level workflow instead of the old review status column", async () => {
    listMock.mockResolvedValueOnce([report({})]);

    renderView();

    expect(await screen.findByRole("link", { name: /fire risk assessment\.pdf/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /set status/i })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: /review issues/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/review completed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/0 open, 1 completed, 0 false positive/i)).not.toBeInTheDocument();
  });

  it("filters report history by a selected upload date", async () => {
    const user = userEvent.setup();
    listMock.mockResolvedValueOnce([
      report({ id: "old", fileName: "Old report.pdf", uploadDate: "2026-03-20T09:00:00.000Z" }),
      report({ id: "new", fileName: "New report.pdf", uploadDate: "2026-04-22T09:00:00.000Z" }),
    ]);

    renderView();

    expect(await screen.findByRole("link", { name: /old report\.pdf/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /new report\.pdf/i })).toBeInTheDocument();

    await user.type(screen.getByLabelText(/upload date/i), "2026-04-22");

    expect(screen.queryByRole("link", { name: /old report\.pdf/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /new report\.pdf/i })).toBeInTheDocument();
    expect(screen.getByText(/showing 1 of 2 reports/i)).toBeInTheDocument();
  });

  it("lets admins filter report history by analyst", async () => {
    const user = userEvent.setup();
    listMock.mockResolvedValueOnce([
      report({
        id: "admin-report",
        fileName: "Admin report.pdf",
        analyst: "admin@ligtas.com",
        analystUserId: 1,
      }),
      report({
        id: "consultant-report",
        fileName: "Consultant report.pdf",
        analyst: "consultant@ligtas.com",
        analystUserId: 2,
      }),
    ]);

    renderView("admin");

    expect(await screen.findByRole("link", { name: /admin report\.pdf/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /consultant report\.pdf/i })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/analyst/i), "2");

    expect(screen.queryByRole("link", { name: /admin report\.pdf/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /consultant report\.pdf/i })).toBeInTheDocument();
  });

  it("does not show the analyst filter to consultants", async () => {
    listMock.mockResolvedValueOnce([report({})]);

    renderView("consultant");

    expect(await screen.findByRole("link", { name: /fire risk assessment\.pdf/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/analyst/i)).not.toBeInTheDocument();
  });
});
