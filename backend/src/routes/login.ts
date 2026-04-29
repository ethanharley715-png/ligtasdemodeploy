/**
 * src/routes/login.ts
 * Author: Abdulaziz Albaiji
 *
 * Authentication routes for the Ligtas backend.
 *
 * Routes implemented here:
 *  POST   /login                    - Decrypt and verify credentials; issue JWT.
 *  POST   /mfa/verify               - Verify a TOTP code after password step.
 *  GET    /security-events          - Admin-only: view recent auth audit events.
 *  POST   /forgot-password          - Trigger a password-reset email (rate limited).
 *  POST   /validate-reset-token     - Check whether a reset token is still valid.
 *  POST   /reset-password-with-token - Apply a new password using a valid reset token.
 *  GET    /me                       - Decode the current session cookie and return user info.
 *  PATCH  /change-password          - Authenticated password change (current + new).
 *  POST   /logout                   - Clear the auth cookie and record a logout event.
 *  POST   /dev/mfa/generate         - Dev-only: enrol a user in MFA and return a QR code.
 *
 * Login payloads are RSA+AES-GCM encrypted by the frontend before transmission,
 * so plaintext credentials never appear on the wire.
 */
import { NextFunction, Router, Request, Response } from "express";
import crypto from "crypto";
import fs from "fs";
import jwt from "jsonwebtoken";
import { generateJwtToken } from "../utils/tokenService";
import { verifyPassword, hashPasswordWithUsername } from "../utils/passwordHasher";
import { ApiError } from "../errors/apiError";
import { prisma } from "../db/prisma";
import {
  AUTH_COOKIE_NAME,
  getAuthCookieOptions,
  getClearAuthCookieOptions,
  getJwtSecret,
  isMfaEnabled,
} from "../config/authConfig";
import { authenticateToken, AuthPayload, requireAdmin } from "../middleware/auth";
import {
  assertLoginAttemptAllowed,
  clearFailedLoginAttempts,
  LoginProtectionError,
  recordFailedLoginAttempt,
} from "../services/loginRateLimitService";
import { getLoginCaptchaConfig, verifyLoginCaptcha } from "../services/loginCaptchaService";
import {
  listRecentAuthSecurityEvents,
  recordAuthSecurityEvent,
} from "../services/authSecurityAuditService";
import { getMailServiceAvailability } from "../services/mailService";
import {
  getPasswordResetEmailRateLimitRetryAfterSeconds,
  isPasswordResetEmailRateLimited,
  recordPasswordResetEmailDispatched,
} from "../services/passwordResetRateLimitService";
import { sendPasswordResetEmail } from "../services/passwordResetEmail.service";
import {
  resetPasswordWithPlainToken,
  validatePasswordResetPlainToken,
} from "../services/passwordResetFlow.service";
import { verify } from "otplib";

//--------------------------------------------
import { generateSecret, generateURI } from "otplib";
import QRCode from "qrcode";
//--------------------------------------------

const router = Router();

/** Basic email format check used to validate forgot-password submissions quickly. */
const forgotPasswordEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Shape of the decrypted login payload sent by the frontend. */
interface LoginRequest {
  email: string;
  password: string;
  nonce: string;
  timestamp: number;
}

/**
 * Shape of the encrypted envelope that arrives from the frontend.
 * The frontend encrypts the AES key with the server's RSA public key and
 * encrypts the login payload with that AES key (AES-256-GCM).
 */
interface EncryptedPayload {
  encryptedKey: string; // RSA-OAEP encrypted AES key (base64)
  iv: string;           // AES-GCM initialisation vector (base64)
  data: string;         // AES-GCM ciphertext + auth tag (base64)
}

/** Reads the RSA private key from disk used to decrypt login payloads. */
function loadPrivateKey(): string {
  return fs.readFileSync("private_keys/private_key.pem", "utf8");
}

/**
 * Decrypts an encrypted login payload using hybrid RSA+AES-GCM encryption.
 *
 * Steps:
 *  1. Decrypt the AES key from `encryptedKey` using the RSA private key (OAEP-SHA256).
 *  2. Separate the last 16 bytes of `data` as the GCM auth tag.
 *  3. Decrypt the ciphertext using AES-256-GCM and verify the auth tag.
 *  4. Parse and return the JSON login payload.
 *
 * Throws if the payload is tampered with or the key is invalid.
 */
function decryptPayload(payload: EncryptedPayload): LoginRequest {
  const privateKey = loadPrivateKey();

  // Step 1: unwrap the AES-256 key using RSA-OAEP with SHA-256.
  const aesKey = crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(payload.encryptedKey, "base64"),
  );

  const iv = Buffer.from(payload.iv, "base64");
  const encryptedData = Buffer.from(payload.data, "base64");

  // Step 2: the last 16 bytes are the GCM authentication tag.
  const ciphertext = encryptedData.subarray(0, encryptedData.length - 16);
  const tag = encryptedData.subarray(encryptedData.length - 16);

  // Step 3: decrypt and authenticate the ciphertext.
  const decipher = crypto.createDecipheriv("aes-256-gcm", aesKey, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  // Step 4: parse the JSON login payload.
  return JSON.parse(decrypted.toString("utf8")) as LoginRequest;
}

/**
 * Handles a LoginProtectionError thrown by the rate-limiter.
 * Records a lockout/captcha security event and sends a 429 response.
 *
 * @returns true if the error was a LoginProtectionError and a response was sent;
 *          false if the error is something else and the caller should rethrow.
 */
function handleLoginProtectionResponse(
  error: unknown,
  res: Response,
  context: { ipAddress: string; email?: string; actorUserId?: number; actorRole?: string; actorEmail?: string },
): boolean {
  if (error instanceof LoginProtectionError) {
    recordAuthSecurityEvent({
      eventType:
        error.captchaRequired && error.retryAfterSeconds === 0
          ? "login_captcha_required"
          : "login_lockout",
      outcome: "blocked",
      actorUserId: context.actorUserId ?? null,
      actorRole: context.actorRole ?? null,
      actorEmail: context.actorEmail ?? null,
      targetEmail: context.email ?? null,
      sourceIp: context.ipAddress,
      route: "POST /api/logins/login",
      detail: error.message,
      retryAfterSeconds: error.retryAfterSeconds,
      captchaRequired: error.captchaRequired,
    });
    if (error.retryAfterSeconds > 0) {
      res.setHeader("Retry-After", String(error.retryAfterSeconds));
    }
    res.status(429).json({
      message: error.message,
      retryAfterSeconds: error.retryAfterSeconds,
      captchaRequired: error.captchaRequired,
    });
    return true;
  }

  return false;
}

router.post("/login", async (req: Request, res: Response) => {
  const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
  const captchaToken = typeof req.body?.captchaToken === "string" ? req.body.captchaToken : undefined;
  const captchaConfig = getLoginCaptchaConfig();
  const payload = req.body as EncryptedPayload;

  if (!payload?.encryptedKey || !payload?.iv || !payload?.data) {
    return res.status(400).json({ message: "Invalid request. Encrypted payload required." });
  }

  try {
    assertLoginAttemptAllowed(
      { ipAddress },
      {
        captchaEnabled: captchaConfig.enabled,
        captchaRequiredAfterLockouts: captchaConfig.captchaRequiredAfterLockouts,
      },
    );
  } catch (error) {
    if (handleLoginProtectionResponse(error, res, { ipAddress })) {
      return;
    }
    throw error;
  }

  let request: LoginRequest;
  try {
    request = decryptPayload(payload);
  } catch {
    recordAuthSecurityEvent({
      eventType: "login_failed",
      outcome: "failed",
      actorUserId: null,
      actorRole: null,
      actorEmail: null,
      targetEmail: null,
      sourceIp: ipAddress,
      route: "POST /api/logins/login",
      detail: "Invalid encrypted login payload.",
      retryAfterSeconds: null,
      captchaRequired: false,
    });
    try {
      recordFailedLoginAttempt(
        { ipAddress },
        {
          captchaEnabled: captchaConfig.enabled,
          captchaRequiredAfterLockouts: captchaConfig.captchaRequiredAfterLockouts,
        },
      );
    } catch (error) {
      if (handleLoginProtectionResponse(error, res, { ipAddress })) {
        return;
      }
    }
    return res.status(401).json({ message: "Authentication failed." });
  }

  try {
    const captchaVerified = captchaConfig.enabled
      ? await verifyLoginCaptcha(captchaToken, ipAddress)
      : false;

    assertLoginAttemptAllowed(
      { ipAddress, email: request.email },
      {
        captchaEnabled: captchaConfig.enabled,
        captchaRequiredAfterLockouts: captchaConfig.captchaRequiredAfterLockouts,
        captchaVerified,
      },
    );

    const user = await prisma.userAccount.findUnique({
      where: { email: request.email.toLowerCase() },
    });

    if (!user) {
      recordAuthSecurityEvent({
        eventType: "login_failed",
        outcome: "failed",
        actorUserId: null,
        actorRole: null,
        actorEmail: null,
        targetEmail: request.email,
        sourceIp: ipAddress,
        route: "POST /api/logins/login",
        detail: "Invalid email or password.",
        retryAfterSeconds: null,
        captchaRequired: false,
      });
      try {
        recordFailedLoginAttempt(
          { ipAddress, email: request.email },
          {
            captchaEnabled: captchaConfig.enabled,
            captchaRequiredAfterLockouts: captchaConfig.captchaRequiredAfterLockouts,
          },
        );
      } catch (error) {
        if (handleLoginProtectionResponse(error, res, { ipAddress, email: request.email })) {
          return;
        }
        throw error;
      }
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const isValid = verifyPassword(request.email, request.password, user.password_hash);

    if (!isValid) {
      recordAuthSecurityEvent({
        eventType: "login_failed",
        outcome: "failed",
        actorUserId: user.id,
        actorRole: user.user_type,
        actorEmail: user.email,
        targetEmail: request.email,
        sourceIp: ipAddress,
        route: "POST /api/logins/login",
        detail: "Invalid email or password.",
        retryAfterSeconds: null,
        captchaRequired: false,
      });
      try {
        recordFailedLoginAttempt(
          { ipAddress, email: request.email },
          {
            captchaEnabled: captchaConfig.enabled,
            captchaRequiredAfterLockouts: captchaConfig.captchaRequiredAfterLockouts,
          },
        );
      } catch (error) {
        if (handleLoginProtectionResponse(error, res, { ipAddress, email: request.email })) {
          return;
        }
        throw error;
      }
      return res.status(401).json({ message: "Invalid email or password." });
    }

      clearFailedLoginAttempts({ ipAddress, email: request.email });

      
      if (isMfaEnabled() && user.mfaEnabled && user.mfaSecret) {
          recordAuthSecurityEvent({
              eventType: "login_mfa_required",
              outcome: "pending",
              actorUserId: user.id,
              actorRole: user.user_type,
              actorEmail: user.email,
              targetEmail: user.email,
              sourceIp: ipAddress,
              route: "POST /api/logins/login",
              detail: "MFA required after password validation.",
              retryAfterSeconds: null,
              captchaRequired: false,
          });

          return res.json({
              mfaRequired: true,
              message: "MFA required",
              userId: user.id,
              email: user.email,
          });
      }
      
      console.log(user.id);

      // ✅ NORMAL LOGIN (no MFA)
      const token = generateJwtToken(user.id, user.email, user.user_type);

      res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());

      recordAuthSecurityEvent({
          eventType: "login_success",
          outcome: "success",
          actorUserId: user.id,
          actorRole: user.user_type,
          actorEmail: user.email,
          targetEmail: user.email,
          sourceIp: ipAddress,
          route: "POST /api/logins/login",
          detail: "User signed in successfully.",
          retryAfterSeconds: null,
          captchaRequired: false,
      });

      return res.json({
          message: "Login successful",
          email: user.email,
          userType: user.user_type,
          userId: user.id,
          user: {
              id: user.id,
              name: user.name,
              email: user.email,
          },
      });
  } catch (error) {
    if (handleLoginProtectionResponse(error, res, { ipAddress, email: request.email })) {
      return;
    }
    console.error(error);
    return res.status(500).json({ message: "Server error." });
  }
});
router.post("/mfa/verify", async (req: Request, res: Response) => {
    const { userId, token } = req.body ?? {};
    const ipAddress = req.ip || req.socket.remoteAddress || "unknown";

    if (!isMfaEnabled()) {
        return res.status(404).json({ message: "MFA is disabled" });
    }

    if (!userId || !token) {
        return res.status(400).json({ message: "UserId and token required" });
    }

    try {
        const user = await prisma.userAccount.findUnique({
            where: { id: Number(userId) },
        });

        if (!user || !user.mfaEnabled || !user.mfaSecret) {
            return res.status(401).json({ message: "MFA not configured" });
        }

        // ⏱ same window as C# (±60s)


        const result = await verify({
            secret: user.mfaSecret!,
            token,
        });

        const isValid = result.valid;

        if (!isValid) {
            recordAuthSecurityEvent({
                eventType: "mfa_failed",
                outcome: "failed",
                actorUserId: user.id,
                actorRole: user.user_type,
                actorEmail: user.email,
                targetEmail: user.email,
                sourceIp: ipAddress,
                route: "POST /api/logins/mfa/verify",
                detail: "Invalid MFA code.",
                retryAfterSeconds: null,
                captchaRequired: false,
            });

            return res.status(400).json({ message: "Invalid MFA code" });
        }

        // SUCCESS → issue JWT
        const jwtToken = generateJwtToken(user.id, user.email, user.user_type);

        res.cookie(AUTH_COOKIE_NAME, jwtToken, getAuthCookieOptions());

        recordAuthSecurityEvent({
            eventType: "mfa_success",
            outcome: "success",
            actorUserId: user.id,
            actorRole: user.user_type,
            actorEmail: user.email,
            targetEmail: user.email,
            sourceIp: ipAddress,
            route: "POST /api/logins/mfa/verify",
            detail: "MFA verification successful.",
            retryAfterSeconds: null,
            captchaRequired: false,
        });

        return res.json({
            message: "Login successful",
            email: user.email,
            userType: user.user_type,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
            },
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Server error" });
    }
});

router.get("/security-events", authenticateToken, requireAdmin, (req: Request, res: Response) => {
  const auth = (req as Request & { user?: AuthPayload }).user;

  recordAuthSecurityEvent({
    eventType: "audit_view_access",
    outcome: "viewed",
    actorUserId: auth?.userId ?? null,
    actorRole: auth?.role ?? null,
    actorEmail: auth?.email ?? null,
    targetEmail: null,
    sourceIp: req.ip || req.socket.remoteAddress || "unknown",
    route: "GET /api/logins/security-events",
    detail: "Recent security events viewed.",
    retryAfterSeconds: null,
    captchaRequired: false,
  });

  res.json({
    events: listRecentAuthSecurityEvents(),
  });
});

router.post("/forgot-password", async (req: Request, res: Response) => {
  const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
  const emailRaw = req.body?.email;

  const genericMessage =
    "If an account exists with this email, you will receive password reset instructions shortly.";

  if (typeof emailRaw !== "string" || !forgotPasswordEmailPattern.test(emailRaw.trim())) {
    return res.status(400).json({ message: "Please provide a valid email address." });
  }

  const email = emailRaw.trim().toLowerCase();

  try {
    if (isPasswordResetEmailRateLimited(email)) {
      recordAuthSecurityEvent({
        eventType: "password_reset_rate_limited",
        outcome: "blocked",
        actorUserId: null,
        actorRole: null,
        actorEmail: null,
        targetEmail: email,
        sourceIp: ipAddress,
        route: "POST /api/logins/forgot-password",
        detail: "Forgot-password rate limit exceeded (max 3 reset emails per email per hour).",
        retryAfterSeconds: getPasswordResetEmailRateLimitRetryAfterSeconds(email),
        captchaRequired: false,
      });
      return res.json({ message: genericMessage });
    }

    const user = await prisma.userAccount.findUnique({
      where: { email },
      select: { id: true, email: true },
    });

    const mailOk = getMailServiceAvailability().available;

    if (user && mailOk) {
      await sendPasswordResetEmail({ userId: user.id, recipientEmail: user.email });
      recordPasswordResetEmailDispatched(email);
      recordAuthSecurityEvent({
        eventType: "password_reset_email_sent",
        outcome: "success",
        actorUserId: null,
        actorRole: null,
        actorEmail: null,
        targetEmail: email,
        sourceIp: ipAddress,
        route: "POST /api/logins/forgot-password",
        detail: "Password reset email dispatched.",
        retryAfterSeconds: null,
        captchaRequired: false,
      });
    } else {
      recordAuthSecurityEvent({
        eventType: "password_reset_forgot_no_dispatch",
        outcome: "success",
        actorUserId: null,
        actorRole: null,
        actorEmail: null,
        targetEmail: email,
        sourceIp: ipAddress,
        route: "POST /api/logins/forgot-password",
        detail: user
          ? "Reset email not sent (mail transport unavailable)."
          : "Forgot-password submitted; no reset email sent (no matching account).",
        retryAfterSeconds: null,
        captchaRequired: false,
      });
      if (user && !mailOk) {
        console.warn("[forgot-password] Email not configured (Resend or SMTP); reset email not sent for existing user.");
      }
    }
  } catch (err) {
    if (err instanceof ApiError && err.message.toLowerCase().includes("only send testing")) {
      console.error(
        "[forgot-password] Resend test mode: with onboarding@resend.dev you may only send to your Resend signup email until you verify a domain. See https://resend.com/domains — or request a reset for that same email.",
      );
    }
    console.error("[forgot-password] unexpected error:", err);
  }

  return res.json({ message: genericMessage });
});

router.post("/validate-reset-token", async (req: Request, res: Response) => {
  const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
  const raw = req.body?.token;
  if (typeof raw !== "string") {
    return res.status(400).json({ valid: false, message: "Reset token is required." });
  }

  const result = await validatePasswordResetPlainToken(raw);
  if (!result.valid) {
    recordAuthSecurityEvent({
      eventType: "password_reset_token_rejected",
      outcome: "failed",
      actorUserId: null,
      actorRole: null,
      actorEmail: null,
      targetEmail: null,
      sourceIp: ipAddress,
      route: "POST /api/logins/validate-reset-token",
      detail: result.message ?? "Reset token invalid or expired.",
      retryAfterSeconds: null,
      captchaRequired: false,
    });
  }
  return res.json(result);
});

router.post("/reset-password-with-token", async (req: Request, res: Response, next: NextFunction) => {
  const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
  try {
    const { token, newPassword, confirmPassword } = req.body ?? {};

    const { email: resetUserEmail } = await resetPasswordWithPlainToken({
      plainToken: typeof token === "string" ? token : "",
      newPassword: typeof newPassword === "string" ? newPassword : "",
      confirmPassword: typeof confirmPassword === "string" ? confirmPassword : "",
    });

    recordAuthSecurityEvent({
      eventType: "password_reset_completed",
      outcome: "success",
      actorUserId: null,
      actorRole: null,
      actorEmail: null,
      targetEmail: resetUserEmail,
      sourceIp: ipAddress,
      route: "POST /api/logins/reset-password-with-token",
      detail: "Password reset completed using email link.",
      retryAfterSeconds: null,
      captchaRequired: false,
    });

    return res.json({
      message: "Password updated successfully. You can sign in with your new password.",
    });
  } catch (err) {
    if (err instanceof ApiError) {
      recordAuthSecurityEvent({
        eventType: "password_reset_token_rejected",
        outcome: "failed",
        actorUserId: null,
        actorRole: null,
        actorEmail: null,
        targetEmail: null,
        sourceIp: ipAddress,
        route: "POST /api/logins/reset-password-with-token",
        detail: err.message,
        retryAfterSeconds: null,
        captchaRequired: false,
      });
      return res.status(err.status).json({ code: err.code, message: err.message });
    }
    return next(err);
  }
});

router.get("/me", async (req: Request, res: Response) => {
  const token = req.cookies?.[AUTH_COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  try {
    const payload = jwt.verify(token, getJwtSecret(), {
      issuer: "LoginBackend",
      audience: "LoginFrontend",
    }) as { userId: number; email: string; role: string };

    const user = await prisma.userAccount.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, name: true, user_type: true },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const role =
      user.user_type === "adm"
        ? "admin"
        : user.user_type === "tm"
          ? "team_manager"
          : "consultant";

    return res.json({
      id: user.id,
      email: user.email,
      role,
      name: user.name,
    });
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
});

router.patch("/change-password", async (req: Request, res: Response) => {
  const token = req.cookies?.[AUTH_COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  let payload: { userId: number; email: string; role: string };
  try {
    payload = jwt.verify(token, getJwtSecret(), {
      issuer: "LoginBackend",
      audience: "LoginFrontend",
    }) as { userId: number; email: string; role: string };
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  const { currentPassword, newPassword, confirmPassword } = req.body ?? {};

  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({
      message: "Current password, new password, and confirmation are required",
    });
  }

  if (
    typeof currentPassword !== "string" ||
    typeof newPassword !== "string" ||
    typeof confirmPassword !== "string"
  ) {
    return res.status(400).json({ message: "Invalid password input" });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({
      message: "New password must be at least 8 characters long",
    });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({
      message: "New password and confirmation do not match",
    });
  }

  if (currentPassword === newPassword) {
    return res.status(400).json({
      message: "New password must be different from your current password",
    });
  }

  try {
    const user = await prisma.userAccount.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const valid = verifyPassword(user.email, currentPassword, user.password_hash);
    if (!valid) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    const newHash = hashPasswordWithUsername(user.email, newPassword);

    await prisma.userAccount.update({
      where: { id: user.id },
      data: { password_hash: newHash },
    });

    return res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to update password" });
  }
});

router.post("/logout", (req: Request, res: Response) => {
  const token = req.cookies?.[AUTH_COOKIE_NAME];

  if (token) {
    try {
      const payload = jwt.verify(token, getJwtSecret(), {
        issuer: "LoginBackend",
        audience: "LoginFrontend",
      }) as { userId: number; email: string; role: string };

      recordAuthSecurityEvent({
        eventType: "logout",
        outcome: "success",
        actorUserId: payload.userId,
        actorRole: payload.role,
        actorEmail: payload.email,
        targetEmail: payload.email,
        sourceIp: req.ip || req.socket.remoteAddress || "unknown",
        route: "POST /api/logins/logout",
        detail: "User signed out.",
        retryAfterSeconds: null,
        captchaRequired: false,
      });
    } catch {
      // Ignore invalid tokens during logout; cookie still needs to be cleared.
    }
  }

  res.clearCookie(AUTH_COOKIE_NAME, {
    ...getClearAuthCookieOptions(),
    });
  return res.json({});
});

//---------------------------------------------------------------------------------------------

router.post("/dev/mfa/generate", async (req: Request, res: Response) => {
    const { userId } = req.body;

    if (!isMfaEnabled()) {
        return res.status(404).json({ message: "MFA is disabled" });
    }

    if (!userId) {
        return res.status(400).json({ message: "userId required" });
    }

    const user = await prisma.userAccount.findUnique({
        where: { id: Number(userId) },
    });

    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }

    // 1. Generate secret
    const secret = generateSecret();

    // 2. Build URI for authenticator apps
    const uri = generateURI({
        issuer: "MyService",
        label: user.email,
        secret,
    });

    // 3. Convert URI → QR code image (base64)
    const qrCodeDataUrl = await QRCode.toDataURL(uri);

    // 4. Save secret to DB
    await prisma.userAccount.update({
        where: { id: user.id },
        data: {
            mfaSecret: secret,
            mfaEnabled: true,
        },
    });

    // 5. Return everything needed to enroll device
    return res.json({
        userId: user.id,
        email: user.email,
        secret,
        uri,
        qrCodeDataUrl, // <-- frontend can render this directly
    });
});

export default router;
