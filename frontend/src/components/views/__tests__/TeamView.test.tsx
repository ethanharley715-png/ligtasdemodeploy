import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TeamView } from "../TeamView";
import { teamsApi } from "../../../services/api";

vi.mock("../../../services/api", () => ({
  teamsApi: {
    me: vi.fn(),
  },
}));

describe("TeamView", () => {
  const teamMeMock = vi.mocked(teamsApi.me);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the managed team and its members", async () => {
    teamMeMock.mockResolvedValueOnce({
      id: "team_1",
      name: "Operations",
      manager: { id: "11", name: "Team Manager", email: "tm@ligtas.com" },
      members: [
        {
          id: "21",
          name: "Consultant A",
          email: "consultant-a@ligtas.com",
          role: "Consultant",
          reportsCount: 3,
          teamId: "team_1",
        },
      ],
    });

    render(<TeamView />);

    expect(await screen.findByText("Operations")).toBeInTheDocument();
    expect(screen.getByText("Consultant A")).toBeInTheDocument();
  });

  it("shows an empty state when the team manager is not assigned to a team", async () => {
    teamMeMock.mockResolvedValueOnce(null);

    render(<TeamView />);

    expect(await screen.findByText(/not assigned to manage a team yet/i)).toBeInTheDocument();
  });
});
