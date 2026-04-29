import { prisma } from "../db/prisma";

type AuthUser = {
  userId: number;
  role: string;
  teamId?: string | null;
};

export const getVisibleUsersForRequester = async (requestingUser: AuthUser) => {
  const { role, userId } = requestingUser;

  if (role === "ADMIN") {
    return prisma.userAccount.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        teamId: true,
      },
    });
  }

  if (role === "TEAM_MANAGER") {
    return prisma.userAccount.findMany({
      where: { managed_by_user_id: userId },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });
  }

  throw new Error("Unauthorized access to users");
};

export const getReportsForUser = async (
  requestingUser: AuthUser,
  targetUserId: number
) => {
  const role = requestingUser.role.toUpperCase();

  const targetUser = await prisma.userAccount.findUnique({
    where: { id: targetUserId },
  });

  if (!targetUser) {
    throw new Error("User not found");
  }

  if (role === "TEAM_MANAGER") {
    if (targetUser.teamId !== requestingUser.teamId) {
    throw new Error("Forbidden");
    }
  }

  if (role !== "ADMIN" && role !== "TEAM_MANAGER") {
    throw new Error("Forbidden");
  }

  return prisma.report.findMany({
    where: { userAccountId: targetUserId },
    include: {
      issues: true,
      aiIssues: true,
    },
    orderBy: {
      uploadedAt: "desc",
    },
  });
};