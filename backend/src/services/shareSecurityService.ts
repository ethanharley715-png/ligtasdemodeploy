import { ApiError } from "../errors/apiError";

export type ShareTarget = "report_export" | "weekly_digest";

type EnforceShareRateLimitOptions = {
  now?: Date;
  maxPerWindow?: number;
  windowMs?: number;
};

type ShareAuditEvent = {
  target: ShareTarget;
  actorUserId: number;
  actorRole?: string;
  recipientEmail: string;
  fileName?: string;
  success: boolean;
  detail?: string;
};

const DEFAULT_WINDOW_MS = 60 * 60 * 1000;
const DEFAULT_MAX_PER_WINDOW = 10;
const shareAttempts = new Map<string, number[]>();

function parseMaxPerWindow(): number {
  const parsed = Number(process.env.EMAIL_SHARE_MAX_PER_HOUR ?? "");
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  return DEFAULT_MAX_PER_WINDOW;
}

function buildKey(actorUserId: number, target: ShareTarget): string {
  return `${target}:${actorUserId}`;
}

function maskEmail(email: string): string {
  const [localPart, domain = ""] = email.split("@");
  const prefix = localPart.slice(0, 1) || "*";
  return `${prefix}***@${domain || "unknown"}`;
}

export function clearShareRateLimitState(): void {
  shareAttempts.clear();
}

export function enforceShareRateLimit(
  params: { actorUserId: number; target: ShareTarget },
  options?: EnforceShareRateLimitOptions,
): void {
  const now = options?.now ?? new Date();
  const windowMs = options?.windowMs ?? DEFAULT_WINDOW_MS;
  const maxPerWindow = options?.maxPerWindow ?? parseMaxPerWindow();
  const key = buildKey(params.actorUserId, params.target);
  const windowStart = now.getTime() - windowMs;
  const existing = (shareAttempts.get(key) ?? []).filter((timestamp) => timestamp > windowStart);

  if (existing.length >= maxPerWindow) {
    shareAttempts.set(key, existing);
    throw new ApiError(429, "rate_limited", "Too many email share requests. Please try again later.");
  }

  existing.push(now.getTime());
  shareAttempts.set(key, existing);
}

export function logShareAuditEvent(event: ShareAuditEvent): void {
  console.info("[audit] email_share", {
    target: event.target,
    actorUserId: event.actorUserId,
    actorRole: event.actorRole ?? null,
    recipient: maskEmail(event.recipientEmail),
    fileName: event.fileName ?? null,
    success: event.success,
    detail: event.detail ?? null,
  });
}
