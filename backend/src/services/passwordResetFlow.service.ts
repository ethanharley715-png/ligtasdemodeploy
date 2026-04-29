/**
 * passwordResetFlow.service.ts
 * Author: Abdulaziz Albaiji
 *
 * Contains the two core operations of the password-reset flow:
 *
 *  validatePasswordResetPlainToken — verifies that a token from the reset link
 *    is still valid (exists in the DB and has not expired). Used by the frontend
 *    to gate the "set new password" form before the user types anything.
 *
 *  resetPasswordWithPlainToken — re-validates the token, hashes the new password,
 *    updates the user record, and invalidates the token so it cannot be reused.
 *
 * Both functions are intentionally stateless; all state lives in the database.
 */

import { prisma } from "../db/prisma";
import { ApiError } from "../errors/apiError";
import { hashPasswordWithUsername, verifyPassword } from "../utils/passwordHasher";
import { hashPasswordResetToken } from "../utils/passwordResetToken";

/** Return type for token validation — communicates success or the reason for failure. */
export type PasswordResetTokenValidation = {
  valid: boolean;
  message?: string;
};

/**
 * Validates the raw token from the reset link: hash match, user row exists, not expired (AC5).
 */
/**
 * Validates the raw (plain-text) token extracted from the password-reset URL.
 * Hashes the token with SHA-256 before querying the DB so the stored value
 * is never exposed in plain text (AC5).
 *
 * @returns { valid: true } if the token matches a non-expired user record.
 * @returns { valid: false, message } otherwise, with a user-safe error message.
 */
export async function validatePasswordResetPlainToken(plainToken: string): Promise<PasswordResetTokenValidation> {
  const trimmed = plainToken?.trim();
  if (!trimmed) {
    return { valid: false, message: "Reset link is missing a token." };
  }

  // Hash the token before the DB lookup — tokens are never stored in plain text.
  const tokenHash = hashPasswordResetToken(trimmed);
  const now = new Date();

  // Only consider tokens that exist AND have not yet expired.
  const user = await prisma.userAccount.findFirst({
    where: {
      reset_token_hash: tokenHash,
      reset_token_expires_at: { gt: now },
    },
    select: { id: true },
  });

  if (!user) {
    return { valid: false, message: "This reset link is invalid or has expired." };
  }

  return { valid: true };
}

/**
 * AC6: Re-validates token integrity and expiry, hashes the new password with the same
 * application hasher as login/change-password (PBKDF2 via `hashPasswordWithUsername`),
 * clears reset token fields (invalidates the reset link), and returns the account email
 * for security audit logging.
 */
export async function resetPasswordWithPlainToken(params: {
  plainToken: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<{ email: string }> {
  const plainToken = params.plainToken?.trim();
  const newPassword = params.newPassword;
  const confirmPassword = params.confirmPassword;

  // Guard: token must be present.
  if (!plainToken) {
    throw new ApiError(400, "invalid_request", "Reset token is required.");
  }

  // Guard: both password fields must be strings.
  if (typeof newPassword !== "string" || typeof confirmPassword !== "string") {
    throw new ApiError(400, "invalid_request", "New password and confirmation are required.");
  }

  // Enforce minimum password length (8 characters).
  if (newPassword.length < 8) {
    throw new ApiError(400, "invalid_request", "New password must be at least 8 characters long.");
  }

  // Both fields must match before we apply the change.
  if (newPassword !== confirmPassword) {
    throw new ApiError(400, "invalid_request", "New password and confirmation do not match.");
  }

  // Hash the token before the DB lookup — never compare plain tokens directly.
  const tokenHash = hashPasswordResetToken(plainToken);
  const now = new Date();

  // Re-validate the token (it could have expired between the preview step and submission).
  const user = await prisma.userAccount.findFirst({
    where: {
      reset_token_hash: tokenHash,
      reset_token_expires_at: { gt: now },
    },
  });

  if (!user) {
    throw new ApiError(400, "invalid_request", "This reset link is invalid or has expired.");
  }

  // Prevent users from resetting to their existing password.
  if (verifyPassword(user.email, newPassword, user.password_hash)) {
    throw new ApiError(400, "invalid_request", "New password must be different from your current password.");
  }

  // Hash the new password using the same PBKDF2 hasher as login.
  const newHash = hashPasswordWithUsername(user.email, newPassword);

  // Persist the new password hash and clear the reset token fields
  // so the link cannot be used again (one-time use).
  await prisma.userAccount.update({
    where: { id: user.id },
    data: {
      password_hash: newHash,
      reset_token_hash: null,
      reset_token_expires_at: null,
    },
  });

  // Return the email so the caller can log a security audit event.
  return { email: user.email };
}
