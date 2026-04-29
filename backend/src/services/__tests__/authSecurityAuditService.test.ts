import {
  clearAuthSecurityAuditEvents,
  listRecentAuthSecurityEvents,
  recordAuthSecurityEvent,
} from "../authSecurityAuditService";

describe("authSecurityAuditService", () => {
  beforeEach(() => {
    clearAuthSecurityAuditEvents();
    delete process.env.AUTH_AUDIT_EVENT_LIMIT;
  });

  it("masks sensitive identifiers in logged audit events", () => {
    recordAuthSecurityEvent({
      eventType: "login_failed",
      outcome: "failed",
      actorUserId: 1,
      actorRole: "ADMIN",
      actorEmail: "admin@ligtas.com",
      targetEmail: "target@example.com",
      sourceIp: "127.0.0.1",
      route: "POST /api/logins/login",
      detail: "Invalid email or password.",
      retryAfterSeconds: null,
      captchaRequired: false,
    });

    const [event] = listRecentAuthSecurityEvents();
    expect(event.actorEmail).toBe("a***@ligtas.com");
    expect(event.targetEmail).toBe("t***@example.com");
    expect(event.sourceIp).toBe("127.*.*.1");
  });

  it("keeps only the most recent bounded event window", () => {
    process.env.AUTH_AUDIT_EVENT_LIMIT = "2";

    recordAuthSecurityEvent({
      eventType: "login_failed",
      outcome: "failed",
      actorUserId: null,
      actorRole: null,
      actorEmail: null,
      targetEmail: "first@example.com",
      sourceIp: "127.0.0.1",
      route: "POST /api/logins/login",
      detail: "First",
      retryAfterSeconds: null,
      captchaRequired: false,
      occurredAt: new Date("2026-04-07T10:00:00.000Z"),
    });
    recordAuthSecurityEvent({
      eventType: "login_failed",
      outcome: "failed",
      actorUserId: null,
      actorRole: null,
      actorEmail: null,
      targetEmail: "second@example.com",
      sourceIp: "127.0.0.2",
      route: "POST /api/logins/login",
      detail: "Second",
      retryAfterSeconds: null,
      captchaRequired: false,
      occurredAt: new Date("2026-04-07T10:01:00.000Z"),
    });
    recordAuthSecurityEvent({
      eventType: "login_success",
      outcome: "success",
      actorUserId: 1,
      actorRole: "ADMIN",
      actorEmail: "admin@ligtas.com",
      targetEmail: "admin@ligtas.com",
      sourceIp: "127.0.0.3",
      route: "POST /api/logins/login",
      detail: "Third",
      retryAfterSeconds: null,
      captchaRequired: false,
      occurredAt: new Date("2026-04-07T10:02:00.000Z"),
    });

    const events = listRecentAuthSecurityEvents();
    expect(events).toHaveLength(2);
    expect(events[0].detail).toBe("Third");
    expect(events[1].detail).toBe("Second");
  });
});
