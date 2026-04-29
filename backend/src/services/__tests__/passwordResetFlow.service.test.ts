import { prisma } from "../../db/prisma";
import { hashPasswordResetToken } from "../../utils/passwordResetToken";
import * as passwordHasher from "../../utils/passwordHasher";
import { resetPasswordWithPlainToken, validatePasswordResetPlainToken } from "../passwordResetFlow.service";

jest.mock("../../db/prisma", () => ({
  prisma: {
    userAccount: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));

describe("passwordResetFlow.service", () => {
  const prismaMock = prisma as unknown as {
    userAccount: { findFirst: jest.Mock; update: jest.Mock };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("validatePasswordResetPlainToken", () => {
    it("rejects empty token", async () => {
      const r = await validatePasswordResetPlainToken("  ");
      expect(r.valid).toBe(false);
      expect(prismaMock.userAccount.findFirst).not.toHaveBeenCalled();
    });

    it("rejects when no matching non-expired row", async () => {
      prismaMock.userAccount.findFirst.mockResolvedValueOnce(null);
      const r = await validatePasswordResetPlainToken("some-token");
      expect(r.valid).toBe(false);
      expect(r.message).toBeDefined();
    });

    it("accepts when user row matches hash and expiry", async () => {
      prismaMock.userAccount.findFirst.mockResolvedValueOnce({ id: 9 });
      const r = await validatePasswordResetPlainToken("good-token");
      expect(r.valid).toBe(true);
      const where = prismaMock.userAccount.findFirst.mock.calls[0][0].where;
      expect(where.reset_token_hash).toBe(hashPasswordResetToken("good-token"));
      expect(where.reset_token_expires_at.gt).toBeInstanceOf(Date);
    });
  });

  describe("resetPasswordWithPlainToken", () => {
    it("throws when token row missing", async () => {
      prismaMock.userAccount.findFirst.mockResolvedValueOnce(null);
      await expect(
        resetPasswordWithPlainToken({
          plainToken: "t",
          newPassword: "longenough1",
          confirmPassword: "longenough1",
        }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it("updates password and clears reset fields", async () => {
      prismaMock.userAccount.findFirst.mockResolvedValueOnce({
        id: 3,
        email: "user@example.com",
        password_hash: "old-hash",
      });
      jest.spyOn(passwordHasher, "verifyPassword").mockReturnValueOnce(false);
      jest.spyOn(passwordHasher, "hashPasswordWithUsername").mockReturnValueOnce("new-hash");

      await resetPasswordWithPlainToken({
        plainToken: "reset-plain",
        newPassword: "newpassword1",
        confirmPassword: "newpassword1",
      });

      expect(prismaMock.userAccount.update).toHaveBeenCalledWith({
        where: { id: 3 },
        data: {
          password_hash: "new-hash",
          reset_token_hash: null,
          reset_token_expires_at: null,
        },
      });

      jest.restoreAllMocks();
    });
  });
});
