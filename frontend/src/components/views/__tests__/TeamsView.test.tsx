import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TeamsView } from "../TeamsView";
import { teamsApi, usersApi } from "../../../services/api";

const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock("../../../services/api", () => ({
  teamsApi: {
    list: vi.fn(),
    create: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
    addMember: vi.fn(),
    removeMember: vi.fn(),
    delete: vi.fn(),
  },
  usersApi: {
    list: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

function renderWithRouter(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("TeamsView", () => {
  const listTeamsMock = vi.mocked(teamsApi.list);
  const createTeamMock = vi.mocked(teamsApi.create);
  const getTeamMock = vi.mocked(teamsApi.get);
  const updateTeamMock = vi.mocked(teamsApi.update);
  const addMemberMock = vi.mocked(teamsApi.addMember);
  const deleteTeamMock = vi.mocked(teamsApi.delete);
  const listUsersMock = vi.mocked(usersApi.list);

  const teams = [
    {
      id: "team_1",
      name: "Operations",
      manager: { id: "11", name: "Team Manager", email: "tm@ligtas.com" },
      memberCount: 1,
    },
  ];

  const users = [
    {
      id: "11",
      name: "Team Manager",
      email: "tm@ligtas.com",
      role: "Team Manager",
      status: "Active",
      lastActive: "—",
      reportsCount: 0,
      teamId: null,
      teamName: null,
    },
    {
      id: "21",
      name: "Consultant A",
      email: "consultant-a@ligtas.com",
      role: "Consultant",
      status: "Active",
      lastActive: "—",
      reportsCount: 2,
      teamId: "team_1",
      teamName: "Operations",
    },
    {
      id: "22",
      name: "Consultant B",
      email: "consultant-b@ligtas.com",
      role: "Consultant",
      status: "Active",
      lastActive: "—",
      reportsCount: 1,
      teamId: null,
      teamName: null,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    listTeamsMock.mockResolvedValue(teams);
    listUsersMock.mockResolvedValue(users);
    getTeamMock.mockResolvedValue({
      id: "team_1",
      name: "Operations",
      manager: { id: "11", name: "Team Manager", email: "tm@ligtas.com" },
      members: [
        {
          id: "21",
          name: "Consultant A",
          email: "consultant-a@ligtas.com",
          role: "Consultant",
          reportsCount: 2,
          teamId: "team_1",
        },
      ],
    });
  });

  it("renders teams and selected team detail", async () => {
    renderWithRouter(<TeamsView />);

    expect(await screen.findByText("Operations")).toBeInTheDocument();
    expect(await screen.findByDisplayValue("Operations")).toBeInTheDocument();
    expect(screen.getByText("Consultant A")).toBeInTheDocument();
  });

  it("creates a team from the modal", async () => {
    createTeamMock.mockResolvedValueOnce({
      id: "team_2",
      name: "North Team",
      manager: null,
      members: [],
    });
    listTeamsMock
      .mockResolvedValueOnce(teams)
      .mockResolvedValueOnce([...teams, { id: "team_2", name: "North Team", manager: null, memberCount: 0 }]);
    listUsersMock.mockResolvedValue(users);
    getTeamMock
      .mockResolvedValueOnce({
        id: "team_1",
        name: "Operations",
        manager: { id: "11", name: "Team Manager", email: "tm@ligtas.com" },
        members: [],
      })
      .mockResolvedValueOnce({
        id: "team_2",
        name: "North Team",
        manager: null,
        members: [],
      });

    renderWithRouter(<TeamsView />);

    await screen.findByText("Operations");
    await userEvent.click(screen.getByRole("button", { name: /Create Team/i }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText(/Team name/i), "North Team");
    await userEvent.click(within(dialog).getByRole("button", { name: /^Create Team$/i }));

    await waitFor(() => {
      expect(createTeamMock).toHaveBeenCalledWith({ name: "North Team" });
    });
    expect(toastSuccessMock).toHaveBeenCalled();
  });

  it("saves manager changes and moves a consultant into the selected team", async () => {
    updateTeamMock.mockResolvedValueOnce({
      id: "team_1",
      name: "Operations East",
      manager: { id: "11", name: "Team Manager", email: "tm@ligtas.com" },
      members: [
        {
          id: "21",
          name: "Consultant A",
          email: "consultant-a@ligtas.com",
          role: "Consultant",
          reportsCount: 2,
          teamId: "team_1",
        },
      ],
    });

    addMemberMock.mockResolvedValueOnce({
      id: "team_1",
      name: "Operations East",
      manager: { id: "11", name: "Team Manager", email: "tm@ligtas.com" },
      members: [
        {
          id: "21",
          name: "Consultant A",
          email: "consultant-a@ligtas.com",
          role: "Consultant",
          reportsCount: 2,
          teamId: "team_1",
        },
        {
          id: "22",
          name: "Consultant B",
          email: "consultant-b@ligtas.com",
          role: "Consultant",
          reportsCount: 1,
          teamId: "team_1",
        },
      ],
    });

    renderWithRouter(<TeamsView />);

    const nameInput = await screen.findByLabelText(/^Team name$/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Operations East");
    await userEvent.click(screen.getByRole("button", { name: /Save Team Changes/i }));

    await waitFor(() => {
      expect(updateTeamMock).toHaveBeenCalledWith(
        "team_1",
        expect.objectContaining({
          name: "Operations East",
        })
      );
    });

    await userEvent.type(screen.getByLabelText(/Search consultants/i), "Consultant B");
    await userEvent.click(screen.getByRole("button", { name: /Consultant B/i }));
    await userEvent.click(screen.getByRole("button", { name: /Add or Move Member/i }));

    await waitFor(() => {
      expect(addMemberMock).toHaveBeenCalledWith("team_1", 22);
    });
  });

  it("deletes an empty unmanaged team", async () => {
    const emptyTeams = [
      ...teams,
      {
        id: "team_2",
        name: "Empty Team",
        manager: null,
        memberCount: 0,
      },
    ];

    listTeamsMock
      .mockResolvedValueOnce(emptyTeams)
      .mockResolvedValueOnce(teams);
    getTeamMock
      .mockResolvedValueOnce({
        id: "team_1",
        name: "Operations",
        manager: { id: "11", name: "Team Manager", email: "tm@ligtas.com" },
        members: [
          {
            id: "21",
            name: "Consultant A",
            email: "consultant-a@ligtas.com",
            role: "Consultant",
            reportsCount: 2,
            teamId: "team_1",
          },
        ],
      })
      .mockResolvedValueOnce({
        id: "team_2",
        name: "Empty Team",
        manager: null,
        members: [],
      });
    deleteTeamMock.mockResolvedValueOnce(undefined);
    Object.defineProperty(window, "confirm", {
      writable: true,
      value: vi.fn(() => true),
    });

    renderWithRouter(<TeamsView />);

    await screen.findByText("Empty Team");
    await userEvent.click(screen.getByText("Empty Team"));
    await screen.findByRole("button", { name: /Delete Team/i });
    await userEvent.click(screen.getByRole("button", { name: /Delete Team/i }));

    await waitFor(() => {
      expect(deleteTeamMock).toHaveBeenCalledWith("team_2");
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("Team deleted");
  });
});
