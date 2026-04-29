/**
 * passwordResetEmail.service.ts
 * Author: Abdulaziz Albaiji
 *
 * Orchestrates the full "forgot password" email dispatch:
 *  1. Issues a new one-time reset token for the user and stores its hash in the DB.
 *  2. Builds the reset URL that will be embedded in the email.
 *  3. Renders the email (plain-text + HTML) via the template helper.
 *  4. Delivers the email through whichever mail provider is configured.
 *
 * This service is intentionally thin — it delegates each concern to a
 * dedicated module so each step can be tested independently.
 */

import { buildPasswordResetUrl } from "../config/passwordResetConfig";
import { createMailService } from "./mailService";
import { buildPasswordResetEmailParts } from "./passwordResetEmailTemplate";
import { issuePasswordResetTokenForUser } from "./passwordResetToken.service";

/**
 * Issues a fresh reset token for the user, persists its hash, and emails the
 * one-time link immediately (same request — typically arrives well under 3 minutes).
 *
 * @param params.userId        - Database ID of the user requesting a password reset.
 * @param params.recipientEmail - The email address to deliver the reset link to.
 */
export async function sendPasswordResetEmail(params: {
  userId: number;
  recipientEmail: string;
}): Promise<void> {
  // Step 1: generate a cryptographically random token and persist its SHA-256 hash.
  const { plainToken } = await issuePasswordResetTokenForUser(params.userId);

  // Step 2: build the full reset URL that the user will click in the email.
  const resetUrl = buildPasswordResetUrl(plainToken);

  // Step 3: select the configured mail provider (Resend or SMTP).
  const mailService = createMailService();

  // Step 4: render the email body (both plain-text and HTML variants).
  const { subject, html, text } = buildPasswordResetEmailParts(resetUrl);

  // Step 5: deliver the email; normalise the recipient address to lowercase.
  await mailService.send({
    to: params.recipientEmail.trim().toLowerCase(),
    subject,
    text,
    html,
  });
}
