import { ApiError } from "../errors/apiError";

type LoginCaptchaConfig = {
  enabled: boolean;
  provider: "turnstile" | null;
  captchaRequiredAfterLockouts: number;
  turnstileSecretKey: string | null;
};

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value ?? "");
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveProvider(value: string | undefined): "turnstile" | null {
  const normalized = value?.trim().toLowerCase();
  return normalized === "turnstile" ? "turnstile" : null;
}

export function getLoginCaptchaConfig(): LoginCaptchaConfig {
  const provider = resolveProvider(process.env.LOGIN_CAPTCHA_PROVIDER);
  const turnstileSecretKey = process.env.LOGIN_TURNSTILE_SECRET_KEY?.trim() || null;
  const enabled = provider === "turnstile" && Boolean(turnstileSecretKey);

  return {
    enabled,
    provider,
    captchaRequiredAfterLockouts: parsePositiveInt(process.env.LOGIN_CAPTCHA_AFTER_LOCKOUTS, 2),
    turnstileSecretKey,
  };
}

async function verifyTurnstileToken(token: string, ipAddress?: string): Promise<boolean> {
  const config = getLoginCaptchaConfig();

  if (!config.turnstileSecretKey) {
    throw new ApiError(500, "internal_error", "Login CAPTCHA is not configured.");
  }

  const body = new URLSearchParams({
    secret: config.turnstileSecretKey,
    response: token,
  });

  if (ipAddress) {
    body.set("remoteip", ipAddress);
  }

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new ApiError(502, "internal_error", "Failed to verify login CAPTCHA.");
  }

  const payload = (await response.json()) as { success?: boolean };
  return payload.success === true;
}

export async function verifyLoginCaptcha(token: string | undefined, ipAddress?: string): Promise<boolean> {
  const config = getLoginCaptchaConfig();

  if (!config.enabled) {
    return false;
  }

  const trimmedToken = token?.trim();
  if (!trimmedToken) {
    return false;
  }

  if (config.provider === "turnstile") {
    return verifyTurnstileToken(trimmedToken, ipAddress);
  }

  return false;
}
