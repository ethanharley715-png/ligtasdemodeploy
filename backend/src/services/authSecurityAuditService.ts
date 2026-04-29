import { getAuthAuditEventLimit } from "../config/authConfig";

export type AuthSecurityEventType =
  | "login_failed"
  | "login_lockout"
  | "login_captcha_required"
  | "login_success"
  | "logout"
  | "audit_view_access"
  | "password_reset_email_sent"
  | "password_reset_completed"
  | "password_reset_rate_limited"
  | "password_reset_forgot_no_dispatch"
  |  "password_reset_token_rejected"
  |  "mfa_success"
  | "mfa_failed"
  | "login_mfa_required"

    ;

export type AuthSecurityEventOutcome = "failed" | "blocked" | "success" | "viewed" | "pending";

export interface AuthSecurityAuditEvent {
  id: string;
  occurredAt: string;
  eventType: AuthSecurityEventType;
  outcome: AuthSecurityEventOutcome;
  actorUserId: number | null;
  actorRole: string | null;
  actorEmail: string | null;
  targetEmail: string | null;
  sourceIp: string | null;
  route: string | null;
  detail: string | null;
  retryAfterSeconds: number | null;
  captchaRequired: boolean;
}

type AuthSecurityAuditInput = Omit<AuthSecurityAuditEvent, "id" | "occurredAt"> & {
  occurredAt?: Date;
};

const recentEvents: AuthSecurityAuditEvent[] = [];

function maskEmail(email: string | null | undefined): string | null {
  const trimmed = email?.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  const [localPart, domain = "unknown"] = trimmed.split("@");
  const visible = localPart.slice(0, 1) || "*";
  return `${visible}***@${domain}`;
}

function maskIp(ipAddress: string | null | undefined): string | null {
  const trimmed = ipAddress?.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.includes(":")) {
    if (trimmed === "::1") {
      return "127.*.*.1";
    }
    const segments = trimmed.split(":").filter(Boolean);
    if (segments.length === 0) {
      return "*";
    }
    return `${segments[0]}:*:*:${segments[segments.length - 1]}`;
  }

  const octets = trimmed.split(".");
  if (octets.length !== 4) {
    return trimmed;
  }

  return `${octets[0]}.*.*.${octets[3]}`;
}

function buildEventId(now: Date): string {
  return `auth-${now.getTime()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function clearAuthSecurityAuditEvents(): void {
  recentEvents.length = 0;
}

export function recordAuthSecurityEvent(input: AuthSecurityAuditInput): AuthSecurityAuditEvent {
  const occurredAt = input.occurredAt ?? new Date();
  const event: AuthSecurityAuditEvent = {
    id: buildEventId(occurredAt),
    occurredAt: occurredAt.toISOString(),
    eventType: input.eventType,
    outcome: input.outcome,
    actorUserId: input.actorUserId ?? null,
    actorRole: input.actorRole ?? null,
    actorEmail: maskEmail(input.actorEmail),
    targetEmail: maskEmail(input.targetEmail),
    sourceIp: maskIp(input.sourceIp),
    route: input.route ?? null,
    detail: input.detail ?? null,
    retryAfterSeconds: input.retryAfterSeconds ?? null,
    captchaRequired: Boolean(input.captchaRequired),
  };

  recentEvents.unshift(event);
  recentEvents.splice(getAuthAuditEventLimit());

  console.info("[audit] auth_security", event);

  return event;
}

export function listRecentAuthSecurityEvents(limit?: number): AuthSecurityAuditEvent[] {
  const boundedLimit = Number.isInteger(limit) && limit && limit > 0 ? limit : getAuthAuditEventLimit();
  return recentEvents.slice(0, boundedLimit);
}
