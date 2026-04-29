import { ApiError } from "../errors/apiError";
import { createMailService, type MailService } from "./mailService";
import { enforceShareRateLimit, logShareAuditEvent } from "./shareSecurityService";
import { exportWeeklyDigestAsCsv, exportWeeklyDigestAsPdf } from "./weeklyDigestExportService";
import { parseWeeklyDigestParams, type WeeklyDigestRequest } from "./weeklyDigestService";

export type WeeklyDigestShareFormat = "csv" | "pdf";

type ShareResult = {
  recipientEmail: string;
  format: WeeklyDigestShareFormat;
  fileName: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(value: string): boolean {
  return emailPattern.test(value);
}

function buildShareSubject(weekStartIso: string, weekEndIso: string): string {
  return `Weekly QC Digest - ${weekStartIso} to ${weekEndIso}`;
}

function buildShareBody(params: {
  weekStartIso: string;
  weekEndIso: string;
  consultantId?: number;
  issueType?: string;
  senderEmail?: string;
  message?: string;
}): string {
  const lines = [
    "Weekly QC digest attached.",
    "",
    `Week: ${params.weekStartIso} to ${params.weekEndIso}`,
    `Consultant filter: ${params.consultantId != null ? params.consultantId : "All consultants"}`,
    `Issue filter: ${params.issueType ?? "All issue categories"}`,
  ];

  if (params.senderEmail) {
    lines.push(`Shared by: ${params.senderEmail}`);
  }

  if (params.message) {
    lines.push("", "Sender note:", params.message);
  }

  lines.push("", "This digest is intended for weekly quality-control review and follow-up.");

  return lines.join("\n");
}

export async function shareWeeklyDigest(params: WeeklyDigestRequest & {
  format: WeeklyDigestShareFormat;
  recipientEmail: string;
  actorUserId: number;
  message?: string;
  senderEmail?: string;
  senderRole?: string;
  mailService?: MailService;
}): Promise<ShareResult> {
  const recipientEmail = params.recipientEmail.trim().toLowerCase();

  if (!isValidEmail(recipientEmail)) {
    throw new ApiError(400, "invalid_request", "recipientEmail must be a valid email address.");
  }

  const message = params.message?.trim();

  if (message && message.length > 1000) {
    throw new ApiError(400, "invalid_request", "message must be 1000 characters or fewer.");
  }

  const mailService = params.mailService ?? createMailService();

  try {
    enforceShareRateLimit({
      actorUserId: params.actorUserId,
      target: "weekly_digest",
    });

    const digestParams = parseWeeklyDigestParams({
      weekStart: params.weekStart,
      ...(params.consultantId ? { consultantId: params.consultantId } : {}),
      ...(params.issueType ? { issueType: params.issueType } : {}),
    });

    const exportFile = params.format === "csv"
      ? await exportWeeklyDigestAsCsv({
          weekStart: params.weekStart,
          ...(params.consultantId ? { consultantId: params.consultantId } : {}),
          ...(params.issueType ? { issueType: params.issueType } : {}),
        })
      : await exportWeeklyDigestAsPdf({
          weekStart: params.weekStart,
          ...(params.consultantId ? { consultantId: params.consultantId } : {}),
          ...(params.issueType ? { issueType: params.issueType } : {}),
        });

    await mailService.send({
      to: recipientEmail,
      subject: buildShareSubject(digestParams.weekStartIso, digestParams.weekEndIso),
      text: buildShareBody({
        weekStartIso: digestParams.weekStartIso,
        weekEndIso: digestParams.weekEndIso,
        consultantId: digestParams.consultantId,
        issueType: digestParams.issueType,
        senderEmail: params.senderEmail,
        message,
      }),
      attachments: [
        {
          filename: exportFile.fileName,
          contentType: exportFile.contentType,
          content: exportFile.buffer,
        },
      ],
    });

    logShareAuditEvent({
      target: "weekly_digest",
      actorUserId: params.actorUserId,
      actorRole: params.senderRole,
      recipientEmail,
      fileName: exportFile.fileName,
      success: true,
    });

    return {
      recipientEmail,
      format: params.format,
      fileName: exportFile.fileName,
    };
  } catch (error) {
    logShareAuditEvent({
      target: "weekly_digest",
      actorUserId: params.actorUserId,
      actorRole: params.senderRole,
      recipientEmail,
      success: false,
      detail: error instanceof ApiError ? error.code : "share_failed",
    });

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(502, "share_failed", "Failed to send the weekly digest email.");
  }
}
