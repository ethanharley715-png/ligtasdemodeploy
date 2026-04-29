import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../errors/apiError";
import { getSessionQcResults } from "../services/reportAnalysisService";

export async function getSessionQcResultsHandler(
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
    const result = await getSessionQcResults(reportSessionId, {
      userAccountId,
      role: auth?.role ?? "",
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
