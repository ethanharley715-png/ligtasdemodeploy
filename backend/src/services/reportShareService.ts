import { ApiError } from "../errors/apiError";
import { createMailService, type MailService } from "./mailService";
import { exportReportAsCsv, exportReportAsPdf } from "./reportExportService";
import { enforceShareRateLimit, logShareAuditEvent } from "./shareSecurityService";

type ShareActor = {
  userAccountId: number;
  role: string;
  email?: string;
};

export type ShareReportFormat = "csv" | "pdf";

type ShareResult = {
  recipientEmail: string;
  format: ShareReportFormat;
  fileName: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(value: string): boolean {
  return emailPattern.test(value);
}

function buildShareSubject(fileName: string, reportId: string): string {
  return `QC Results Export - ${fileName} (${reportId})`;
}

function buildShareBody(params: {
  reportId: string;
  fileName: string;
  senderEmail?: string;
  message?: string;
}): string {
  const lines = [
    "QC results export attached.",
    "",
    `Report ID: ${params.reportId}`,
    `Report File: ${params.fileName}`,
  ];

  if (params.senderEmail) {
    lines.push(`Shared by: ${params.senderEmail}`);
  }

  if (params.message) {
    lines.push("", "Sender note:", params.message);
  }

  lines.push("", "This export is intended for remediation and record-keeping.");

  return lines.join("\n");
}

export async function shareReportExport(params: {
  reportId: string;
  format: ShareReportFormat;
  recipientEmail: string;
  actor: ShareActor;
  message?: string;
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
    // Rate limiting and audit logging wrap the export send so sharing remains traceable.
    enforceShareRateLimit({
      actorUserId: params.actor.userAccountId,
      target: "report_export",
    });

    const exportFile = params.format === "csv"
      ? await exportReportAsCsv(params.reportId, params.actor)
      : await exportReportAsPdf(params.reportId, params.actor);

    await mailService.send({
      to: recipientEmail,
      subject: buildShareSubject(exportFile.fileName, params.reportId),
      text: buildShareBody({
        reportId: params.reportId,
        fileName: exportFile.fileName,
        senderEmail: params.actor.email,
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
      target: "report_export",
      actorUserId: params.actor.userAccountId,
      actorRole: params.actor.role,
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
      target: "report_export",
      actorUserId: params.actor.userAccountId,
      actorRole: params.actor.role,
      recipientEmail,
      success: false,
      detail: error instanceof ApiError ? error.code : "share_failed",
    });

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(502, "share_failed", "Failed to send the report export email.");
  }
}
