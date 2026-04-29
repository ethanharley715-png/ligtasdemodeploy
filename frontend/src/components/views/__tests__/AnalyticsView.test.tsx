import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnalyticsView } from "../AnalyticsView";
import { getLastCompletedWeekValue } from "../../../utils/weeklyDigestWeek";

vi.mock("recharts", () => {
  const Mock = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Mock,
    LineChart: Mock,
    Line: Mock,
    BarChart: Mock,
    Bar: Mock,
    CartesianGrid: Mock,
    XAxis: Mock,
    YAxis: Mock,
    Tooltip: Mock,
  };
});

const {
  toastSuccessMock,
  toastErrorMock,
  kpisMock,
  trendsMock,
  issueTypesMock,
  sectionDensityMock,
  recurringIssueRateMock,
  consultantSignalsMock,
  exportWeeklyDigestMock,
  usersListMock,
} = vi.hoisted(() => ({
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
  kpisMock: vi.fn(),
  trendsMock: vi.fn(),
  issueTypesMock: vi.fn(),
  sectionDensityMock: vi.fn(),
  recurringIssueRateMock: vi.fn(),
  consultantSignalsMock: vi.fn(),
  exportWeeklyDigestMock: vi.fn(),
  usersListMock: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

vi.mock("../../../services/api", async () => {
  const actual = await vi.importActual<typeof import("../../../services/api")>(
    "../../../services/api",
  );

  return {
    ...actual,
    analyticsApi: {
      kpis: kpisMock,
      trends: trendsMock,
      issueTypes: issueTypesMock,
      sectionDensity: sectionDensityMock,
      recurringIssueRate: recurringIssueRateMock,
      consultantSignals: consultantSignalsMock,
      exportWeeklyDigest: exportWeeklyDigestMock,
    },
    usersApi: {
      ...actual.usersApi,
      list: usersListMock,
    },
  };
});

function renderAnalyticsView() {
  return render(
    <MemoryRouter>
      <AnalyticsView />
    </MemoryRouter>,
  );
}

describe("AnalyticsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    usersListMock.mockResolvedValue([
      {
        id: "1",
        email: "consultant@ligtas.com",
        role: "Consultant",
        name: "Consultant",
        status: "Active",
        lastActive: "-",
        reportsCount: 2,
      },
    ]);
    kpisMock.mockResolvedValue({
      totalAnalyses: 12,
      analysesWithIssuesPercentage: 58.33,
      averageIssuesPerAnalysis: 1.75,
      distinctIssueCategories: 3,
      reportsThisMonth: 12,
      reportsLastMonth: 10,
      avgIssuesPerReport: 1.75,
      avgIssuesLastMonth: 2.1,
      passRate: 41.67,
      passRateLastMonth: 38,
      timeSaved: 180,
    });
    trendsMock.mockResolvedValue([
      { label: "01 Mar", analyses: 2, issues: 4 },
      { label: "02 Mar", analyses: 3, issues: 2 },
    ]);
    issueTypesMock.mockResolvedValue([
      { issueType: "TEMPLATE_ARTIFACT", label: "Template Artifact", count: 4 },
      { issueType: "UNREMOVED_GUIDANCE", label: "Unremoved Guidance", count: 2 },
    ]);
    sectionDensityMock.mockResolvedValue([{ section: "Summary", issueCount: 3, issueDensity: 0.25 }]);
    recurringIssueRateMock.mockResolvedValue([
      { label: "01 Mar", analyses: 2, reportsWithRepeatedCategories: 1, recurringIssueRate: 50 },
    ]);
    consultantSignalsMock.mockResolvedValue([
      {
        consultantId: 1,
        consultantEmail: "consultant@ligtas.com",
        analysesRun: 6,
        withIssuesPercentage: 50,
        averageIssuesPerReport: 2.5,
        mostFrequentCategory: "Template Artifact",
      },
    ]);
    exportWeeklyDigestMock.mockResolvedValue({
      blob: new Blob(["section,key,value\nsummary,total_analyses,12\n"], { type: "text/csv" }),
      fileName: "qc-weekly-digest__2026-03-16__to__2026-03-22__generated-2026-03-23T09-00-00Z.csv",
      contentType: "text/csv; charset=utf-8",
    });

    vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:weekly-digest");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the real-data KPI cards and chart headings", async () => {
    renderAnalyticsView();

    expect(await screen.findByText("QC Trend Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Total QC analyses run")).toBeInTheDocument();
    expect(screen.getByText("Analyses with issues")).toBeInTheDocument();
    expect(screen.getByText("Average issues per analysis")).toBeInTheDocument();
    expect(screen.getByText("Distinct issue categories")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("58.3%")).toBeInTheDocument();
    expect(screen.getByText("1.75")).toBeInTheDocument();
    expect(screen.getByText("QC analyses over time")).toBeInTheDocument();
    expect(screen.getByText("Issue density by report section")).toBeInTheDocument();
    expect(screen.getByText("Recurring Issue Rate")).toBeInTheDocument();
    expect(screen.getByText("Consultant Quality Signals (Based on QC Runs)")).toBeInTheDocument();
    expect(screen.getAllByText("consultant@ligtas.com").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Template Artifact").length).toBeGreaterThan(0);
  });

  it("refreshes analytics when filters change", async () => {
    const user = userEvent.setup();
    renderAnalyticsView();

    await screen.findByText("QC Trend Dashboard");
    expect(kpisMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dateFrom: expect.any(String),
        dateTo: expect.any(String),
      }),
    );

    await user.selectOptions(screen.getByLabelText(/Consultant/i), "1");
    await waitFor(() => {
      expect(kpisMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          consultantId: "1",
        }),
      );
    });

    await user.selectOptions(screen.getByLabelText(/Issue category/i), "TEMPLATE_ARTIFACT");
    await waitFor(() => {
      expect(sectionDensityMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          consultantId: "1",
          issueType: "TEMPLATE_ARTIFACT",
        }),
      );
      expect(recurringIssueRateMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          consultantId: "1",
          issueType: "TEMPLATE_ARTIFACT",
        }),
      );
    });
  });

  it("shows a zero-state message when no analyses match the filters", async () => {
    kpisMock.mockResolvedValueOnce({
      totalAnalyses: 0,
      analysesWithIssuesPercentage: 0,
      averageIssuesPerAnalysis: 0,
      distinctIssueCategories: 0,
      reportsThisMonth: 0,
      reportsLastMonth: 0,
      avgIssuesPerReport: 0,
      avgIssuesLastMonth: 0,
      passRate: 0,
      passRateLastMonth: 0,
      timeSaved: 0,
    });
    trendsMock.mockResolvedValueOnce([]);
    issueTypesMock.mockResolvedValueOnce([]);
    sectionDensityMock.mockResolvedValueOnce([]);
    recurringIssueRateMock.mockResolvedValueOnce([]);
    consultantSignalsMock.mockResolvedValueOnce([]);

    renderAnalyticsView();

    expect(
      await screen.findByText(/The dashboard is showing real zero-state data rather than placeholders/i),
    ).toBeInTheDocument();
  });

  it("opens the weekly digest dialog with the last completed week selected", async () => {
    const user = userEvent.setup();
    renderAnalyticsView();

    await screen.findByText("QC Trend Dashboard");
    await user.click(screen.getByRole("button", { name: /Weekly digest/i }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByDisplayValue(getLastCompletedWeekValue())).toBeInTheDocument();
  });

  it("exports the weekly digest using the selected week and current filters", async () => {
    const user = userEvent.setup();
    renderAnalyticsView();

    await screen.findByText("QC Trend Dashboard");
    await user.selectOptions(screen.getByLabelText(/Consultant/i), "1");
    await user.selectOptions(screen.getByLabelText(/Issue category/i), "TEMPLATE_ARTIFACT");
    await user.click(screen.getByRole("button", { name: /Weekly digest/i }));

    fireEvent.change(screen.getByLabelText(/Calendar week/i), {
      target: { value: "2026-W12" },
    });
    await user.click(screen.getByRole("button", { name: /Download CSV/i }));

    await waitFor(() => {
      expect(exportWeeklyDigestMock).toHaveBeenCalledWith({
        format: "csv",
        weekStart: "2026-03-16",
        consultantId: "1",
        issueType: "TEMPLATE_ARTIFACT",
      });
    });

    expect(toastSuccessMock).toHaveBeenCalledWith("CSV digest ready", {
      description:
        "qc-weekly-digest__2026-03-16__to__2026-03-22__generated-2026-03-23T09-00-00Z.csv has been generated.",
    });
  });

  it("opens an Outlook Web draft from the weekly digest dialog", async () => {
    const appendSpy = vi.spyOn(document.body, "appendChild");
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const user = userEvent.setup();

    renderAnalyticsView();

    await screen.findByText("QC Trend Dashboard");
    await user.click(screen.getByRole("button", { name: /Weekly digest/i }));
    await user.click(screen.getByRole("button", { name: /Open Outlook Web/i }));

    expect(clickSpy).toHaveBeenCalled();
    const anchor = appendSpy.mock.calls.at(-1)?.[0] as HTMLAnchorElement;
    const url = new URL(anchor.href);
    expect(url.origin).toBe("https://outlook.office.com");
    expect(url.pathname).toBe("/mail/deeplink/compose");
    expect(url.searchParams.get("body")).toContain("Please review the weekly QC digest");
  });
});
