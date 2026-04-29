import { Router } from "express";
import { prisma } from "../db/prisma";
import { authenticateToken, requireAdmin, requireAdminOrTeamManager } from "../middleware/auth";
import { AuthPayload } from "../middleware/auth";
import { hashPasswordWithUsername } from "../utils/passwordHasher";


const router = Router();

function mapRole(userType: string): string {
  const map: Record<string, string> = {
    adm: "Admin",
    tm: "Team Manager",
    usr: "Consultant",
  };
  return map[userType] ?? "Consultant";
}

function toUserListItem(u: {
  id: number;
  email: string;
  name: string | null;
  user_type: string;
  managed_by_user_id: number | null;
  teamId: string | null;
  team: { name: string } | null;
  _count: { reports: number };
}) {
  return {
    id: String(u.id),
    name: u.name ?? u.email,
    email: u.email,
    role: mapRole(u.user_type),
    status: "Active",
    lastActive: "—",
    reportsCount: u._count.reports,
    managedBy: null,
    managedByUserId: u.managed_by_user_id,
    teamId: u.teamId,
    teamName: u.team?.name ?? null,
    userType: u.user_type,
  };
}

router.get("/me", authenticateToken, async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;

  try {
    const user = await prisma.userAccount.findUnique({
      where: { id: auth.userId },
      select: {
        id: true,
        email: true,
        name: true,
        user_type: true,
        managed_by_user_id: true,
        teamId: true,
        team: { select: { name: true } },
        _count: { select: { reports: true } },
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(toUserListItem(user));
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to fetch current user" });
  }
});

router.patch("/me", authenticateToken, async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const { name } = req.body ?? {};

  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ message: "Name is required" });
  }

  const trimmedName = name.trim();

  if (trimmedName.length < 2) {
    return res.status(400).json({ message: "Name must be at least 2 characters long" });
  }

  if (trimmedName.length > 100) {
    return res.status(400).json({ message: "Name must be 100 characters or fewer" });
  }

  try {
    const existing = await prisma.userAccount.findUnique({
      where: { id: auth.userId },
      select: {
        id: true,
        email: true,
        name: true,
        user_type: true,
        managed_by_user_id: true,
        teamId: true,
        team: { select: { name: true } },
        _count: { select: { reports: true } },
      },
    });

    if (!existing) {
      return res.status(404).json({ message: "User not found" });
    }

    const updated = await prisma.userAccount.update({
      where: { id: auth.userId },
      data: { name: trimmedName },
      select: {
        id: true,
        email: true,
        name: true,
        user_type: true,
        managed_by_user_id: true,
        teamId: true,
        team: { select: { name: true } },
        _count: { select: { reports: true } },
      },
    });

    res.json(toUserListItem(updated));
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to update profile" });
  }
});

router.get("/", authenticateToken, requireAdmin, async (_req, res) => {
  try {
    const users = await prisma.userAccount.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        user_type: true,
        managed_by_user_id: true,
        teamId: true,
        team: { select: { name: true } },
        _count: { select: { reports: true } },
      },
      orderBy: { email: "asc" },
    });

    res.json(users.map((u) => toUserListItem(u)));
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

router.get("/team", authenticateToken, requireAdminOrTeamManager, async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;

  if (auth.role !== "TEAM_MANAGER") {
    return res.json([]);
  }

  try {
    const users = await prisma.userAccount.findMany({
      where: { managed_by_user_id: auth.userId },
      select: {
        id: true,
        email: true,
        name: true,
        user_type: true,
        managed_by_user_id: true,
        teamId: true,
        team: { select: { name: true } },
        _count: { select: { reports: true } },
      },
      orderBy: { email: "asc" },
    });

    res.json(users.map((u) => toUserListItem(u)));
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to fetch team" });
  }
});

router.post("/", authenticateToken, requireAdmin, async (req, res) => {
  const { email, password, role, managedByUserId, name } = req.body ?? {};

  if (!email || typeof email !== "string") {
    return res.status(400).json({ message: "Email required" });
  }

  if (!password || typeof password !== "string") {
    return res.status(400).json({ message: "Password required" });
  }

  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ message: "Name required" });
  }

  const userTypeMap: Record<string, string> = {
    Admin: "adm",
    "Team Manager": "tm",
    Consultant: "usr",
  };
  const userType = userTypeMap[role] ?? "usr";
  const normalizedEmail = email.toLowerCase().trim();

  try {
    const existing = await prisma.userAccount.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      return res.status(409).json({ message: "User with this email already exists" });
    }

    const hash = hashPasswordWithUsername(normalizedEmail, password);

    const created = await prisma.userAccount.create({
      data: {
        email: normalizedEmail,
        name: name.trim(),
        password_hash: hash,
        user_type: userType,
        managed_by_user_id:
          managedByUserId != null && userType === "usr" ? Number(managedByUserId) : null,
      },
      select: { id: true },
    });

    const user = await prisma.userAccount.findUnique({
      where: { id: created.id },
      select: {
        id: true,
        email: true,
        name: true,
        user_type: true,
        managed_by_user_id: true,
        teamId: true,
        team: { select: { name: true } },
        _count: { select: { reports: true } },
      },
    });

    if (!user) {
      return res.status(500).json({ message: "Failed to load created user" });
    }

    res.status(201).json(toUserListItem(user));
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to create user" });
  }
});

router.patch("/:id", authenticateToken, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);

  if (Number.isNaN(id)) {
    return res.status(400).json({ message: "Invalid user ID" });
  }

  const auth = (req as unknown as { user: AuthPayload }).user;

  if (auth?.userId === id) {
    const { role } = req.body ?? {};
    const userTypeMap: Record<string, string> = {
      Admin: "adm",
      "Team Manager": "tm",
      Consultant: "usr",
    };
    const newType = role != null ? userTypeMap[role as string] : undefined;

    if (newType && newType !== "adm") {
      return res.status(403).json({ message: "You cannot demote your own account" });
    }
  }

  const { email, role, managedByUserId, name } = req.body ?? {};

  try {
    const existing = await prisma.userAccount.findUnique({ where: { id } });

    if (!existing) {
      return res.status(404).json({ message: "User not found" });
    }

    const userTypeMap: Record<string, string> = {
      Admin: "adm",
      "Team Manager": "tm",
      Consultant: "usr",
    };

    const updates: {
      email?: string;
      name?: string;
      user_type?: string;
      managed_by_user_id?: number | null;
    } = {};

    if (email != null && typeof email === "string") {
      const trimmed = email.toLowerCase().trim();

      if (trimmed !== existing.email) {
        const taken = await prisma.userAccount.findUnique({ where: { email: trimmed } });
        if (taken) {
          return res.status(409).json({ message: "Email already in use" });
        }
        updates.email = trimmed;
      }
    }

    if (name != null && typeof name === "string" && name.trim()) {
      updates.name = name.trim();
    }

    if (role != null && userTypeMap[role]) {
      if (userTypeMap[role] !== "tm") {
        const managedTeam = await prisma.team.findFirst({
          where: { managerUserId: id },
          select: { id: true },
        });

        if (managedTeam) {
          return res.status(400).json({ message: "Remove the user as team manager before changing this role" });
        }
      }

      updates.user_type = userTypeMap[role];
    }

    if (managedByUserId !== undefined) {
      updates.managed_by_user_id =
        managedByUserId == null || managedByUserId === "" ? null : Number(managedByUserId);
    }

    await prisma.userAccount.update({
      where: { id },
      data: updates,
      select: { id: true },
    });

    const updated = await prisma.userAccount.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        user_type: true,
        managed_by_user_id: true,
        teamId: true,
        team: { select: { name: true } },
        _count: { select: { reports: true } },
      },
    });

    if (!updated) {
      return res.status(500).json({ message: "Failed to load updated user" });
    }

    res.json(toUserListItem(updated));
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to update user" });
  }
});

router.delete("/:id", authenticateToken, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);

  if (Number.isNaN(id)) {
    return res.status(400).json({ message: "Invalid user ID" });
  }

  const auth = (req as unknown as { user: AuthPayload }).user;

  if (auth?.userId === id) {
    return res.status(403).json({ message: "You cannot delete your own account" });
  }

  try {
    const existing = await prisma.userAccount.findUnique({ where: { id } });

    if (!existing) {
      return res.status(404).json({ message: "User not found" });
    }

    await prisma.userAccount.delete({ where: { id } });
    res.status(204).send();
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to delete user" });
  }
});

router.get("/:id/reports", authenticateToken, requireAdminOrTeamManager, async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const targetUserId = Number(req.params.id);

  if (Number.isNaN(targetUserId)) {
    return res.status(400).json({ message: "Invalid user ID" });
  }

  try {
    const targetUser = await prisma.userAccount.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        managed_by_user_id: true,
      },
    });

    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (auth.role !== "ADMIN") {
      if (auth.role === "TEAM_MANAGER") {
        if (targetUser.managed_by_user_id !== auth.userId) {
          return res.status(403).json({ message: "Not allowed" });
        }
      } else {
        return res.status(403).json({ message: "Not allowed" });
      }
    }

    const reports = await prisma.report.findMany({
      where: { userAccountId: targetUserId },
      include: {
        issues: true,
        aiIssues: true,
      },
      orderBy: {
        uploadedAt: "desc",
      },
    });

    res.json(reports);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to retrieve reports" });
  }
});

export default router;


