/**
 * passwordResetRateLimitService.ts
 * Author: Abdulaziz Albaiji
 *
 * In-memory rate limiter for password-reset email dispatches (AC8).
 *
 * Limits each email address to at most 3 reset emails per rolling 1-hour window.
 * Timestamps are stored in a Map keyed by normalised email; entries older than
 * the window are pruned on every read so memory stays bounded.
 *
 * NOTE: This state is process-local. A server restart resets all limits.
 * For multi-instance deployments, replace the Map with a shared store (e.g. Redis).
 */

/** Length of the rate-limit window: 1 hour in milliseconds. */
const WINDOW_MS = 60 * 60 * 1000;

/** Maximum number of reset emails allowed per email address per window. */
const MAX_RESET_EMAILS_PER_EMAIL_PER_WINDOW = 3;

/** In-memory store mapping normalised email → array of dispatch timestamps. */
const sendTimestampsByEmail = new Map<string, number[]>();

/** Normalise an email address to a consistent map key (trim + lowercase). */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Removes timestamps that fall outside the current rolling window and
 * returns the still-valid ones.  The map is updated in place as a side-effect.
 */
function pruneAndGetTimestamps(key: string, nowMs: number): number[] {
  const existing = sendTimestampsByEmail.get(key);
  const cutoff = nowMs - WINDOW_MS;
  const pruned = (existing ?? []).filter((t) => t > cutoff);
  sendTimestampsByEmail.set(key, pruned);
  return pruned;
}

/** Clears all rate-limit state — used in tests to reset between test cases. */
export function clearPasswordResetEmailRateLimitState(): void {
  sendTimestampsByEmail.clear();
}

/**
 * AC8: at most three password-reset emails per account email per rolling hour.
 * Only counts dispatches (caller records when a reset email is actually sent).
 *
 * @returns true if the email address has already hit the limit and should be blocked.
 */
export function isPasswordResetEmailRateLimited(email: string, nowMs: number = Date.now()): boolean {
  const key = normalizeEmail(email);
  const pruned = pruneAndGetTimestamps(key, nowMs);
  return pruned.length >= MAX_RESET_EMAILS_PER_EMAIL_PER_WINDOW;
}

/**
 * Records that a reset email was successfully dispatched to this address.
 * Must be called by the caller after a confirmed send, not speculatively.
 */
export function recordPasswordResetEmailDispatched(email: string, nowMs: number = Date.now()): void {
  const key = normalizeEmail(email);
  const pruned = pruneAndGetTimestamps(key, nowMs);
  pruned.push(nowMs);
  sendTimestampsByEmail.set(key, pruned);
}

/**
 * Calculates how many seconds the caller must wait before the oldest
 * timestamp in the window drops out and a new email becomes allowed.
 * Returns 0 if the email is not currently rate-limited.
 */
export function getPasswordResetEmailRateLimitRetryAfterSeconds(
  email: string,
  nowMs: number = Date.now(),
): number {
  const key = normalizeEmail(email);
  const pruned = pruneAndGetTimestamps(key, nowMs);
  if (pruned.length < MAX_RESET_EMAILS_PER_EMAIL_PER_WINDOW) {
    return 0;
  }
  const oldest = pruned[0];
  if (oldest === undefined) {
    return 3600;
  }
  // Time until the oldest timestamp falls outside the window.
  return Math.max(1, Math.ceil((oldest + WINDOW_MS - nowMs) / 1000));
}
