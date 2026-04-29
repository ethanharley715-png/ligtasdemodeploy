import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../errors/apiError";
import {
  analyzeReportSession,
  type AiLocationMode,
  type ReportScanMode,
} from "../services/reportAnalysisService";

function parseScanMode(raw: unknown): ReportScanMode | undefined {
  if (raw == null || raw === "") {
    return undefined;
  }

  const normalized = String(raw).toLowerCase();
  if (normalized === "ai" || normalized === "rules") {
    return normalized;
  }

  throw new ApiError(400, "invalid_scan_mode", "Invalid report scan mode.");
}

function parseAiLocationMode(raw: unknown): AiLocationMode | undefined {
  if (raw == null || raw === "") {
    return undefined;
  }

  const normalized = String(raw).toLowerCase();
  if (normalized === "full") {
    return "full";
  }

  if (normalized === "canonical_only") {
    return "canonical_only";
  }

  throw new ApiError(400, "invalid_request", "aiLocationMode must be full or canonical_only.");
}

export async function analyzeReportSessionHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const auth = (req as { user?: { userId?: number | string; role?: string } }).user;
  const reportSessionId = String(req.params.reportSessionId ?? "");

  const userAccountId = Number(auth?.userId);
  if (!Number.isFinite(userAccountId)) {
    return next(new ApiError(401, "unauthorized", "Authentication is required."));
  }

  if (!reportSessionId) {
    return next(new ApiError(400, "invalid_request", "reportSessionId is required."));
  }

  try {
    const scanMode = parseScanMode(req.query.scanMode);
    const aiLocationMode = parseAiLocationMode(req.query.aiLocationMode);
    const { created, result } = await analyzeReportSession(
      reportSessionId,
      {
        userAccountId,
        role: auth?.role ?? "",
      },
      undefined,
      undefined,
      undefined,
      scanMode,
      { aiLocationMode },
    );

    res.status(created ? 201 : 200).json(result);
  } catch (error) {
    next(error);
  }
}
