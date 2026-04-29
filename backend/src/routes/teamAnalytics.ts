import { Router } from "express";
import { AuthPayload, authenticateToken, requireAdminOrTeamManager } from "../middleware/auth";
import {
  getConsultantPerformance,
  getTeamAnalyticsIssueTypes,
  getTeamAnalyticsKpis,
  getTeamAnalyticsTrends,
  getTeamPerformance,
  parseTeamAnalyticsFilters,
} from "../services/teamAnalyticsService";

const router = Router();

function authFromRequest(req: unknown): AuthPayload {
  return (req as { user: AuthPayload }).user;
}

router.get("/kpis", authenticateToken, requireAdminOrTeamManager, async (req, res, next) => {
  try {
    const filters = parseTeamAnalyticsFilters(req.query as Record<string, unknown>);
    const data = await getTeamAnalyticsKpis(authFromRequest(req), filters);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get("/issue-types", authenticateToken, requireAdminOrTeamManager, async (req, res, next) => {
  try {
    const filters = parseTeamAnalyticsFilters(req.query as Record<string, unknown>);
    const data = await getTeamAnalyticsIssueTypes(authFromRequest(req), filters);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get("/trends", authenticateToken, requireAdminOrTeamManager, async (req, res, next) => {
  try {
    const filters = parseTeamAnalyticsFilters(req.query as Record<string, unknown>);
    const data = await getTeamAnalyticsTrends(authFromRequest(req), filters);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get("/team-performance", authenticateToken, requireAdminOrTeamManager, async (req, res, next) => {
  try {
    const filters = parseTeamAnalyticsFilters(req.query as Record<string, unknown>);
    const data = await getTeamPerformance(authFromRequest(req), filters);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get("/consultant-performance", authenticateToken, requireAdminOrTeamManager, async (req, res, next) => {
  try {
    const filters = parseTeamAnalyticsFilters(req.query as Record<string, unknown>);
    const data = await getConsultantPerformance(authFromRequest(req), filters);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

export default router;
