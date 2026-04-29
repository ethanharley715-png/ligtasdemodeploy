import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../errors/apiError";
import { createReportSessionFromUpload, UploadedReportFile } from "../services/reportSessionService";
import type { AiLocationMode, ReportScanMode } from "../services/reportAnalysisService";

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

export async function uploadReportHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    const auth = (req as { user?: { userId: number } }).user;
    const userAccountId = auth?.userId;
    const file = req.file as UploadedReportFile | undefined;

    if (userAccountId == null) {
        return next(new ApiError(401, "unauthorized", "Authentication is required."));
    }

    if (!file) {
        return next(new ApiError(400, "file_required", "A PDF report file is required."));
    }

    try {
        const scanMode = parseScanMode(req.query.scanMode);
        const aiLocationMode = parseAiLocationMode(req.query.aiLocationMode);

        // Stream newline-delimited progress chunks so long PDF scans can update the UI.
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.setHeader("Transfer-Encoding", "chunked");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");
        res.flushHeaders();

        const result = await createReportSessionFromUpload(
            { userAccountId, file, scanMode, aiLocationMode },
            {
                onProgress: (batchIssues, processed, total) => {
                    res.write(JSON.stringify({
                        stage: "batch_done",
                        processed,
                        total,
                        batchIssues,
                    }) + "\n");

                    (res as Response & { flush?: () => void }).flush?.();
                },
            },
        );

        // The final chunk carries the persisted report/session identifiers used by the frontend handoff.
        res.write(JSON.stringify({ stage: "done", result }) + "\n");
        res.end();

    } catch (error: any) {
        console.warn("[reports/upload] failed", {
            userAccountId,
            filename: file?.originalname,
            fileSize: file?.size,
            errorCode: error instanceof ApiError ? error.code : "internal_error",
        });

        if (!res.headersSent) {
            res.status(error.status || 500).json({ error: error.message });
        } else {
            res.write(JSON.stringify({ stage: "error", error: error.message }) + "\n");
            res.end();
        }
    }
}
