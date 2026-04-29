/**
 * mailService.ts
 * Author: Abdulaziz Albaiji
 *
 * Provides an abstraction over two email delivery providers:
 *  - Resend (transactional API via HTTP)
 *  - SMTP (Nodemailer, including Gmail shorthand)
 *
 * The correct provider is selected at runtime from environment variables.
 * If neither is configured, a DisabledMailService is returned that throws
 * on every send attempt so failures are loud and obvious.
 */

import nodemailer from "nodemailer";
import { ApiError } from "../errors/apiError";
import {
  getEmailConfig,
  getMailProvider,
  getResendApiKey,
  hasEmailConfig,
  hasResendEmailConfig,
  type EmailConfig,
  type MailProvider,
} from "../config/emailConfig";

/** Describes a file attachment to include with an outgoing email. */
export type MailAttachment = {
  filename: string;
  contentType: string;
  content: Buffer;
};

/** Input shape accepted by every MailService implementation. */
export type SendMailInput = {
  to: string;
  subject: string;
  text: string;
  /** Optional multipart/alternative HTML part (e.g. branded templates). */
  html?: string;
  attachments?: MailAttachment[];
};

/** Common interface for all mail provider implementations. */
export interface MailService {
  send(input: SendMailInput): Promise<void>;
}

/** Reports whether the currently configured mail service can deliver emails. */
export type MailServiceAvailability = {
  available: boolean;
  reason?: string;
};

/**
 * Returned when no email provider is configured.
 * Throws a 503 on every send so callers receive a clear error rather
 * than silently dropping emails.
 */
export class DisabledMailService implements MailService {
  async send(): Promise<void> {
    throw new ApiError(503, "invalid_request", "Email sharing is not configured.");
  }
}

/**
 * Returns true if the given SMTP host is Gmail's server.
 * Nodemailer has a built-in "gmail" service shorthand that handles
 * OAuth2 and TLS automatically, so we use it instead of raw host/port.
 */
function isGmailSmtpHost(host: string): boolean {
  return host.trim().toLowerCase() === "smtp.gmail.com";
}

/**
 * Sends email via the Resend HTTP API (https://resend.com).
 * Requires RESEND_API_KEY and SMTP_FROM to be set in the environment.
 * Note: attachments are not supported through Resend in this build.
 */
export class ResendMailService implements MailService {
  private readonly from: string;

  constructor(config: EmailConfig = getEmailConfig()) {
    this.from = config.from;
  }

  async send(input: SendMailInput): Promise<void> {
    const apiKey = getResendApiKey();
    if (!apiKey || !this.from) {
      throw new ApiError(503, "invalid_request", "Email is not configured (Resend API key or from address missing).");
    }

    // Resend attachments are not wired up in this build; reject early.
    if (input.attachments?.length) {
      throw new ApiError(
        400,
        "invalid_request",
        "The Resend mail provider does not support attachments in this build.",
      );
    }

    // Build the JSON payload; only include html if it was provided.
    const payload: Record<string, unknown> = {
      from: this.from,
      to: [input.to],
      subject: input.subject,
      text: input.text,
    };

    if (input.html) {
      payload.html = input.html;
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      // Extract a human-readable error from the response body when available.
      const errJson = (await res.json().catch(() => null)) as { message?: string } | null;
      const detail =
        typeof errJson?.message === "string" && errJson.message.trim()
          ? errJson.message.trim()
          : (await res.text()).slice(0, 400);
      // Map 4xx → 400 (client error), anything else → 502 (bad gateway).
      const status = res.status >= 400 && res.status < 500 ? 400 : 502;
      throw new ApiError(status, "invalid_request", detail || "Resend rejected the email request.");
    }
  }
}

/**
 * Sends email via Nodemailer over SMTP.
 * Supports Gmail (detected automatically) and generic SMTP servers.
 * Set SMTP_DEBUG=1 to enable verbose Nodemailer logging for Gmail.
 */
export class SmtpMailService implements MailService {
  private readonly config: EmailConfig;

  constructor(config: EmailConfig = getEmailConfig()) {
    this.config = config;
  }

  async send(input: SendMailInput): Promise<void> {
    if (!hasEmailConfig(this.config)) {
      throw new ApiError(503, "invalid_request", "Email sharing is not configured.");
    }

    const auth = {
      user: this.config.user,
      pass: this.config.pass,
    };

    // Allow self-signed certificates in development via SMTP_TLS_REJECT_UNAUTHORIZED=false.
    const tlsOpts =
      this.config.tlsRejectUnauthorized === false ? { tls: { rejectUnauthorized: false as const } } : {};

    const smtpDebug = String(process.env.SMTP_DEBUG ?? "").toLowerCase() === "1" || process.env.SMTP_DEBUG === "true";

    // Use Nodemailer's built-in Gmail service preset for smtp.gmail.com,
    // otherwise configure the transporter manually with host/port/secure.
    const transporter = isGmailSmtpHost(this.config.host)
      ? nodemailer.createTransport({
          service: "gmail",
          auth,
          ...(smtpDebug ? { debug: true, logger: true } : {}),
          ...tlsOpts,
        })
      : nodemailer.createTransport({
          host: this.config.host,
          port: this.config.port,
          secure: this.config.secure,
          auth,
          ...tlsOpts,
        });

    await transporter.sendMail({
      from: this.config.from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      ...(input.html ? { html: input.html } : {}),
      attachments: input.attachments?.map((attachment) => ({
        filename: attachment.filename,
        contentType: attachment.contentType,
        content: attachment.content,
      })),
    });
  }
}

/**
 * Factory function that returns the appropriate MailService based on
 * environment configuration.
 * Priority: Resend → SMTP → DisabledMailService (if neither is set up).
 */
export function createMailService(options?: {
  provider?: MailProvider;
  config?: EmailConfig;
}): MailService {
  const config = options?.config ?? getEmailConfig();
  const provider = options?.provider ?? getMailProvider(config);

  if (provider === "resend" && hasResendEmailConfig(config)) {
    return new ResendMailService(config);
  }

  if (provider === "smtp" && hasEmailConfig(config)) {
    return new SmtpMailService(config);
  }

  // No valid provider found — return a no-op service that fails loudly.
  return new DisabledMailService();
}

/**
 * Checks whether the current environment has a working email provider.
 * Useful for feature-gating flows (e.g. password reset) that require email.
 */
export function getMailServiceAvailability(options?: {
  provider?: MailProvider;
  config?: EmailConfig;
}): MailServiceAvailability {
  const config = options?.config ?? getEmailConfig();
  const provider = options?.provider ?? getMailProvider(config);

  if (provider === "resend" && hasResendEmailConfig(config)) {
    return { available: true };
  }

  if (provider === "smtp" && hasEmailConfig(config)) {
    return { available: true };
  }

  return {
    available: false,
    reason: "Email is not configured (set RESEND_API_KEY + SMTP_FROM, or full SMTP_* for Nodemailer).",
  };
}
