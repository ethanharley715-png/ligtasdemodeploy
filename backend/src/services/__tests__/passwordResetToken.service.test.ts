import crypto from "node:crypto";
import { prisma } from "../../db/prisma";
import { issuePasswordResetTokenForUser } from "../passwordResetToken.service";

jest.mock("../../db/prisma", () => ({
  prisma: {
    userAccount: {
      update: jest.fn(),
    },
  },
}));

describe("passwordResetToken.service", () => {
  const prismaMock = prisma as unknown as {
    userAccount: { update: jest.Mock };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("stores SHA-256 hash and 15-minute expiry on the user", async () => {
    prismaMock.userAccount.update.mockResolvedValueOnce({} as never);

    const result = await issuePasswordResetTokenForUser(42);

    expect(prismaMock.userAccount.update).toHaveBeenCalledTimes(1);
    const call = prismaMock.userAccount.update.mock.calls[0][0];
    expect(call.where).toEqual({ id: 42 });
    expect(call.data.reset_token_expires_at).toBeInstanceOf(Date);
    const ttlMs = (call.data.reset_token_expires_at as Date).getTime() - Date.now();
    expect(ttlMs).toBeGreaterThan(14 * 60 * 1000);
    expect(ttlMs).toBeLessThanOrEqual(15 * 60 * 1000 + 2000);

    const hash = call.data.reset_token_hash as string;
    expect(hash).toMatch(/^[a-f0-9]{64}$/);

    expect(result.plainToken).toBeTruthy();
    expect(result.plainToken).not.toBe(hash);
    const expectedHash = crypto.createHash("sha256").update(result.plainToken, "utf8").digest("hex");
    expect(hash).toBe(expectedHash);
  });
});
