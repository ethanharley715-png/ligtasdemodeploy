import type { ComponentProps } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "../../../context/LanguageContext";
import { DashboardView } from "../DashboardView";

const { teamsMeMock, teamsMeRecentMock, teamKpisMock, consultantPerfMock, reportsListMock, analyticsKpisMock } =
  vi.hoisted(() => ({
    teamsMeMock: vi.fn(),
    teamsMeRecentMock: vi.fn(),
    teamKpisMock: vi.fn(),
    consultantPerfMock: vi.fn(),
    reportsListMock: vi.fn(),
    analyticsKpisMock: vi.fn(),
  }));

vi.mock("../../../services/api", async () => {
  const actual = await vi.importActual<typeof import("../../../services/api")>("../../../services/api");

  return {
    ...actual,
    teamsApi: {
      ...actual.teamsApi,
      me: teamsMeMock,
      meRecentReports: teamsMeRecentMock,
    },
    teamAnalyticsApi: {
      ...actual.teamAnalyticsApi,
      kpis: teamKpisMock,
      consultantPerformance: consultantPerfMock,
    },
    reportsApi: {
      ...actual.reportsApi,
      list: reportsListMock,
    },
    analyticsApi: {
      ...actual.analyticsApi,
      kpis: analyticsKpisMock,
    },
  };
});

function renderDashboard(props: Partial<ComponentProps<typeof DashboardView>> = {}) {
  return render(
    <LanguageProvider>
      <MemoryRouter>
        <DashboardView userRole="team_manager" userName="Pat Manager" onNavigate={vi.fn()} {...props} />
      </MemoryRouter>
    </LanguageProvider>,
  );
}

describe("DashboardView (team manager)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    teamsMeMock.mockResolvedValue({
      id: "team_ops",
      name: "Operations Team",
      manager: { id: "11", name: "Pat Manager", email: "pat@ligtas.com" },
      members: [
        {
          id: "21",
          name: "Grace Morgan",
          email: "grace.morgan@ligtas.com",
          role: "Consultant",
          reportsCount: 4,
          teamId: "team_ops",
        },
      ],
    });

    teamKpisMock.mockResolvedValue({
      totalReportsAnalysed: 8,
      totalIssuesFound: 20,
      averageIssuesPerReport: 2.5,
      passRate: 62.5,
      failedQcRate: 37.5,
      criticalIssuesCount: 2,
    });

    teamsMeRecentMock.mockResolvedValue([
      {
        id: "r1",
        fileName: "fra-site-a.pdf",
        uploadDate: new Date().toISOString(),
        analyst: "grace.morgan@ligtas.com",
        status: "passed" as const,
        issuesFound: 0,
        openIssues: 0,
        completedIssues: 0,
        falsePositiveIssues: 0,
        reviewStatus: "completed" as const,
      },
    ]);

    consultantPerfMock.mockResolvedValue([
      {
        consultantId: 21,
        consultantName: "Grace Morgan",
        consultantEmail: "grace.morgan@ligtas.com",
        reportsAnalysed: 4,
        averageIssuesPerReport: 1.5,
        reportsWithIssuesPercentage: 40,
        passRate: 75,
        mostFrequentIssueCategory: null,
      },
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows team-scoped KPIs, recent team reports, consultants panel, and quick actions without admin-only links", async () => {
    renderDashboard();

    expect(await screen.findByText("Welcome back, Pat Manager")).toBeInTheDocument();
    expect(screen.getByText("Team Manager")).toBeInTheDocument();
    expect(screen.getByText("Operations Team")).toBeInTheDocument();
    expect(screen.getByText("Total team reports")).toBeInTheDocument();
    expect(screen.getByText("62.5%")).toBeInTheDocument();
    expect(screen.getByText("120h")).toBeInTheDocument();
    expect(screen.getByText("Grace Morgan")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /upload report/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /my team analytics/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /report history/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /user management/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /qc trend dashboard/i })).not.toBeInTheDocument();

    await waitFor(() => {
      expect(teamKpisMock).toHaveBeenCalled();
    });
    expect(analyticsKpisMock).not.toHaveBeenCalled();
    expect(reportsListMock).not.toHaveBeenCalled();
  });

  it("does not call team analytics when the manager has no assigned team", async () => {
    teamsMeMock.mockResolvedValueOnce(null);

    renderDashboard();

    expect(await screen.findByText(/not assigned to manage a team yet/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(teamsMeMock).toHaveBeenCalled();
    });
    expect(teamKpisMock).not.toHaveBeenCalled();
    expect(teamsMeRecentMock).not.toHaveBeenCalled();
    expect(consultantPerfMock).not.toHaveBeenCalled();
  });
});
