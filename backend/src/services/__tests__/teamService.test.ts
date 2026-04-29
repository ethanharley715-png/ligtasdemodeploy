import { ApiError } from "../../errors/apiError";
import { prisma } from "../../db/prisma";
import {
  addTeamMember,
  createTeam,
  deleteTeam,
  getManagedTeam,
  removeTeamMember,
  updateTeam,
} from "../teamService";

jest.mock("../../db/prisma", () => ({
  prisma: {
    team: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    userAccount: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

describe("teamService", () => {
  const prismaMock = prisma as unknown as {
    team: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    userAccount: {
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects duplicate team names", async () => {
    prismaMock.team.findFirst.mockResolvedValueOnce({ id: "team_1" } as never);

    await expect(createTeam({ name: "Operations" })).rejects.toMatchObject({
      status: 409,
      code: "invalid_request",
    });
  });

  it("rejects assigning a non-team-manager as team manager", async () => {
    prismaMock.team.findUnique.mockResolvedValueOnce({ id: "team_1" } as never);
    prismaMock.userAccount.findUnique.mockResolvedValueOnce({
      id: 9,
      user_type: "usr",
    } as never);

    await expect(updateTeam("team_1", { managerUserId: 9 })).rejects.toMatchObject({
      status: 400,
      code: "invalid_request",
    });
  });

  it("rejects assigning a team manager who already manages another team", async () => {
    prismaMock.team.findUnique.mockResolvedValueOnce({ id: "team_1" } as never);
    prismaMock.userAccount.findUnique.mockResolvedValueOnce({
      id: 9,
      user_type: "tm",
    } as never);
    prismaMock.team.findFirst.mockResolvedValueOnce({ id: "team_2" } as never);

    await expect(updateTeam("team_1", { managerUserId: 9 })).rejects.toMatchObject({
      status: 409,
      code: "invalid_request",
    });
  });

  it("rejects assigning a non-consultant as a member", async () => {
    prismaMock.team.findUnique.mockResolvedValueOnce({
      id: "team_1",
      managerUserId: 11,
    } as never);
    prismaMock.userAccount.findUnique.mockResolvedValueOnce({
      id: 12,
      user_type: "tm",
    } as never);

    await expect(addTeamMember("team_1", 12)).rejects.toMatchObject({
      status: 400,
      code: "invalid_request",
    });
  });

  it("rejects removing a user who is not on the specified team", async () => {
    prismaMock.team.findUnique.mockResolvedValueOnce({ id: "team_1" } as never);
    prismaMock.userAccount.findUnique.mockResolvedValueOnce({
      id: 15,
      teamId: "team_2",
      user_type: "usr",
    } as never);

    await expect(removeTeamMember("team_1", 15)).rejects.toMatchObject({
      status: 400,
      code: "invalid_request",
    });
  });

  it("returns null when a team manager has no managed team", async () => {
    prismaMock.team.findFirst.mockResolvedValueOnce(null as never);

    await expect(getManagedTeam(11)).resolves.toBeNull();
  });

  it("rejects deleting a team that still has a manager or members", async () => {
    prismaMock.team.findUnique.mockResolvedValueOnce({
      id: "team_1",
      managerUserId: 11,
      _count: { members: 2 },
    } as never);

    await expect(deleteTeam("team_1")).rejects.toMatchObject({
      status: 400,
      code: "invalid_request",
    });
  });

  it("deletes an empty unmanaged team", async () => {
    prismaMock.team.findUnique.mockResolvedValueOnce({
      id: "team_1",
      managerUserId: null,
      _count: { members: 0 },
    } as never);
    prismaMock.team.delete.mockResolvedValueOnce({ id: "team_1" } as never);

    await expect(deleteTeam("team_1")).resolves.toBeUndefined();
    expect(prismaMock.team.delete).toHaveBeenCalledWith({
      where: { id: "team_1" },
    });
  });

  it("throws ApiError when asked to create a blank team", async () => {
    await expect(createTeam({ name: "   " })).rejects.toBeInstanceOf(ApiError);
  });
});
