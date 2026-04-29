import { prisma } from "../db/prisma";
import { ApiError } from "../errors/apiError";

type TeamManagerSummary = {
  id: string;
  name: string;
  email: string;
};

type TeamMemberSummary = {
  id: string;
  name: string;
  email: string;
  role: string;
  reportsCount: number;
  teamId: string | null;
};

export type TeamListItem = {
  id: string;
  name: string;
  manager: TeamManagerSummary | null;
  memberCount: number;
};

export type TeamDetail = {
  id: string;
  name: string;
  manager: TeamManagerSummary | null;
  members: TeamMemberSummary[];
};

function mapRole(userType: string): string {
  const map: Record<string, string> = {
    adm: "Admin",
    tm: "Team Manager",
    usr: "Consultant",
  };

  return map[userType] ?? "Consultant";
}

function normalizeTeamName(name: unknown): string {
  return typeof name === "string" ? name.trim() : "";
}

function toTeamManagerSummary(user: { id: number; name: string | null; email: string } | null): TeamManagerSummary | null {
  if (!user) {
    return null;
  }

  return {
    id: String(user.id),
    name: user.name ?? user.email,
    email: user.email,
  };
}

function toTeamMemberSummary(user: {
  id: number;
  name: string | null;
  email: string;
  user_type: string;
  teamId: string | null;
  _count: { reports: number };
}): TeamMemberSummary {
  return {
    id: String(user.id),
    name: user.name ?? user.email,
    email: user.email,
    role: mapRole(user.user_type),
    reportsCount: user._count.reports,
    teamId: user.teamId,
  };
}

function toTeamDetail(team: {
  id: string;
  name: string;
  manager: { id: number; name: string | null; email: string } | null;
  members: Array<{
    id: number;
    name: string | null;
    email: string;
    user_type: string;
    teamId: string | null;
    _count: { reports: number };
  }>;
}): TeamDetail {
  return {
    id: team.id,
    name: team.name,
    manager: toTeamManagerSummary(team.manager),
    members: team.members.map(toTeamMemberSummary).sort((a, b) => a.email.localeCompare(b.email)),
  };
}

async function validateManagerForTeam(managerUserId: number, teamId?: string): Promise<void> {
  const manager = await prisma.userAccount.findUnique({
    where: { id: managerUserId },
    select: { id: true, user_type: true },
  });

  if (!manager) {
    throw new ApiError(404, "not_found", "Team manager not found.");
  }

  if (manager.user_type !== "tm") {
    throw new ApiError(400, "invalid_request", "Assigned manager must have the Team Manager role.");
  }

  const existingTeam = await prisma.team.findFirst({
    where: {
      managerUserId,
      ...(teamId ? { id: { not: teamId } } : {}),
    },
    select: { id: true },
  });

  if (existingTeam) {
    throw new ApiError(409, "invalid_request", "This team manager is already assigned to another team.");
  }
}

async function getExistingTeamByName(name: string, teamId?: string) {
  return prisma.team.findFirst({
    where: {
      name,
      ...(teamId ? { id: { not: teamId } } : {}),
    },
    select: { id: true },
  });
}

async function getTeamOrThrow(teamId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true },
  });

  if (!team) {
    throw new ApiError(404, "not_found", "Team not found.");
  }

  return team;
}

async function syncLegacyManagerAssignments(teamId: string, managerUserId: number | null) {
  // Keep the legacy consultant-manager field aligned while the team relation remains the source of truth.
  await prisma.userAccount.updateMany({
    where: { teamId, user_type: "usr" },
    data: { managed_by_user_id: managerUserId },
  });
}

export async function listTeams(): Promise<TeamListItem[]> {
  const teams = await prisma.team.findMany({
    select: {
      id: true,
      name: true,
      manager: { select: { id: true, name: true, email: true } },
      _count: { select: { members: true } },
    },
    orderBy: { name: "asc" },
  });

  return teams.map((team) => ({
    id: team.id,
    name: team.name,
    manager: toTeamManagerSummary(team.manager),
    memberCount: team._count.members,
  }));
}

export async function createTeam(params: { name: string }): Promise<TeamDetail> {
  const name = normalizeTeamName(params.name);

  if (!name) {
    throw new ApiError(400, "invalid_request", "Team name is required.");
  }

  const existing = await getExistingTeamByName(name);
  if (existing) {
    throw new ApiError(409, "invalid_request", "A team with this name already exists.");
  }

  const created = await prisma.team.create({
    data: { name },
    select: {
      id: true,
      name: true,
      manager: { select: { id: true, name: true, email: true } },
      members: {
        select: {
          id: true,
          name: true,
          email: true,
          user_type: true,
          teamId: true,
          _count: { select: { reports: true } },
        },
      },
    },
  });

  return toTeamDetail(created);
}

export async function getTeamDetail(teamId: string): Promise<TeamDetail> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      id: true,
      name: true,
      manager: { select: { id: true, name: true, email: true } },
      members: {
        select: {
          id: true,
          name: true,
          email: true,
          user_type: true,
          teamId: true,
          _count: { select: { reports: true } },
        },
      },
    },
  });

  if (!team) {
    throw new ApiError(404, "not_found", "Team not found.");
  }

  return toTeamDetail(team);
}

export async function updateTeam(
  teamId: string,
  params: { name?: string; managerUserId?: number | null },
): Promise<TeamDetail> {
  await getTeamOrThrow(teamId);

  const updates: { name?: string; managerUserId?: number | null } = {};

  if (params.name !== undefined) {
    const name = normalizeTeamName(params.name);
    if (!name) {
      throw new ApiError(400, "invalid_request", "Team name is required.");
    }

    const existing = await getExistingTeamByName(name, teamId);
    if (existing) {
      throw new ApiError(409, "invalid_request", "A team with this name already exists.");
    }

    updates.name = name;
  }

  if (params.managerUserId !== undefined) {
    if (params.managerUserId === null) {
      updates.managerUserId = null;
    } else {
      await validateManagerForTeam(params.managerUserId, teamId);
      updates.managerUserId = params.managerUserId;
    }
  }

  const updated = await prisma.team.update({
    where: { id: teamId },
    data: updates,
    select: {
      id: true,
      name: true,
      managerUserId: true,
      manager: { select: { id: true, name: true, email: true } },
      members: {
        select: {
          id: true,
          name: true,
          email: true,
          user_type: true,
          teamId: true,
          _count: { select: { reports: true } },
        },
      },
    },
  });

  if (params.managerUserId !== undefined) {
    await syncLegacyManagerAssignments(teamId, updated.managerUserId ?? null);
  }

  return toTeamDetail(updated);
}

export async function addTeamMember(teamId: string, userId: number): Promise<TeamDetail> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, managerUserId: true },
  });

  if (!team) {
    throw new ApiError(404, "not_found", "Team not found.");
  }

  const user = await prisma.userAccount.findUnique({
    where: { id: userId },
    select: { id: true, user_type: true },
  });

  if (!user) {
    throw new ApiError(404, "not_found", "User not found.");
  }

  if (user.user_type !== "usr") {
    throw new ApiError(400, "invalid_request", "Only consultants can be assigned as team members.");
  }

  await prisma.userAccount.update({
    where: { id: userId },
    data: {
      teamId,
      managed_by_user_id: team.managerUserId ?? null,
    },
  });

  return getTeamDetail(teamId);
}

export async function removeTeamMember(teamId: string, userId: number): Promise<TeamDetail> {
  await getTeamOrThrow(teamId);

  const user = await prisma.userAccount.findUnique({
    where: { id: userId },
    select: { id: true, teamId: true, user_type: true },
  });

  if (!user) {
    throw new ApiError(404, "not_found", "User not found.");
  }

  if (user.user_type !== "usr") {
    throw new ApiError(400, "invalid_request", "Only consultants can be removed as team members.");
  }

  if (user.teamId !== teamId) {
    throw new ApiError(400, "invalid_request", "User is not a member of this team.");
  }

  await prisma.userAccount.update({
    where: { id: userId },
    data: {
      teamId: null,
      managed_by_user_id: null,
    },
  });

  return getTeamDetail(teamId);
}

export async function deleteTeam(teamId: string): Promise<void> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      id: true,
      managerUserId: true,
      _count: { select: { members: true } },
    },
  });

  if (!team) {
    throw new ApiError(404, "not_found", "Team not found.");
  }

  if (team.managerUserId != null || team._count.members > 0) {
    throw new ApiError(
      400,
      "invalid_request",
      "Remove the team manager and all team members before deleting this team.",
    );
  }

  await prisma.team.delete({
    where: { id: teamId },
  });
}

export async function getManagedTeam(managerUserId: number): Promise<TeamDetail | null> {
  const team = await prisma.team.findFirst({
    where: { managerUserId },
    select: {
      id: true,
      name: true,
      manager: { select: { id: true, name: true, email: true } },
      members: {
        select: {
          id: true,
          name: true,
          email: true,
          user_type: true,
          teamId: true,
          _count: { select: { reports: true } },
        },
      },
    },
  });

  return team ? toTeamDetail(team) : null;
}
