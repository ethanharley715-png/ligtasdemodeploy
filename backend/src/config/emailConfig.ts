export type MailProvider = "smtp" | "resend" | "disabled";

export type EmailConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  tlsRejectUnauthorized: boolean;
};

function trimEnv(value: string | undefined): string {
  return String(value ?? "")
    .trim()
    .replace(/^\uFEFF/, "");
}

function parsePort(value: string | undefined): number {
  const parsed = Number(value ?? "587");
  return Number.isFinite(parsed) ? parsed : 587;
}

function parseSecure(value: string | undefined): boolean {
  return String(value ?? "").toLowerCase() === "true";
}

function parseTlsRejectUnauthorized(value: string | undefined): boolean {
  return String(value ?? "true").toLowerCase() !== "false";
}

function normalizeMailProvider(value: string | undefined): MailProvider | undefined {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (normalized === "smtp") {
    return "smtp";
  }

  if (normalized === "resend") {
    return "resend";
  }

  if (normalized === "disabled") {
    return "disabled";
  }

  return undefined;
}

export function getResendApiKey(): string {
  return trimEnv(process.env.RESEND_API_KEY);
}

/** Resend uses HTTPS + API key (no SMTP). Reuses SMTP_FROM as the sender address. */
export function hasResendEmailConfig(config: EmailConfig = getEmailConfig()): boolean {
  return Boolean(getResendApiKey() && config.from);
}

export function getEmailConfig(): EmailConfig {
  return {
    host: trimEnv(process.env.SMTP_HOST),
    port: parsePort(process.env.SMTP_PORT),
    secure: parseSecure(process.env.SMTP_SECURE),
    user: trimEnv(process.env.SMTP_USER),
    pass: trimEnv(process.env.SMTP_PASS),
    from: trimEnv(process.env.SMTP_FROM),
    tlsRejectUnauthorized: parseTlsRejectUnauthorized(process.env.SMTP_TLS_REJECT_UNAUTHORIZED),
  };
}

export function hasEmailConfig(config: EmailConfig = getEmailConfig()): boolean {
  return Boolean(config.host && config.user && config.pass && config.from);
}

export function getMailProvider(config: EmailConfig = getEmailConfig()): MailProvider {
  const explicitProvider = normalizeMailProvider(process.env.EMAIL_PROVIDER);

  if (explicitProvider === "disabled") {
    return "disabled";
  }

  if (explicitProvider === "resend") {
    return hasResendEmailConfig(config) ? "resend" : "disabled";
  }

  if (explicitProvider === "smtp") {
    return hasEmailConfig(config) ? "smtp" : "disabled";
  }

  if (hasResendEmailConfig(config)) {
    return "resend";
  }

  if (hasEmailConfig(config)) {
    return "smtp";
  }

  return "disabled";
}
