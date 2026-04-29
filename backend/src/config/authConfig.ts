import type { CookieOptions } from "express";

export const AUTH_COOKIE_NAME = "loginToken";
export const AUTH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_AUDIT_EVENT_LIMIT = 200;

export function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV === "production";
}

export function isMfaEnabled(): boolean {
  return String(process.env.MFA_ENABLED ?? "true").toLowerCase() !== "false";
}

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    throw new Error("JWT_SECRET is not configured.");
  }
  return secret;
}

export function assertAuthConfigOnStartup(): void {
  if (!isProductionEnvironment()) {
    return;
  }

  if (!process.env.JWT_SECRET?.trim()) {
    throw new Error("JWT_SECRET must be set in production.");
  }
}

export function getAuthCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProductionEnvironment(),
    sameSite: isProductionEnvironment() ? "none" : "lax",
    maxAge: AUTH_COOKIE_MAX_AGE_MS,
    path: "/",
  };
}

export function getClearAuthCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProductionEnvironment(),
    sameSite: isProductionEnvironment() ? "none" : "lax",
    path: "/",
    expires: new Date(0),
  };
}

export function getAuthAuditEventLimit(): number {
  const parsed = Number(process.env.AUTH_AUDIT_EVENT_LIMIT ?? "");
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_AUDIT_EVENT_LIMIT;
}
