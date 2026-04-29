import { Router } from "express";
import { AuthPayload, authenticateToken, requireAdmin } from "../middleware/auth";
import { ApiError } from "../errors/apiError";
import { prisma } from "../db/prisma";
import {
  addTeamMember,
  createTeam,
  deleteTeam,
  getManagedTeam,
  getTeamDetail,
  listTeams,
  removeTeamMember,
  updateTeam,
} from "../services/teamService";

const router = Router();

router.get("/", authenticateToken, requireAdmin, async (_req, res, next) => {
  try {
    res.json(await listTeams());
  } catch (error) {
    next(error);
  }
});

router.post("/", authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const team = await createTeam({ name: req.body?.name });
    res.status(201).json(team);
  } catch (error) {
    next(error);
  }
});

router.get("/me", authenticateToken, async (req, res, next) => {
  const auth = (req as unknown as { user: AuthPayload }).user;

  if (auth.role !== "TEAM_MANAGER") {
    return next(new ApiError(403, "unauthorized", "Team Manager access required."));
  }

  try {
    res.json(await getManagedTeam(auth.userId));
  } catch (error) {
    next(error);
  }
});

router.get("/me/recent-reports", authenticateToken, async (req, res, next) => {
  const auth = (req as unknown as { user: AuthPayload }).user;

  if (auth.role !== "TEAM_MANAGER") {
    return next(new ApiError(403, "unauthorized", "Team Manager access required."));
  }

  try {
    const team = await prisma.team.findFirst({
      where: { managerUserId: auth.userId },
      select: { id: true },
    });

    if (!team) {
      res.json([]);
      return;
    }

    const reports = await prisma.report.findMany({
      where: { userAccount: { teamId: team.id } },
      orderBy: { uploadedAt: "desc" },
      take: 10,
      include: {
        userAccount: { select: { email: true } },
        issues: { select: { reviewStatus: true } },
      },
    });

    const list = reports.map((r) => {
      const openIssues = r.issues.filter((issue) => issue.reviewStatus === "OPEN").length;
      const completedIssues = r.issues.filter((issue) => issue.reviewStatus === "COMPLETED").length;
      const falsePositiveIssues = r.issues.filter((issue) => issue.reviewStatus === "FALSE_POSITIVE").length;
      const reviewStatus =
        r.status !== "COMPLETED"
          ? "not_started"
          : r.totalIssues === 0 || openIssues === 0
            ? "completed"
            : completedIssues > 0 || falsePositiveIssues > 0
              ? "in_review"
              : "not_started";

      return {
        id: r.id,
        fileName: r.fileName,
        uploadDate: r.uploadedAt.toISOString(),
        analyst: r.userAccount?.email ?? "???",
        analystUserId: r.userAccountId ?? null,
        status: r.status === "COMPLETED" ? (r.passedQC ? "passed" : "failed") : "processing",
        issuesFound: r.totalIssues,
        openIssues,
        completedIssues,
        falsePositiveIssues,
        reviewStatus,
      };
    });

    res.json(list);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    res.json(await getTeamDetail(String(req.params.id)));
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", authenticateToken, requireAdmin, async (req, res, next) => {
  const managerUserId =
    req.body && Object.prototype.hasOwnProperty.call(req.body, "managerUserId")
      ? req.body.managerUserId == null || req.body.managerUserId === ""
        ? null
        : Number(req.body.managerUserId)
      : undefined;

  if (managerUserId !== undefined && managerUserId !== null && Number.isNaN(managerUserId)) {
    return next(new ApiError(400, "invalid_request", "managerUserId must be a valid number."));
  }

  try {
    res.json(
      await updateTeam(String(req.params.id), {
        name: req.body?.name,
        managerUserId,
      }),
    );
  } catch (error) {
    next(error);
  }
});

router.post("/:id/members", authenticateToken, requireAdmin, async (req, res, next) => {
  const userId = Number(req.body?.userId);

  if (Number.isNaN(userId)) {
    return next(new ApiError(400, "invalid_request", "userId must be a valid number."));
  }

  try {
    res.json(await addTeamMember(String(req.params.id), userId));
  } catch (error) {
    next(error);
  }
});

router.delete("/:id/members/:userId", authenticateToken, requireAdmin, async (req, res, next) => {
  const userId = Number(req.params.userId);

  if (Number.isNaN(userId)) {
    return next(new ApiError(400, "invalid_request", "userId must be a valid number."));
  }

  try {
    res.json(await removeTeamMember(String(req.params.id), userId));
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    await deleteTeam(String(req.params.id));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
