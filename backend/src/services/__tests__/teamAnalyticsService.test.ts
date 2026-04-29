import { IssueType } from "@prisma/client";
import {
  getConsultantPerformance,
  getTeamAnalyticsIssueTypes,
  getTeamAnalyticsKpis,
  getTeamAnalyticsTrends,
  getTeamPerformance,
  parseTeamAnalyticsFilters,
} from "../teamAnalyticsService";

jest.mock("../../db/prisma", () => ({
  prisma: {
    team: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    userAccount: {
      findUnique: jest.fn(),
    },
    report: {
      findMany: jest.fn(),
    },
  },
}));

const { prisma } = jest.requireMock("../../db/prisma") as {
  prisma: {
    team: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
    };
    userAccount: {
      findUnique: jest.Mock;
    };
    report: {
      findMany: jest.Mock;
    };
  };
};

describe("teamAnalyticsService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.team.findUnique.mockResolvedValue({ id: "team_ops" });
  });

  it("parses team analytics filters from explicit query params", () => {
    const filters = parseTeamAnalyticsFilters({
      dateFrom: "2026-03-01",
      dateTo: "2026-03-31",
      teamId: "team_ops",
      consultantId: "21",
      issueType: "TEMPLATE_ARTIFACT",
    });

    expect(filters.teamId).toBe("team_ops");
    expect(filters.consultantId).toBe(21);
    expect(filters.issueType).toBe("TEMPLATE_ARTIFACT");
  });

  it("computes KPI cards from persisted reports and issues", async () => {
    prisma.report.findMany.mockResolvedValueOnce([
      {
        id: "rep_1",
        totalIssues: 4,
        criticalIssues: 2,
        passedQC: false,
        analyzedAt: new Date("2026-03-01T09:00:00.000Z"),
        userAccountId: 21,
        issues: [
          { type: IssueType.TEMPLATE_ARTIFACT },
          { type: IssueType.MISSING_INFORMATION },
          { type: IssueType.MISSING_INFORMATION },
          { type: IssueType.CONTRADICTION },
        ],
        userAccount: {
          id: 21,
          name: "Grace Morgan",
          email: "grace.morgan@ligtas.com",
          teamId: "team_ops",
          team: { id: "team_ops", name: "Operations Team" },
        },
      },
      {
        id: "rep_2",
        totalIssues: 0,
        criticalIssues: 0,
        passedQC: true,
        analyzedAt: new Date("2026-03-03T09:00:00.000Z"),
        userAccountId: 22,
        issues: [],
        userAccount: {
          id: 22,
          name: "Ava Patel",
          email: "ava.patel@ligtas.com",
          teamId: "team_ops",
          team: { id: "team_ops", name: "Operations Team" },
        },
      },
    ]);

    const result = await getTeamAnalyticsKpis(
      { userId: 1, role: "ADMIN" },
      {
        dateFrom: new Date("2026-03-01T00:00:00.000Z"),
        dateTo: new Date("2026-03-31T23:59:59.999Z"),
        teamId: "team_ops",
      },
    );

    expect(result).toEqual({
      totalReportsAnalysed: 2,
      totalIssuesFound: 4,
      averageIssuesPerReport: 2,
      passRate: 50,
      failedQcRate: 50,
      criticalIssuesCount: 2,
    });
  });

  it("builds labelled issue breakdown and daily trends", async () => {
    prisma.report.findMany
      .mockResolvedValueOnce([
        {
          id: "rep_1",
          totalIssues: 2,
          criticalIssues: 1,
          passedQC: false,
          analyzedAt: new Date("2026-03-01T09:00:00.000Z"),
          userAccountId: 21,
          issues: [
            { type: IssueType.TEMPLATE_ARTIFACT },
            { type: IssueType.TEMPLATE_ARTIFACT },
          ],
          userAccount: {
            id: 21,
            name: "Grace Morgan",
            email: "grace.morgan@ligtas.com",
            teamId: "team_ops",
            team: { id: "team_ops", name: "Operations Team" },
          },
        },
        {
          id: "rep_2",
          totalIssues: 1,
          criticalIssues: 0,
          passedQC: false,
          analyzedAt: new Date("2026-03-02T09:00:00.000Z"),
          userAccountId: 22,
          issues: [{ type: IssueType.MISSING_INFORMATION }],
          userAccount: {
            id: 22,
            name: "Ava Patel",
            email: "ava.patel@ligtas.com",
            teamId: "team_ops",
            team: { id: "team_ops", name: "Operations Team" },
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "rep_1",
          totalIssues: 2,
          criticalIssues: 1,
          passedQC: false,
          analyzedAt: new Date("2026-03-01T09:00:00.000Z"),
          userAccountId: 21,
          issues: [
            { type: IssueType.TEMPLATE_ARTIFACT },
            { type: IssueType.TEMPLATE_ARTIFACT },
          ],
          userAccount: {
            id: 21,
            name: "Grace Morgan",
            email: "grace.morgan@ligtas.com",
            teamId: "team_ops",
            team: { id: "team_ops", name: "Operations Team" },
          },
        },
        {
          id: "rep_2",
          totalIssues: 1,
          criticalIssues: 0,
          passedQC: false,
          analyzedAt: new Date("2026-03-02T09:00:00.000Z"),
          userAccountId: 22,
          issues: [{ type: IssueType.MISSING_INFORMATION }],
          userAccount: {
            id: 22,
            name: "Ava Patel",
            email: "ava.patel@ligtas.com",
            teamId: "team_ops",
            team: { id: "team_ops", name: "Operations Team" },
          },
        },
      ]);
    prisma.team.findUnique.mockResolvedValueOnce({ id: "team_ops" });
    prisma.team.findUnique.mockResolvedValueOnce({ id: "team_ops" });

    const issueTypes = await getTeamAnalyticsIssueTypes(
      { userId: 1, role: "ADMIN" },
      {
        dateFrom: new Date("2026-03-01T00:00:00.000Z"),
        dateTo: new Date("2026-03-03T23:59:59.999Z"),
        teamId: "team_ops",
      },
    );
    const trends = await getTeamAnalyticsTrends(
      { userId: 1, role: "ADMIN" },
      {
        dateFrom: new Date("2026-03-01T00:00:00.000Z"),
        dateTo: new Date("2026-03-03T23:59:59.999Z"),
        teamId: "team_ops",
      },
    );

    expect(issueTypes).toEqual([
      { issueType: "TEMPLATE_ARTIFACT", label: "Template Artifact", count: 2 },
      { issueType: "MISSING_INFORMATION", label: "Missing Information", count: 1 },
    ]);
    expect(trends.filter((point) => point.reports > 0)).toEqual([
      { label: "01 Mar", reports: 1, issues: 2 },
      { label: "02 Mar", reports: 1, issues: 1 },
    ]);
  });

  it("builds team and consultant performance tables", async () => {
    prisma.team.findMany.mockResolvedValueOnce([
      { id: "team_ops", name: "Operations Team" },
      { id: "team_comp", name: "Compliance Team" },
    ]);
    prisma.report.findMany
      .mockResolvedValueOnce([
        {
          id: "rep_1",
          totalIssues: 3,
          criticalIssues: 1,
          passedQC: false,
          analyzedAt: new Date("2026-03-01T09:00:00.000Z"),
          userAccountId: 21,
          issues: [
            { type: IssueType.TEMPLATE_ARTIFACT },
            { type: IssueType.TEMPLATE_ARTIFACT },
            { type: IssueType.MISSING_INFORMATION },
          ],
          userAccount: {
            id: 21,
            name: "Grace Morgan",
            email: "grace.morgan@ligtas.com",
            teamId: "team_ops",
            team: { id: "team_ops", name: "Operations Team" },
          },
        },
        {
          id: "rep_2",
          totalIssues: 1,
          criticalIssues: 0,
          passedQC: true,
          analyzedAt: new Date("2026-03-02T09:00:00.000Z"),
          userAccountId: 31,
          issues: [{ type: IssueType.CONTRADICTION }],
          userAccount: {
            id: 31,
            name: "Noah Price",
            email: "noah.price@ligtas.com",
            teamId: "team_comp",
            team: { id: "team_comp", name: "Compliance Team" },
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "rep_3",
          totalIssues: 2,
          criticalIssues: 0,
          passedQC: false,
          analyzedAt: new Date("2026-03-04T09:00:00.000Z"),
          userAccountId: 21,
          issues: [
            { type: IssueType.MISSING_INFORMATION },
            { type: IssueType.MISSING_INFORMATION },
          ],
          userAccount: {
            id: 21,
            name: "Grace Morgan",
            email: "grace.morgan@ligtas.com",
            teamId: "team_ops",
            team: { id: "team_ops", name: "Operations Team" },
          },
        },
      ]);
    prisma.team.findUnique.mockResolvedValueOnce({ id: "team_ops" });

    const teamRows = await getTeamPerformance(
      { userId: 1, role: "ADMIN" },
      {
        dateFrom: new Date("2026-03-01T00:00:00.000Z"),
        dateTo: new Date("2026-03-31T23:59:59.999Z"),
      },
    );
    const consultantRows = await getConsultantPerformance(
      { userId: 1, role: "ADMIN" },
      {
        dateFrom: new Date("2026-03-01T00:00:00.000Z"),
        dateTo: new Date("2026-03-31T23:59:59.999Z"),
        teamId: "team_ops",
      },
    );

    expect(teamRows).toEqual([
      {
        teamId: "team_comp",
        teamName: "Compliance Team",
        reportsAnalysed: 1,
        averageIssuesPerReport: 1,
        reportsWithIssuesPercentage: 100,
        mostFrequentIssueCategory: "Contradiction",
      },
      {
        teamId: "team_ops",
        teamName: "Operations Team",
        reportsAnalysed: 1,
        averageIssuesPerReport: 3,
        reportsWithIssuesPercentage: 100,
        mostFrequentIssueCategory: "Template Artifact",
      },
    ]);
    expect(consultantRows).toEqual([
      {
        consultantId: 21,
        consultantName: "Grace Morgan",
        consultantEmail: "grace.morgan@ligtas.com",
        reportsAnalysed: 1,
        averageIssuesPerReport: 2,
        reportsWithIssuesPercentage: 100,
        passRate: 0,
        mostFrequentIssueCategory: "Missing Information",
      },
    ]);
  });

  it("rejects consultant filters without a team scope for admins", async () => {
    await expect(
      getTeamAnalyticsKpis(
        { userId: 1, role: "ADMIN" },
        {
          dateFrom: new Date("2026-03-01T00:00:00.000Z"),
          dateTo: new Date("2026-03-31T23:59:59.999Z"),
          consultantId: 21,
        },
      ),
    ).rejects.toMatchObject({
      status: 400,
      code: "invalid_request",
    });
  });

  it("locks team managers to their own team", async () => {
    prisma.team.findFirst.mockResolvedValueOnce({ id: "team_ops" });

    await expect(
      getTeamAnalyticsKpis(
        { userId: 55, role: "TEAM_MANAGER" },
        {
          dateFrom: new Date("2026-03-01T00:00:00.000Z"),
          dateTo: new Date("2026-03-31T23:59:59.999Z"),
          teamId: "team_comp",
        },
      ),
    ).rejects.toMatchObject({
      status: 403,
      code: "unauthorized",
    });
  });
});
