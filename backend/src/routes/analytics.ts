import { Router } from "express";
import { authenticateToken, requireAdmin, AuthPayload } from "../middleware/auth";
import { ApiError } from "../errors/apiError";
import { getMailServiceAvailability } from "../services/mailService";
import {
  getConsultantQualitySignals,
  getAnalyticsIssueTypes,
  getAnalyticsKpis,
  getAnalyticsSectionDensity,
  getAnalyticsTrends,
  getRecurringIssueRate,
  parseAnalyticsFilters,
  getUserLeaderboard, // Added user leaderboard import
} from "../services/analyticsService";
import { exportWeeklyDigestAsCsv, exportWeeklyDigestAsPdf } from "../services/weeklyDigestExportService";
import { shareWeeklyDigest } from "../services/weeklyDigestShareService";

const router = Router();

router.get("/kpis", authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const filters = parseAnalyticsFilters(req.query as Record<string, unknown>);
    const data = await getAnalyticsKpis(filters);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get("/issue-types", authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const filters = parseAnalyticsFilters(req.query as Record<string, unknown>);
    const data = await getAnalyticsIssueTypes(filters);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get("/trends", authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const filters = parseAnalyticsFilters(req.query as Record<string, unknown>);
    const data = await getAnalyticsTrends(filters);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get("/section-density", authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const filters = parseAnalyticsFilters(req.query as Record<string, unknown>);
    const data = await getAnalyticsSectionDensity(filters);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get("/recurring-issue-rate", authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const filters = parseAnalyticsFilters(req.query as Record<string, unknown>);
    const data = await getRecurringIssueRate(filters);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get("/consultant-signals", authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const filters = parseAnalyticsFilters(req.query as Record<string, unknown>);
    const data = await getConsultantQualitySignals(filters);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get("/weekly-digest/export", authenticateToken, requireAdmin, async (req, res, next) => {
  const format = String(req.query.format ?? "").toLowerCase();

  if (format !== "csv" && format !== "pdf") {
    return next(new ApiError(400, "invalid_request", "format must be csv or pdf."));
  }

  try {
    const exportFile = format === "csv"
      ? await exportWeeklyDigestAsCsv({
          weekStart: String(req.query.weekStart ?? ""),
          consultantId: typeof req.query.consultantId === "string" ? req.query.consultantId : undefined,
          issueType: typeof req.query.issueType === "string" ? req.query.issueType : undefined,
        })
      : await exportWeeklyDigestAsPdf({
          weekStart: String(req.query.weekStart ?? ""),
          consultantId: typeof req.query.consultantId === "string" ? req.query.consultantId : undefined,
          issueType: typeof req.query.issueType === "string" ? req.query.issueType : undefined,
        });

    res.setHeader("Content-Type", exportFile.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${exportFile.fileName}"`);
    res.status(200).send(exportFile.buffer);
  } catch (error) {
    next(error);
  }
});

router.get("/weekly-digest/availability", authenticateToken, requireAdmin, (_req, res) => {
  const availability = getMailServiceAvailability();
  res.json({
    sharingAvailable: availability.available,
    sharingUnavailableReason: availability.available ? null : availability.reason ?? null,
  });
});

router.post("/weekly-digest/share", authenticateToken, requireAdmin, async (req, res, next) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const format = String(req.body?.format ?? "").toLowerCase();
  const recipientEmail = String(req.body?.recipientEmail ?? "");
  const message = req.body?.message == null ? undefined : String(req.body.message);

  if (format !== "csv" && format !== "pdf") {
    return next(new ApiError(400, "invalid_request", "format must be csv or pdf."));
  }

  if (!recipientEmail.trim()) {
    return next(new ApiError(400, "invalid_request", "recipientEmail is required."));
  }

  try {
    const result = await shareWeeklyDigest({
      format,
      weekStart: String(req.body?.weekStart ?? ""),
      consultantId: typeof req.body?.consultantId === "string" ? req.body.consultantId : undefined,
      issueType: typeof req.body?.issueType === "string" ? req.body.issueType : undefined,
      recipientEmail,
      actorUserId: auth.userId,
      message,
      senderEmail: auth.email,
      senderRole: auth.role,
    });

    res.status(200).json({
      recipientEmail: result.recipientEmail,
      format: result.format,
      fileName: result.fileName,
      message: "Weekly digest email sent successfully.",
    });
  } catch (error) {
    next(error);
  }
});

router.get("/leaderboard", authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const data = await getUserLeaderboard();
    res.json(data);
  } catch (error) {
    next(error);
  }
});

export default router;
