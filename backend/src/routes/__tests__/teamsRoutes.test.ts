import express from "express";
import request from "supertest";
import teamsRouter from "../teams";
import { errorHandler } from "../../middleware/errorHandler";
import { ApiError } from "../../errors/apiError";
import {
  addTeamMember,
  createTeam,
  deleteTeam,
  getManagedTeam,
  getTeamDetail,
  listTeams,
  removeTeamMember,
  updateTeam,
} from "../../services/teamService";

jest.mock("../../middleware/auth", () => ({
  authenticateToken: jest.fn((req, res, next) => {
    const roleHeader = req.headers["x-test-role"];
    const userIdHeader = req.headers["x-test-user-id"];

    if (!roleHeader) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    req.user = {
      userId: Number(userIdHeader ?? 7),
      email: "tester@ligtas.com",
      role: String(roleHeader),
    };
    next();
  }),
  requireAdmin: jest.fn((req, res, next) => {
    if (req.user?.role !== "ADMIN") {
      res.status(403).json({ message: "Admin access required" });
      return;
    }
    next();
  }),
}));

jest.mock("../../services/teamService", () => ({
  listTeams: jest.fn(),
  createTeam: jest.fn(),
  getTeamDetail: jest.fn(),
  updateTeam: jest.fn(),
  addTeamMember: jest.fn(),
  removeTeamMember: jest.fn(),
  deleteTeam: jest.fn(),
  getManagedTeam: jest.fn(),
}));

describe("teams routes", () => {
  let app: express.Express;

  const listTeamsMock = listTeams as jest.MockedFunction<typeof listTeams>;
  const createTeamMock = createTeam as jest.MockedFunction<typeof createTeam>;
  const getTeamDetailMock = getTeamDetail as jest.MockedFunction<typeof getTeamDetail>;
  const updateTeamMock = updateTeam as jest.MockedFunction<typeof updateTeam>;
  const addTeamMemberMock = addTeamMember as jest.MockedFunction<typeof addTeamMember>;
  const removeTeamMemberMock = removeTeamMember as jest.MockedFunction<typeof removeTeamMember>;
  const deleteTeamMock = deleteTeam as jest.MockedFunction<typeof deleteTeam>;
  const getManagedTeamMock = getManagedTeam as jest.MockedFunction<typeof getManagedTeam>;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use("/api/teams", teamsRouter);
    app.use(errorHandler);
  });

  it("allows admins to list teams", async () => {
    listTeamsMock.mockResolvedValueOnce([
      { id: "team_1", name: "Operations", manager: null, memberCount: 2 },
    ]);

    const response = await request(app)
      .get("/api/teams")
      .set("x-test-role", "ADMIN");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { id: "team_1", name: "Operations", manager: null, memberCount: 2 },
    ]);
  });

  it("denies consultants from admin team endpoints", async () => {
    const response = await request(app)
      .get("/api/teams")
      .set("x-test-role", "CONSULTANT");

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "Admin access required" });
  });

  it("creates a team for admins", async () => {
    createTeamMock.mockResolvedValueOnce({
      id: "team_1",
      name: "Operations",
      manager: null,
      members: [],
    });

    const response = await request(app)
      .post("/api/teams")
      .set("x-test-role", "ADMIN")
      .send({ name: "Operations" });

    expect(response.status).toBe(201);
    expect(createTeamMock).toHaveBeenCalledWith({ name: "Operations" });
  });

  it("returns team detail for admins", async () => {
    getTeamDetailMock.mockResolvedValueOnce({
      id: "team_1",
      name: "Operations",
      manager: { id: "9", name: "Manager", email: "tm@ligtas.com" },
      members: [],
    });

    const response = await request(app)
      .get("/api/teams/team_1")
      .set("x-test-role", "ADMIN");

    expect(response.status).toBe(200);
    expect(response.body.name).toBe("Operations");
  });

  it("updates team name and manager for admins", async () => {
    updateTeamMock.mockResolvedValueOnce({
      id: "team_1",
      name: "Operations East",
      manager: { id: "9", name: "Manager", email: "tm@ligtas.com" },
      members: [],
    });

    const response = await request(app)
      .patch("/api/teams/team_1")
      .set("x-test-role", "ADMIN")
      .send({ name: "Operations East", managerUserId: 9 });

    expect(response.status).toBe(200);
    expect(updateTeamMock).toHaveBeenCalledWith("team_1", {
      name: "Operations East",
      managerUserId: 9,
    });
  });

  it("validates numeric manager ids before hitting the service", async () => {
    const response = await request(app)
      .patch("/api/teams/team_1")
      .set("x-test-role", "ADMIN")
      .send({ managerUserId: "bad" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      code: "invalid_request",
      message: "managerUserId must be a valid number.",
    });
    expect(updateTeamMock).not.toHaveBeenCalled();
  });

  it("adds a consultant to a team", async () => {
    addTeamMemberMock.mockResolvedValueOnce({
      id: "team_1",
      name: "Operations",
      manager: null,
      members: [
        {
          id: "12",
          name: "Consultant",
          email: "consultant@ligtas.com",
          role: "Consultant",
          reportsCount: 3,
          teamId: "team_1",
        },
      ],
    });

    const response = await request(app)
      .post("/api/teams/team_1/members")
      .set("x-test-role", "ADMIN")
      .send({ userId: 12 });

    expect(response.status).toBe(200);
    expect(addTeamMemberMock).toHaveBeenCalledWith("team_1", 12);
  });

  it("removes a consultant from a team", async () => {
    removeTeamMemberMock.mockResolvedValueOnce({
      id: "team_1",
      name: "Operations",
      manager: null,
      members: [],
    });

    const response = await request(app)
      .delete("/api/teams/team_1/members/12")
      .set("x-test-role", "ADMIN");

    expect(response.status).toBe(200);
    expect(removeTeamMemberMock).toHaveBeenCalledWith("team_1", 12);
  });

  it("deletes an empty unmanaged team for admins", async () => {
    deleteTeamMock.mockResolvedValueOnce();

    const response = await request(app)
      .delete("/api/teams/team_1")
      .set("x-test-role", "ADMIN");

    expect(response.status).toBe(204);
    expect(deleteTeamMock).toHaveBeenCalledWith("team_1");
  });

  it("returns the managed team for team managers", async () => {
    getManagedTeamMock.mockResolvedValueOnce({
      id: "team_1",
      name: "Operations",
      manager: { id: "11", name: "Team Manager", email: "tm@ligtas.com" },
      members: [],
    });

    const response = await request(app)
      .get("/api/teams/me")
      .set("x-test-role", "TEAM_MANAGER")
      .set("x-test-user-id", "11");

    expect(response.status).toBe(200);
    expect(getManagedTeamMock).toHaveBeenCalledWith(11);
  });

  it("denies non-team-managers from /me", async () => {
    const response = await request(app)
      .get("/api/teams/me")
      .set("x-test-role", "CONSULTANT");

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      code: "unauthorized",
      message: "Team Manager access required.",
    });
  });

  it("maps service validation errors into the standard error envelope", async () => {
    createTeamMock.mockRejectedValueOnce(
      new ApiError(409, "invalid_request", "A team with this name already exists."),
    );

    const response = await request(app)
      .post("/api/teams")
      .set("x-test-role", "ADMIN")
      .send({ name: "Operations" });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      code: "invalid_request",
      message: "A team with this name already exists.",
    });
  });
});
