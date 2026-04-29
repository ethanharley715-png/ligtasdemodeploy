import { ApiError } from "../../errors/apiError";
import {
  clearShareRateLimitState,
  enforceShareRateLimit,
  logShareAuditEvent,
} from "../shareSecurityService";

describe("shareSecurityService", () => {
  beforeEach(() => {
    clearShareRateLimitState();
    jest.restoreAllMocks();
  });

  it("rate limits repeated share attempts within the configured window", () => {
    const now = new Date("2026-03-23T10:00:00.000Z");

    enforceShareRateLimit(
      { actorUserId: 7, target: "report_export" },
      { now, maxPerWindow: 2, windowMs: 60_000 },
    );
    enforceShareRateLimit(
      { actorUserId: 7, target: "report_export" },
      { now: new Date("2026-03-23T10:00:10.000Z"), maxPerWindow: 2, windowMs: 60_000 },
    );

    expect(() =>
      enforceShareRateLimit(
        { actorUserId: 7, target: "report_export" },
        { now: new Date("2026-03-23T10:00:20.000Z"), maxPerWindow: 2, windowMs: 60_000 },
      ),
    ).toThrow(ApiError);
  });

  it("logs masked audit data without exposing the full recipient email", () => {
    const infoSpy = jest.spyOn(console, "info").mockImplementation(() => {});

    logShareAuditEvent({
      target: "weekly_digest",
      actorUserId: 11,
      actorRole: "ADMIN",
      recipientEmail: "reviewer@example.com",
      fileName: "qc-weekly-digest.pdf",
      success: true,
    });

    expect(infoSpy).toHaveBeenCalledWith("[audit] email_share", {
      target: "weekly_digest",
      actorUserId: 11,
      actorRole: "ADMIN",
      recipient: "r***@example.com",
      fileName: "qc-weekly-digest.pdf",
      success: true,
      detail: null,
    });
  });
});
