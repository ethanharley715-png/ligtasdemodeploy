/**
 * passwordResetToken.ts
 * Author: Abdulaziz Albaiji
 *
 * Pure utility functions for generating and validating password-reset tokens.
 *
 * Tokens are issued as cryptographically random base64url strings (32 bytes → 43 chars).
 * Only a SHA-256 hash of the token is stored in the database; the plain-text token
 * is delivered to the user via email and never persisted, preventing DB leaks from
 * exposing usable tokens.
 *
 * Token lifetime is 15 minutes (AC2).
 */

import crypto from "node:crypto";

/** Token time-to-live: 15 minutes, as required by acceptance criterion AC2. */
export const PASSWORD_RESET_TOKEN_TTL_MS = 15 * 60 * 1000;

/** Number of random bytes used to generate each token (gives 256 bits of entropy). */
const TOKEN_BYTE_LENGTH = 32;

/**
 * Generates a cryptographically secure, URL-safe token string.
 * The token is returned in plain text and must be emailed to the user —
 * only its hash should be persisted.
 */
export function generatePasswordResetPlainToken(): string {
  return crypto.randomBytes(TOKEN_BYTE_LENGTH).toString("base64url");
}

/**
 * Hashes a plain-text reset token with SHA-256.
 * The hash is stored in the DB; the original is never saved server-side.
 *
 * @param plainToken - The raw token from the reset link query string.
 * @returns Hex-encoded SHA-256 hash suitable for DB storage and comparison.
 */
export function hashPasswordResetToken(plainToken: string): string {
  return crypto.createHash("sha256").update(plainToken, "utf8").digest("hex");
}

/**
 * Calculates the expiry timestamp for a new reset token.
 *
 * @param fromMs - Base time in ms (defaults to now); useful for deterministic tests.
 * @returns A Date that is PASSWORD_RESET_TOKEN_TTL_MS in the future.
 */
export function passwordResetExpiresAt(fromMs: number = Date.now()): Date {
  return new Date(fromMs + PASSWORD_RESET_TOKEN_TTL_MS);
}

/**
 * Checks whether a stored token expiry date has passed.
 * Returns true (expired) if expiresAt is null/undefined — treats missing expiry as expired.
 *
 * @param expiresAt - The expiry date stored alongside the token hash in the DB.
 * @param nowMs     - Current time in ms (defaults to Date.now()); injectable for tests.
 */
export function isPasswordResetTokenExpired(expiresAt: Date | null | undefined, nowMs: number = Date.now()): boolean {
  if (!expiresAt) {
    // No expiry date means the token record is malformed — treat as expired.
    return true;
  }
  return expiresAt.getTime() <= nowMs;
}
