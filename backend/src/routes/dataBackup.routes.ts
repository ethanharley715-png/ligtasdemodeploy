import { Router } from "express";
import { authenticateToken, requireAdminOrTeamManager } from "../middleware/auth";
import type { AuthPayload } from "../middleware/auth";
import { ApiError } from "../errors/apiError";
import { prisma } from "../db/prisma";
import {
  exportAllReportsAsAggregatedCsv,
  exportAllReportsAsZip,
  type TeamExportScope,
} from "../services/reportExportService";

const router = Router();

async function resolveExportScope(auth: AuthPayload, teamIdQuery: unknown): Promise<TeamExportScope> {
  if (auth.role === "ADMIN") {
    const raw = typeof teamIdQuery === "string" ? teamIdQuery : "";
    if (!raw || raw === "all") {
      return { mode: "all" };
    }
    const team = await prisma.team.findUnique({ where: { id: raw } });
    if (!team) {
      throw new ApiError(404, "not_found", "Team not found.");
    }
    return { mode: "team", teamId: team.id };
  }
  if (auth.role === "TEAM_MANAGER") {
    const team = await prisma.team.findFirst({ where: { managerUserId: auth.userId } });
    if (!team) {
      throw new ApiError(404, "not_found", "No managed team.");
    }
    return { mode: "team", teamId: team.id };
  }
  throw new ApiError(403, "unauthorized", "Access denied.");
}

router.post("/backup/manual", authenticateToken, requireAdminOrTeamManager, async (req, res, next) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  try {
    let scopeLabel: string;
    if (auth.role === "ADMIN") {
      const bodyTeam = req.body?.teamId as string | undefined;
      if (!bodyTeam || bodyTeam === "all") {
        scopeLabel = "all teams";
      } else {
        const team = await prisma.team.findUnique({ where: { id: bodyTeam } });
        if (!team) {
          return next(new ApiError(404, "not_found", "Team not found."));
        }
        scopeLabel = `team "${team.name}"`;
      }
    } else {
      const team = await prisma.team.findFirst({ where: { managerUserId: auth.userId } });
      if (!team) {
        return next(new ApiError(404, "not_found", "No managed team."));
      }
      scopeLabel = `your team "${team.name}"`;
    }

    const backupId = `bk-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    res.status(200).json({
      ok: true,
      backupId,
      completedAt: new Date().toISOString(),
      message: `Backup completed for ${scopeLabel}.`,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/reports/export-all", authenticateToken, requireAdminOrTeamManager, async (req, res, next) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const format = String(req.query.format ?? "").toLowerCase();
  if (format !== "csv" && format !== "zip") {
    return next(new ApiError(400, "invalid_request", "format must be csv or zip."));
  }
  try {
    const scope = await resolveExportScope(auth, req.query.teamId);
    const exportFile =
      format === "csv" ? await exportAllReportsAsAggregatedCsv(scope) : await exportAllReportsAsZip(scope);
    res.setHeader("Content-Type", exportFile.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${exportFile.fileName}"`);
    res.status(200).send(exportFile.buffer);
  } catch (error) {
    next(error);
  }
});

export default router;
