import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { authenticateToken, AuthPayload } from "../middleware/auth";
import { uploadReportHandler } from "../controllers/uploadReportController";
import { uploadReportFile } from "../middleware/uploadReportFile";
import { analyzeReportSessionHandler } from "../controllers/analyzeReportSessionController";
import { getSessionQcResultsHandler } from "../controllers/getSessionQcResultsController";
import { ApiError } from "../errors/apiError";
import { exportReportAsCsv, exportReportAsPdf } from "../services/reportExportService";
import { shareReportExport } from "../services/reportShareService";
import { getMailServiceAvailability } from "../services/mailService";

const router = Router();

router.patch("/tags", authenticateToken, async (req, res) => {
    const auth = (req as unknown as { user: AuthPayload }).user;

    const reportId = String(req.body?.reportId ?? "");
    const tagStatusRaw = req.body?.tagStatus;

    if (!reportId) {
        return res.status(400).json({ message: "reportId is required" });
    }

    if (tagStatusRaw === undefined || tagStatusRaw === null || isNaN(Number(tagStatusRaw))) {
        return res.status(400).json({ message: "tagStatus must be a valid number" });
    }

    const tagStatus = Number(tagStatusRaw);

    try {
        // Report tags follow the same visibility rules as report list/detail access.
        const existing = await prisma.report.findFirst({
            where: {
                id: reportId,
                ...(auth.role !== "ADMIN" ? { userAccountId: auth.userId } : {}),
            },
            select: { id: true, tagStatus: true },
        });

        if (!existing) {
            return res.status(404).json({ message: "Report not found" });
        }

        const updated = await prisma.report.update({
            where: { id: reportId },
            data: { tagStatus },
            select: {
                id: true,
                tagStatus: true,
            },
        });

        res.json({
            id: updated.id,
            tagStatus: updated.tagStatus,
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Failed to update tag status" });
    }
});

router.post("/upload", authenticateToken, uploadReportFile, uploadReportHandler);
router.post("/sessions/:reportSessionId/analyze", authenticateToken, analyzeReportSessionHandler);
router.get("/sessions/:reportSessionId/qc-results", authenticateToken, getSessionQcResultsHandler);
router.get("/:id/export", authenticateToken, async (req, res, next) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const reportId = String(req.params.id);
  const format = String(req.query.format ?? "").toLowerCase();

  if (format !== "csv" && format !== "pdf") {
    return next(new ApiError(400, "invalid_request", "format must be csv or pdf."));
  }

  try {
    const exportFile = format === "csv"
      ? await exportReportAsCsv(reportId, { userAccountId: auth.userId, role: auth.role })
      : await exportReportAsPdf(reportId, { userAccountId: auth.userId, role: auth.role });

    res.setHeader("Content-Type", exportFile.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${exportFile.fileName}"`);
    res.status(200).send(exportFile.buffer);
  } catch (error) {
    next(error);
  }
});
router.post("/:id/share", authenticateToken, async (req, res, next) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const reportId = String(req.params.id);
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
    const result = await shareReportExport({
      reportId,
      format,
      recipientEmail,
      message,
      actor: {
        userAccountId: auth.userId,
        role: auth.role,
        email: auth.email,
      },
    });

    res.status(200).json({
      recipientEmail: result.recipientEmail,
      format: result.format,
      fileName: result.fileName,
      message: "Report export email sent successfully.",
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/issues/:issueId/review", authenticateToken, async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const issueId = String(req.params.issueId);
  const requestedStatus = String(req.body?.status ?? "").toUpperCase();

  if (!["OPEN", "COMPLETED", "FALSE_POSITIVE"].includes(requestedStatus)) {
    res.status(400).json({ message: "status must be OPEN, COMPLETED, or FALSE_POSITIVE" });
    return;
  }

  try {
    const existing = await prisma.issue.findFirst({
      where: {
        id: issueId,
        report: auth.role === "ADMIN" ? undefined : { userAccountId: auth.userId },
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      res.status(404).json({ message: "Issue not found" });
      return;
    }

    const updated = await prisma.issue.update({
      where: { id: issueId },
      data: {
        reviewStatus: requestedStatus as "OPEN" | "COMPLETED" | "FALSE_POSITIVE",
        reviewedAt: requestedStatus === "OPEN" ? null : new Date(),
      },
      select: {
        id: true,
        reviewStatus: true,
        reviewedAt: true,
      },
    });

    res.json({
      id: updated.id,
      reviewStatus: updated.reviewStatus,
      reviewedAt: updated.reviewedAt ? updated.reviewedAt.toISOString() : null,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to update issue review status" });
  }
});

router.get("/me/stats", authenticateToken, async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;

  try {
    const userWhere = { userAccountId: auth.userId };

    const [
      totalReports,
      completedReports,
      processingReports,
      passedReports,
      failedReports,
      issuesAggregate,
    ] = await Promise.all([
      prisma.report.count({
        where: userWhere,
      }),
      prisma.report.count({
        where: {
          ...userWhere,
          status: "COMPLETED",
        },
      }),
      prisma.report.count({
        where: {
          ...userWhere,
          status: "PROCESSING",
        },
      }),
      prisma.report.count({
        where: {
          ...userWhere,
          status: "COMPLETED",
          passedQC: true,
        },
      }),
      prisma.report.count({
        where: {
          ...userWhere,
          status: "COMPLETED",
          passedQC: false,
        },
      }),
      prisma.report.aggregate({
        where: {
          ...userWhere,
          status: "COMPLETED",
        },
        _sum: {
          totalIssues: true,
        },
      }),
    ]);

    const totalIssues = issuesAggregate._sum.totalIssues ?? 0;
    const passRate =
      completedReports > 0 ? Math.round((passedReports / completedReports) * 10000) / 100 : 0;

    res.json({
      totalReports,
      completedReports,
      failedReports,
      processingReports,
      totalIssues,
      passRate,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to fetch user report stats" });
  }
});

router.get("/me/recent", authenticateToken, async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;

  try {
    const reports = await prisma.report.findMany({
      where: { userAccountId: auth.userId },
      orderBy: { uploadedAt: "desc" },
      take: 5,
      select: {
        id: true,
        fileName: true,
        uploadedAt: true,
        status: true,
        passedQC: true,
        totalIssues: true,
      },
    });

    const recentReports = reports.map((report) => ({
      id: report.id,
      fileName: report.fileName,
      uploadDate: report.uploadedAt.toISOString(),
      status:
        report.status === "COMPLETED"
          ? report.passedQC
            ? "passed"
            : "failed"
          : "processing",
      issuesFound: report.totalIssues,
    }));

    res.json(recentReports);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to fetch recent user reports" });
  }
});

router.get("/", authenticateToken, async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const search = typeof req.query.search === "string" ? req.query.search.toLowerCase() : "";

  try {
    const where: Record<string, unknown> = {};
    if (auth.role !== "ADMIN") {
      where.userAccountId = auth.userId;
    }
    if (status && ["processing", "passed", "failed"].includes(status)) {
      if (status === "processing") {
        where.status = "PROCESSING";
      } else {
        where.status = "COMPLETED";
        where.passedQC = status === "passed";
      }
    }
    if (search) {
      where.OR = [
        { fileName: { contains: search, mode: "insensitive" } },
        { id: { contains: search, mode: "insensitive" } },
      ];
    }

    const reports = await prisma.report.findMany({
      where,
      orderBy: { uploadedAt: "desc" },
      include: {
        userAccount: { select: { id: true, email: true } },
        issues: { select: { reviewStatus: true } },
      },
    });

    const list = reports.map(
      (r: {
        id: string;
        fileName: string;
        uploadedAt: Date;
        userAccount: { id: number; email: string } | null;
        status: string;
        passedQC: boolean | null;
        totalIssues: number;
        tagStatus: number;
        issues: Array<{ reviewStatus: "OPEN" | "COMPLETED" | "FALSE_POSITIVE" }>;
      }) => {
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

        // Older reports may not have an explicit tag, so expose them as "No Tag".
        return {
          id: r.id,
          fileName: r.fileName,
          uploadDate: r.uploadedAt.toISOString(),
          analyst: r.userAccount?.email ?? "???",
          analystUserId: r.userAccount?.id ?? null,
          status: r.status === "COMPLETED" ? (r.passedQC ? "passed" : "failed") : "processing",
          issuesFound: r.totalIssues,
          openIssues,
          completedIssues,
          falsePositiveIssues,
          reviewStatus,
          tagStatus: r.tagStatus ?? 0,
        };
      },
    );

    res.json(list);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to fetch reports" });
  }
});

router.get("/:id", authenticateToken, async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const reportId = String(req.params.id);
  const mailAvailability = getMailServiceAvailability();

  try {
    const report = await prisma.report.findFirst({
      where: { id: reportId, ...(auth.role !== "ADMIN" ? { userAccountId: auth.userId } : {}) },
      include: { issues: true, userAccount: { select: { email: true } } },
    });

    if (!report) {
      res.status(404).json({ message: "Report not found" });
      return;
    }

    const typeLabel = (t: string) =>
      t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    res.json({
      id: report.id,
      fileName: report.fileName,
      status: report.status,
      uploadedAt: report.uploadedAt,
      analyzedAt: report.analyzedAt,
      processingTimeSeconds: report.processingTimeSeconds,
      totalIssues: report.totalIssues,
      passedQC: report.passedQC,
      analyst: report.userAccount?.email ?? "—",
      sharingAvailable: mailAvailability.available,
      sharingUnavailableReason: mailAvailability.available ? null : mailAvailability.reason ?? null,
      issues: report.issues.map(
        (i: {
          id: string;
          type: string;
          description: string;
          location: string;
          context: string;
          suggestion: string;
          pageNumber: number | null;
          reviewStatus: string;
          reviewedAt: Date | null;
        }) => ({
          id: i.id,
          type: typeLabel(i.type),
          description: i.description,
          location: i.location,
          context: i.context,
          suggestion: i.suggestion,
          pageNumber: i.pageNumber,
          reviewStatus: i.reviewStatus,
          reviewedAt: i.reviewedAt ? i.reviewedAt.toISOString() : null,
        }),
      ),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to fetch report" });
  }
});

router.post("/", authenticateToken, async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const { fileName, fileSizeBytes } = req.body ?? {};

  if (!fileName) {
    res.status(400).json({ message: "fileName required" });
    return;
  }

  try {
    const report = await prisma.report.create({
      data: {
        fileName: String(fileName),
        fileSizeBytes: fileSizeBytes != null ? Number(fileSizeBytes) : null,
        status: "PROCESSING",
        userAccountId: auth.userId,
      },
    });

    res.status(201).json({ id: report.id, fileName: report.fileName, status: report.status });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to create report" });
  }
});

router.patch("/:id/complete", authenticateToken, async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const reportId = String(req.params.id);
  const { issues, processingTimeSeconds } = req.body ?? {};

  try {
    const report = await prisma.report.findFirst({
      where: { id: reportId, userAccountId: auth.userId },
    });

    if (!report) {
      res.status(404).json({ message: "Report not found" });
      return;
    }

    const issueList = Array.isArray(issues) ? issues : [];

    const typeMap: Record<string, string> = {
      "Template Artifact": "TEMPLATE_ARTIFACT",
      "Unremoved Guidance": "UNREMOVED_GUIDANCE",
      "Missing Information": "MISSING_INFORMATION",
      Contradiction: "CONTRADICTION",
      "Limitation Contradiction": "LIMITATION_CONTRADICTION",
      "Incomplete Limitations": "INCOMPLETE_LIMITATIONS",
    };

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.issue.deleteMany({ where: { reportId } });

      for (const i of issueList) {
        const type = typeMap[i.type] || "MISSING_INFORMATION";

        await tx.issue.create({
          data: {
            reportId,
            type: type as
              | "TEMPLATE_ARTIFACT"
              | "UNREMOVED_GUIDANCE"
              | "MISSING_INFORMATION"
              | "CONTRADICTION"
              | "LIMITATION_CONTRADICTION"
              | "INCOMPLETE_LIMITATIONS",
            description: i.description || "",
            location: i.location || "",
            context: i.context || "",
            suggestion: i.suggestion || "",
            pageNumber: i.pageNumber ?? null,
          },
        });
      }

      const total = issueList.length;
      const passedQC = total === 0;

      await tx.report.update({
        where: { id: reportId },
        data: {
          status: "COMPLETED",
          analyzedAt: new Date(),
          processingTimeSeconds: processingTimeSeconds != null ? Number(processingTimeSeconds) : null,
          totalIssues: total,
          passedQC,
        },
      });
    });

    const updated = await prisma.report.findUnique({
      where: { id: reportId },
      include: { issues: true },
    });

    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to complete report" });
  }
});

export default router;

