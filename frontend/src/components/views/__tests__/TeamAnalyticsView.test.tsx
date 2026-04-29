import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TeamAnalyticsView } from "../TeamAnalyticsView";

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
  kpisMock,
  issueTypesMock,
  trendsMock,
  teamPerformanceMock,
  consultantPerformanceMock,
  teamsListMock,
  teamsGetMock,
  teamsMeMock,
} = vi.hoisted(() => ({
  kpisMock: vi.fn(),
  issueTypesMock: vi.fn(),
  trendsMock: vi.fn(),
  teamPerformanceMock: vi.fn(),
  consultantPerformanceMock: vi.fn(),
  teamsListMock: vi.fn(),
  teamsGetMock: vi.fn(),
  teamsMeMock: vi.fn(),
}));

vi.mock("../../../services/api", async () => {
  const actual = await vi.importActual<typeof import("../../../services/api")>("../../../services/api");

  return {
    ...actual,
    teamAnalyticsApi: {
      kpis: kpisMock,
      issueTypes: issueTypesMock,
      trends: trendsMock,
      teamPerformance: teamPerformanceMock,
      consultantPerformance: consultantPerformanceMock,
    },
    teamsApi: {
      ...actual.teamsApi,
      list: teamsListMock,
      get: teamsGetMock,
      me: teamsMeMock,
    },
  };
});

function renderTeamAnalyticsView(userRole: "admin" | "team_manager" = "admin") {
  return render(
    <MemoryRouter>
      <TeamAnalyticsView userRole={userRole} />
    </MemoryRouter>,
  );
}

describe("TeamAnalyticsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    kpisMock.mockResolvedValue({
      totalReportsAnalysed: 12,
      totalIssuesFound: 28,
      averageIssuesPerReport: 2.33,
      passRate: 41.67,
      failedQcRate: 58.33,
      criticalIssuesCount: 6,
    });
    issueTypesMock.mockResolvedValue([
      { issueType: "TEMPLATE_ARTIFACT", label: "Template Artifact", count: 10 },
      { issueType: "MISSING_INFORMATION", label: "Missing Information", count: 6 },
    ]);
    trendsMock.mockResolvedValue([
      { label: "01 Mar", reports: 2, issues: 5 },
      { label: "02 Mar", reports: 3, issues: 4 },
    ]);
    teamPerformanceMock.mockResolvedValue([
      {
        teamId: "team_ops",
        teamName: "Operations Team",
        reportsAnalysed: 7,
        averageIssuesPerReport: 2.14,
        reportsWithIssuesPercentage: 71.43,
        mostFrequentIssueCategory: "Template Artifact",
      },
    ]);
    consultantPerformanceMock.mockResolvedValue([
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
    teamsListMock.mockResolvedValue([
      { id: "team_ops", name: "Operations Team", manager: null, memberCount: 3 },
      { id: "team_comp", name: "Compliance Team", manager: null, memberCount: 2 },
    ]);
    teamsGetMock.mockResolvedValue({
      id: "team_ops",
      name: "Operations Team",
      manager: { id: "11", name: "Team Manager", email: "teammanager@ligtas.com" },
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
    teamsMeMock.mockResolvedValue({
      id: "team_ops",
      name: "Operations Team",
      manager: { id: "11", name: "Team Manager", email: "teammanager@ligtas.com" },
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders organisation-wide team analytics for admins", async () => {
    renderTeamAnalyticsView("admin");

    expect(await screen.findByText("Team Analytics")).toBeInTheDocument();
    expect(screen.getByText("Total reports analysed")).toBeInTheDocument();
    expect(screen.getByText("Team performance")).toBeInTheDocument();
    expect(screen.getAllByText("Operations Team").length).toBeGreaterThan(0);
    expect(teamPerformanceMock).toHaveBeenCalledWith(
      expect.objectContaining({ dateFrom: expect.any(String), dateTo: expect.any(String) }),
    );
  });

  it("switches to consultant performance when an admin selects a team", async () => {
    const user = userEvent.setup();
    renderTeamAnalyticsView("admin");

    await screen.findByText("Team Analytics");
    await user.selectOptions(screen.getByLabelText(/^Team$/i), "team_ops");

    await waitFor(() => {
      expect(consultantPerformanceMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ teamId: "team_ops" }),
      );
    });

    expect(await screen.findByText("Consultant performance")).toBeInTheDocument();
    expect(screen.getByText("Grace Morgan")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/^Consultant$/i), "21");
    await waitFor(() => {
      expect(kpisMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ teamId: "team_ops", consultantId: "21" }),
      );
    });
  });

  it("renders a clean empty state for team managers without a managed team", async () => {
    teamsMeMock.mockResolvedValueOnce(null);

    renderTeamAnalyticsView("team_manager");

    expect(await screen.findByText(/not assigned to manage a team yet/i)).toBeInTheDocument();
    expect(kpisMock).not.toHaveBeenCalled();
  });

  it("loads the managed team scope for team managers", async () => {
    renderTeamAnalyticsView("team_manager");

    expect(await screen.findByText("My Team Analytics")).toBeInTheDocument();
    await waitFor(() => {
      expect(kpisMock).toHaveBeenCalledWith(
        expect.objectContaining({ teamId: "team_ops" }),
      );
    });
    expect(screen.getByText("Consultant performance")).toBeInTheDocument();
    expect(screen.getByText("Grace Morgan")).toBeInTheDocument();
  });
});
