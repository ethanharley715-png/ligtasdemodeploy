import { getVisibleUsersForRequester, getReportsForUser } from "../userReportService";
import { prisma } from "../../db/prisma";

jest.mock("../../db/prisma", () => ({
  prisma: {
    userAccount: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    report: {
      findMany: jest.fn(),
    },
  },
}));

describe("User Report Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getVisibleUsersForRequester", () => {
    it("returns all users for admin", async () => {
      (prisma.userAccount.findMany as jest.Mock).mockResolvedValue([{ id: 1 }]);

      const result = await getVisibleUsersForRequester({
        role: "ADMIN",
        userId: 1,
      });

      expect(result).toEqual([{ id: 1 }]);
    });

    it("returns team users for team manager", async () => {
      (prisma.userAccount.findMany as jest.Mock).mockResolvedValue([{ id: 2 }]);

      const result = await getVisibleUsersForRequester({
        role: "TEAM_MANAGER",
        teamId: "team1",
        userId: 2,
      });

      expect(result).toEqual([{ id: 2 }]);
    });

    it("throws for normal user", async () => {
      await expect(
        getVisibleUsersForRequester({
          role: "USER",
          userId: 3,
        })
      ).rejects.toThrow("Unauthorized");
    });
  });

  describe("getReportsForUser", () => {
    it("returns reports for admin", async () => {
      (prisma.userAccount.findUnique as jest.Mock).mockResolvedValue({
        id: 5,
        teamId: "team1",
      });

      (prisma.report.findMany as jest.Mock).mockResolvedValue([
        { id: "r1" },
      ]);

      const result = await getReportsForUser(
        { role: "admin", userId: 1 },
        5
      );

      expect(result).toEqual([{ id: "r1" }]);
    });

    it("returns reports for valid team manager", async () => {
      (prisma.userAccount.findUnique as jest.Mock).mockResolvedValue({
        id: 6,
        teamId: "team1",
      });

      (prisma.report.findMany as jest.Mock).mockResolvedValue([
        { id: "r2" },
      ]);

      const result = await getReportsForUser(
        { role: "team_manager", teamId: "team1", userId: 2 },
        6
      );

      expect(result).toEqual([{ id: "r2" }]);
    });

    it("blocks team manager from other team", async () => {
      (prisma.userAccount.findUnique as jest.Mock).mockResolvedValue({
        id: 7,
        teamId: "team2",
      });

      await expect(
        getReportsForUser(
          { role: "team_manager", teamId: "team1", userId: 2 },
          7
        )
      ).rejects.toThrow("Forbidden");
    });

    it("blocks normal user", async () => {
      (prisma.userAccount.findUnique as jest.Mock).mockResolvedValue({
        id: 8,
        teamId: "team1",
      });

      await expect(
        getReportsForUser(
          { role: "user", userId: 3 },
          8
        )
      ).rejects.toThrow("Forbidden");
    });

    it("throws if user not found", async () => {
      (prisma.userAccount.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        getReportsForUser(
          { role: "admin", userId: 1 },
          999
        )
      ).rejects.toThrow("User not found");
    });

    it("returns empty array when no reports", async () => {
      (prisma.userAccount.findUnique as jest.Mock).mockResolvedValue({
        id: 10,
        teamId: "team1",
      });

      (prisma.report.findMany as jest.Mock).mockResolvedValue([]);

      const result = await getReportsForUser(
        { role: "admin", userId: 1 },
        10
      );

      expect(result).toEqual([]);
    });

    it("calls prisma with correct filters", async () => {
      (prisma.userAccount.findUnique as jest.Mock).mockResolvedValue({
        id: 11,
        teamId: "team1",
      });

      (prisma.report.findMany as jest.Mock).mockResolvedValue([]);

      await getReportsForUser(
        { role: "admin", userId: 1 },
        11
      );

      expect(prisma.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userAccountId: 11 },
        })
      );
    });
  });
});