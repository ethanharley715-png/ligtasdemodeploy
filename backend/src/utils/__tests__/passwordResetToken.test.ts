import {
  PASSWORD_RESET_TOKEN_TTL_MS,
  generatePasswordResetPlainToken,
  hashPasswordResetToken,
  isPasswordResetTokenExpired,
  passwordResetExpiresAt,
} from "../passwordResetToken";

describe("passwordResetToken", () => {
  it("uses a 15-minute TTL constant", () => {
    expect(PASSWORD_RESET_TOKEN_TTL_MS).toBe(15 * 60 * 1000);
  });

  it("generates URL-safe tokens of stable length (32 bytes → base64url)", () => {
    const a = generatePasswordResetPlainToken();
    const b = generatePasswordResetPlainToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(40);
    expect(/^[A-Za-z0-9_-]+$/.test(a)).toBe(true);
  });

  it("hashes tokens to hex SHA-256", () => {
    const plain = "test-token";
    const h = hashPasswordResetToken(plain);
    expect(h).toMatch(/^[a-f0-9]{64}$/);
    expect(hashPasswordResetToken(plain)).toBe(h);
    expect(hashPasswordResetToken("other")).not.toBe(h);
  });

  it("computes expiry ~15 minutes after reference time", () => {
    const base = 1_700_000_000_000;
    const exp = passwordResetExpiresAt(base);
    expect(exp.getTime()).toBe(base + PASSWORD_RESET_TOKEN_TTL_MS);
  });

  it("detects expired tokens", () => {
    const past = new Date(Date.now() - 1000);
    const future = new Date(Date.now() + 60_000);
    expect(isPasswordResetTokenExpired(past)).toBe(true);
    expect(isPasswordResetTokenExpired(future)).toBe(false);
    expect(isPasswordResetTokenExpired(null)).toBe(true);
    expect(isPasswordResetTokenExpired(undefined)).toBe(true);
  });
});
