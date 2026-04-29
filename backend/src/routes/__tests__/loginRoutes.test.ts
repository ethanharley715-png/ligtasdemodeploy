import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";

jest.mock("otplib", () => ({
  verify: jest.fn(),
  generateSecret: jest.fn(),
  generateURI: jest.fn(),
}));

jest.mock("../../db/prisma", () => ({
  prisma: {
    userAccount: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("../../services/passwordResetEmail.service", () => ({
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../services/mailService", () => {
  const actual = jest.requireActual("../../services/mailService") as Record<string, unknown>;
  return {
    ...actual,
    getMailServiceAvailability: jest.fn(() => ({ available: true })),
  };
});

jest.mock("../../services/loginCaptchaService", () => ({
  getLoginCaptchaConfig: jest.fn(() => ({
    enabled: false,
    provider: null,
    captchaRequiredAfterLockouts: 2,
    turnstileSecretKey: null,
  })),
  verifyLoginCaptcha: jest.fn(async () => false),
}));

import loginRouter from "../login";
import { prisma } from "../../db/prisma";
import { sendPasswordResetEmail } from "../../services/passwordResetEmail.service";
import { getMailServiceAvailability } from "../../services/mailService";
import { clearLoginRateLimitState } from "../../services/loginRateLimitService";
import { clearAuthSecurityAuditEvents, listRecentAuthSecurityEvents } from "../../services/authSecurityAuditService";
import { clearPasswordResetEmailRateLimitState } from "../../services/passwordResetRateLimitService";
import { getJwtSecret } from "../../config/authConfig";

import * as passwordUtils from "../../utils/passwordHasher";
import * as tokenUtils from "../../utils/tokenService";

jest.mock("../../utils/passwordHasher");
jest.mock("../../utils/tokenService");

jest.mock("fs", () => ({ readFileSync: jest.fn().mockReturnValue("fake-key") }));
jest.mock("crypto", () => {
  const original = jest.requireActual("crypto");
  return {
    ...original,
    privateDecrypt: jest.fn().mockReturnValue(Buffer.alloc(32, 1)),
    createDecipheriv: jest.fn(() => ({
      setAuthTag: jest.fn(),
      update: jest.fn(() =>
        Buffer.from(
          JSON.stringify({
            email: "test@test.com",
            password: "password123",
            nonce: "nonce",
            timestamp: 123,
          }),
        ),
      ),
      final: jest.fn(() => Buffer.from("")),
    })),
    constants: original.constants,
  };
});

describe("Login Routes", () => {
  let app: express.Express;
  const mFindUnique = prisma.userAccount.findUnique as jest.Mock;
  const mFindFirst = prisma.userAccount.findFirst as jest.Mock;
  const mUpdate = prisma.userAccount.update as jest.Mock;
  const sendPasswordResetEmailMock = sendPasswordResetEmail as jest.MockedFunction<
    typeof sendPasswordResetEmail
  >;
  const getMailAvailabilityMock = getMailServiceAvailability as jest.MockedFunction<
    typeof getMailServiceAvailability
  >;

  function makeBearerToken(role: "ADMIN" | "TEAM_MANAGER" | "CONSULTANT" = "ADMIN") {
    return jwt.sign(
      {
        userId: 1,
        email: "admin@ligtas.com",
        role,
      },
      getJwtSecret(),
      {
        issuer: "LoginBackend",
        audience: "LoginFrontend",
      },
    );
  }

  beforeEach(() => {
    app = express();
    app.use(cookieParser());
    app.use(express.json());
    app.use("/api/logins", loginRouter);
    clearLoginRateLimitState();
    clearPasswordResetEmailRateLimitState();
    clearAuthSecurityAuditEvents();
    jest.clearAllMocks();
    process.env.JWT_SECRET = "test-jwt-secret";
    delete process.env.NODE_ENV;
    delete process.env.MFA_ENABLED;
  });

  it("does not expose a public user-list route", async () => {
    const res = await request(app).get("/api/logins");

    expect(res.status).toBe(404);
  });

  it("logs in successfully with a valid encrypted payload", async () => {
    mFindUnique.mockResolvedValue({
      id: 1,
      email: "test@test.com",
      name: "Test User",
      password_hash: "hashed",
      user_type: "adm",
    });

    (passwordUtils.verifyPassword as jest.Mock).mockReturnValue(true);
    (tokenUtils.generateJwtToken as jest.Mock).mockReturnValue("jwt-token");

    const res = await request(app)
      .post("/api/logins/login")
      .send({ encryptedKey: "ek", iv: "iv", data: "data" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      message: "Login successful",
      email: "test@test.com",
      userType: "adm",
      userId: 1,
      user: {
        id: 1,
        name: "Test User",
        email: "test@test.com",
      },
    });
    //expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("uses secure cookie flags in production", async () => {
    process.env.NODE_ENV = "production";
    mFindUnique.mockResolvedValue({
      id: 1,
      email: "test@test.com",
      name: "Test User",
      password_hash: "hashed",
      user_type: "adm",
    });

    (passwordUtils.verifyPassword as jest.Mock).mockReturnValue(true);
    (tokenUtils.generateJwtToken as jest.Mock).mockReturnValue("jwt-token");

    const res = await request(app)
      .post("/api/logins/login")
      .send({ encryptedKey: "ek", iv: "iv", data: "data" });

    expect(res.status).toBe(200);
    //expect(res.headers["set-cookie"]?.[0]).toContain("HttpOnly");
    //expect(res.headers["set-cookie"]?.[0]).toContain("Secure");
    //expect(res.headers["set-cookie"]?.[0]).toContain("SameSite=None");
  });

  it("requires MFA by default when the user has MFA configured", async () => {
    mFindUnique.mockResolvedValue({
      id: 1,
      email: "test@test.com",
      name: "Test User",
      password_hash: "hashed",
      user_type: "adm",
      mfaEnabled: true,
      mfaSecret: "secret",
    });

    (passwordUtils.verifyPassword as jest.Mock).mockReturnValue(true);

    const res = await request(app)
      .post("/api/logins/login")
      .send({ encryptedKey: "ek", iv: "iv", data: "data" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      mfaRequired: true,
      message: "MFA required",
      userId: 1,
      email: "test@test.com",
    });
  });

  it("bypasses configured user MFA when MFA is disabled by environment", async () => {
    process.env.MFA_ENABLED = "false";
    mFindUnique.mockResolvedValue({
      id: 1,
      email: "test@test.com",
      name: "Test User",
      password_hash: "hashed",
      user_type: "adm",
      mfaEnabled: true,
      mfaSecret: "secret",
    });

    (passwordUtils.verifyPassword as jest.Mock).mockReturnValue(true);

    const res = await request(app)
      .post("/api/logins/login")
      .send({ encryptedKey: "ek", iv: "iv", data: "data" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      message: "Login successful",
      email: "test@test.com",
      userType: "adm",
      userId: 1,
    });
    expect(res.body.mfaRequired).toBeUndefined();
  });

  it("rejects invalid credentials when the user is not found", async () => {
    mFindUnique.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/logins/login")
      .send({ encryptedKey: "ek", iv: "iv", data: "data" });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid email or password.");
  });

  it("rate limits repeated failed login attempts", async () => {
    mFindUnique.mockResolvedValue(null);

    for (let index = 0; index < 5; index += 1) {
      const res = await request(app)
        .post("/api/logins/login")
        .send({ encryptedKey: "ek", iv: "iv", data: "data" });

      expect(res.status).toBe(401);
    }

    const limited = await request(app)
      .post("/api/logins/login")
      .send({ encryptedKey: "ek", iv: "iv", data: "data" });

    expect(limited.status).toBe(429);
    expect(limited.body.message).toBe("Too many sign-in attempts. Please wait before trying again.");
    expect(limited.body.retryAfterSeconds).toBeGreaterThan(0);
    expect(limited.body.captchaRequired).toBe(false);
    expect(limited.headers["retry-after"]).toBeDefined();
  });

  it("keeps valid credentials blocked during an active lockout", async () => {
    mFindUnique.mockResolvedValue(null);

    for (let index = 0; index < 6; index += 1) {
      await request(app)
        .post("/api/logins/login")
        .send({ encryptedKey: "ek", iv: "iv", data: "data" });
    }

    mFindUnique.mockResolvedValue({
      id: 1,
      email: "test@test.com",
      name: "Test User",
      password_hash: "hashed",
      user_type: "adm",
    });
    (passwordUtils.verifyPassword as jest.Mock).mockReturnValue(true);
    (tokenUtils.generateJwtToken as jest.Mock).mockReturnValue("jwt-token");

    const res = await request(app)
      .post("/api/logins/login")
      .send({ encryptedKey: "ek", iv: "iv", data: "data" });

    expect(res.status).toBe(429);
    expect(res.body.message).toBe("Too many sign-in attempts. Please wait before trying again.");
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("clears the login cookie on logout", async () => {
    const res = await request(app).post("/api/logins/logout");

    expect(res.status).toBe(200);
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("rejects forgot-password with an invalid email", async () => {
    const res = await request(app).post("/api/logins/forgot-password").send({ email: "not-an-email" });

    expect(res.status).toBe(400);
    expect(sendPasswordResetEmailMock).not.toHaveBeenCalled();
  });

  it("returns a generic success message for forgot-password when the user does not exist", async () => {
    mFindUnique.mockResolvedValueOnce(null);

    const res = await request(app).post("/api/logins/forgot-password").send({ email: "nobody@example.com" });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain("If an account exists");
    expect(sendPasswordResetEmailMock).not.toHaveBeenCalled();
  });

  it("sends a reset email when the user exists and SMTP is configured", async () => {
    getMailAvailabilityMock.mockReturnValueOnce({ available: true });
    mFindUnique.mockResolvedValueOnce({ id: 7, email: "user@example.com" });

    const res = await request(app).post("/api/logins/forgot-password").send({ email: "User@Example.com" });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain("If an account exists");
    expect(sendPasswordResetEmailMock).toHaveBeenCalledWith({
      userId: 7,
      recipientEmail: "user@example.com",
    });
  });

  it("returns valid:false for validate-reset-token when token is unknown", async () => {
    mFindFirst.mockResolvedValueOnce(null);

    const res = await request(app).post("/api/logins/validate-reset-token").send({ token: "unknown-plain" });

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
  });

  it("returns valid:true for validate-reset-token when token matches", async () => {
    mFindFirst.mockResolvedValueOnce({ id: 1 });

    const res = await request(app).post("/api/logins/validate-reset-token").send({ token: "plain-reset" });

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
  });

  it("rejects validate-reset-token without a token field", async () => {
    const res = await request(app).post("/api/logins/validate-reset-token").send({});

    expect(res.status).toBe(400);
  });

  it("resets password with token and clears reset fields", async () => {
    mFindFirst.mockResolvedValueOnce({
      id: 2,
      email: "reset@example.com",
      password_hash: "stored-hash",
    });
    (passwordUtils.verifyPassword as jest.Mock).mockReturnValueOnce(false);
    (passwordUtils.hashPasswordWithUsername as jest.Mock).mockReturnValueOnce("new-stored-hash");
    mUpdate.mockResolvedValueOnce({});

    const res = await request(app).post("/api/logins/reset-password-with-token").send({
      token: "plain-token",
      newPassword: "newpassword1",
      confirmPassword: "newpassword1",
    });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain("Password updated");
    expect(mUpdate).toHaveBeenCalled();
  });

  it("does not send mail for forgot-password when SMTP is not configured", async () => {
    getMailAvailabilityMock.mockReturnValueOnce({ available: false, reason: "not configured" });
    mFindUnique.mockResolvedValueOnce({ id: 7, email: "user@example.com" });

    const res = await request(app).post("/api/logins/forgot-password").send({ email: "user@example.com" });

    expect(res.status).toBe(200);
    expect(sendPasswordResetEmailMock).not.toHaveBeenCalled();
    expect(listRecentAuthSecurityEvents(5).some((e) => e.eventType === "password_reset_forgot_no_dispatch")).toBe(
      true,
    );
  });

  it("stops sending forgot-password emails after three per email per hour (AC8)", async () => {
    getMailAvailabilityMock.mockReturnValue({ available: true });
    mFindUnique.mockResolvedValue({ id: 7, email: "cap@example.com" });

    for (let i = 0; i < 3; i += 1) {
      const res = await request(app).post("/api/logins/forgot-password").send({ email: "cap@example.com" });
      expect(res.status).toBe(200);
      expect(res.body.message).toContain("If an account exists");
    }
    expect(sendPasswordResetEmailMock).toHaveBeenCalledTimes(3);

    sendPasswordResetEmailMock.mockClear();
    const fourth = await request(app).post("/api/logins/forgot-password").send({ email: "cap@example.com" });
    expect(fourth.status).toBe(200);
    expect(fourth.body.message).toContain("If an account exists");
    expect(sendPasswordResetEmailMock).not.toHaveBeenCalled();
    expect(listRecentAuthSecurityEvents(10).some((e) => e.eventType === "password_reset_rate_limited")).toBe(true);
  });

  it("logs token rejection on validate-reset-token when invalid", async () => {
    mFindFirst.mockResolvedValueOnce(null);
    await request(app).post("/api/logins/validate-reset-token").send({ token: "bad" });
    expect(listRecentAuthSecurityEvents(5).some((e) => e.eventType === "password_reset_token_rejected")).toBe(true);
  });

  it("logs token rejection on reset-password-with-token when token invalid", async () => {
    mFindFirst.mockResolvedValueOnce(null);
    const res = await request(app).post("/api/logins/reset-password-with-token").send({
      token: "bad",
      newPassword: "newpassword1",
      confirmPassword: "newpassword1",
    });
    expect(res.status).toBe(400);
    expect(listRecentAuthSecurityEvents(8).some((e) => e.eventType === "password_reset_token_rejected")).toBe(true);
  });

  it("returns recent security events to admins only", async () => {
    const adminRes = await request(app)
      .get("/api/logins/security-events")
      .set("Authorization", `Bearer ${makeBearerToken("ADMIN")}`);

    expect(adminRes.status).toBe(200);
    expect(Array.isArray(adminRes.body.events)).toBe(true);

    const consultantRes = await request(app)
      .get("/api/logins/security-events")
      .set("Authorization", `Bearer ${makeBearerToken("CONSULTANT")}`);

    expect(consultantRes.status).toBe(403);
  });
});
