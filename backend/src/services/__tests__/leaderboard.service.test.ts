import { getUserLeaderboard } from "../analyticsService";
import { prisma } from "../../db/prisma";

jest.mock("../../db/prisma", () => ({
  prisma: {
    report: {
      findMany: jest.fn(),
    },
    userAccount: {
      findMany: jest.fn(),
    },
  },
}));

describe("getUserLeaderboard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns empty array when no reports exist", async () => {
    (prisma.report.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.userAccount.findMany as jest.Mock).mockResolvedValue([]);

    const result = await getUserLeaderboard();

    expect(result).toEqual([]);
  });

  it("aggregates reports and issues per user correctly", async () => {
    (prisma.report.findMany as jest.Mock).mockResolvedValue([
      { userAccountId: 1, issues: [{}, {}] },
      { userAccountId: 1, issues: [{}] },
      { userAccountId: 2, issues: [] },
    ]);

    (prisma.userAccount.findMany as jest.Mock).mockResolvedValue([
      { id: 1, email: "user1@test.com" },
      { id: 2, email: "user2@test.com" },
    ]);

    const result = await getUserLeaderboard();

    expect(result).toHaveLength(2);

    const user1 = result.find((u) => u.userId === 1)!;
    const user2 = result.find((u) => u.userId === 2)!;

    expect(user1.totalReports).toBe(2);
    expect(user1.averageIssues).toBe(1.5);

    expect(user2.totalReports).toBe(1);
    expect(user2.averageIssues).toBe(0);
  });

  it("calculates score correctly", async () => {
    (prisma.report.findMany as jest.Mock).mockResolvedValue([
      { userAccountId: 1, issues: [{}, {}, {}, {}] },
    ]);

    (prisma.userAccount.findMany as jest.Mock).mockResolvedValue([
      { id: 1, email: "user@test.com" },
    ]);

    const result = await getUserLeaderboard();

    expect(result[0].score).toBeLessThan(100);
    expect(result[0].score).toBeGreaterThanOrEqual(0);
  });

  it("sorts users by score descending", async () => {
    (prisma.report.findMany as jest.Mock).mockResolvedValue([
      { userAccountId: 1, issues: [{}] },
      { userAccountId: 2, issues: [{}, {}, {}] },
    ]);

    (prisma.userAccount.findMany as jest.Mock).mockResolvedValue([
      { id: 1, email: "best@test.com" },
      { id: 2, email: "worst@test.com" },
    ]);

    const result = await getUserLeaderboard();

    expect(result[0].userId).toBe(1);
    expect(result[1].userId).toBe(2);
  });

  it("handles users with no issues correctly", async () => {
    (prisma.report.findMany as jest.Mock).mockResolvedValue([
      { userAccountId: 1, issues: [] },
    ]);

    (prisma.userAccount.findMany as jest.Mock).mockResolvedValue([
      { id: 1, email: "clean@test.com" },
    ]);

    const result = await getUserLeaderboard();

    expect(result[0].averageIssues).toBe(0);
    expect(result[0].score).toBe(100);
  });

  it("ignores reports without userAccountId", async () => {
    (prisma.report.findMany as jest.Mock).mockResolvedValue([
  { userAccountId: 1, issues: [{}] },
    ]);

    (prisma.userAccount.findMany as jest.Mock).mockResolvedValue([
      { id: 1, email: "valid@test.com" },
    ]);

    const result = await getUserLeaderboard();

    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe(1);
  });

  it("falls back to default name if user not found", async () => {
    (prisma.report.findMany as jest.Mock).mockResolvedValue([
      { userAccountId: 99, issues: [{}] },
    ]);

    (prisma.userAccount.findMany as jest.Mock).mockResolvedValue([]);

    const result = await getUserLeaderboard();

    expect(result[0].name).toContain("User");
  });

  it("handles multiple users with mixed data", async () => {
    (prisma.report.findMany as jest.Mock).mockResolvedValue([
      { userAccountId: 1, issues: [{}] },
      { userAccountId: 1, issues: [{}] },
      { userAccountId: 2, issues: [{}, {}] },
      { userAccountId: 3, issues: [] },
    ]);

    (prisma.userAccount.findMany as jest.Mock).mockResolvedValue([
      { id: 1, email: "a@test.com" },
      { id: 2, email: "b@test.com" },
      { id: 3, email: "c@test.com" },
    ]);

    const result = await getUserLeaderboard();

    expect(result).toHaveLength(3);

    const scores = result.map((u) => u.score);
    expect(scores[0]).toBeGreaterThanOrEqual(scores[1]);
    expect(scores[1]).toBeGreaterThanOrEqual(scores[2]);
  });
});