/**
 * passwordResetConfig.ts
 * Author: Abdulaziz Albaiji
 *
 * Configuration helpers for building the password-reset deep link.
 *
 * The reset link must point to the frontend SPA, not the API server,
 * because the user clicks it in their email client and the browser
 * must load the React app to show the "set new password" form.
 *
 * URL resolution priority:
 *  1. PASSWORD_RESET_FRONTEND_URL  (explicit override — recommended for prod)
 *  2. FRONTEND_URL                 (general frontend base URL)
 *  3. First entry in ALLOWED_ORIGINS (typically http://localhost:5173 in dev)
 */

import { getAllowedOrigins } from "./origins";

/**
 * Returns the base URL of the SPA (no trailing slash), used to build password reset links.
 * Prefer PASSWORD_RESET_FRONTEND_URL or FRONTEND_URL in production.
 * Falls back to the first ALLOWED_ORIGINS entry (often http://localhost:5173).
 */
export function getPasswordResetFrontendBaseUrl(): string {
  const explicit =
    process.env.PASSWORD_RESET_FRONTEND_URL?.trim() || process.env.FRONTEND_URL?.trim();
  if (explicit) {
    // Strip any trailing slash so we can safely append the path below.
    return explicit.replace(/\/$/, "");
  }
  const [first] = getAllowedOrigins();
  return (first ?? "http://localhost:5173").replace(/\/$/, "");
}

/**
 * Builds the full one-time password-reset URL that is embedded in the email.
 * The plain token is URL-encoded to handle base64url characters safely in query strings.
 *
 * Example: https://app.ligtas.com/reset-password?token=abc123...
 *
 * @param plainToken - The raw reset token (not hashed) to include in the URL.
 */
export function buildPasswordResetUrl(plainToken: string): string {
  const base = getPasswordResetFrontendBaseUrl();
  const token = encodeURIComponent(plainToken);
  return `${base}/reset-password?token=${token}`;
}
