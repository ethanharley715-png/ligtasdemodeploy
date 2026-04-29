import { prisma } from "../db/prisma";
import {
  generatePasswordResetPlainToken,
  hashPasswordResetToken,
  passwordResetExpiresAt,
} from "../utils/passwordResetToken";

export type IssuedPasswordResetToken = {
  plainToken: string;
  expiresAt: Date;
};

/**
 * Creates a cryptographically random reset token, stores only its SHA-256 hash
 * on the user row with a 15-minute expiry. Returns the one-time plain token
 * for inclusion in a reset link or email (never persist the plain value).
 */
export async function issuePasswordResetTokenForUser(userId: number): Promise<IssuedPasswordResetToken> {
  const plainToken = generatePasswordResetPlainToken();
  const tokenHash = hashPasswordResetToken(plainToken);
  const expiresAt = passwordResetExpiresAt();

  await prisma.userAccount.update({
    where: { id: userId },
    data: {
      reset_token_hash: tokenHash,
      reset_token_expires_at: expiresAt,
    },
  });

  return { plainToken, expiresAt };
}
