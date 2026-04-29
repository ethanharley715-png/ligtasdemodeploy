import fs from "fs";
import path from "path";

const SUBJECT = "FireCheck — reset your password";

let cachedLogoDataUri: string | null = null;

/**
 * Public PNG from the web app (`frontend/public`). Embedded as a data URI so remote mail
 * clients (e.g. Gmail) do not need to fetch `localhost` or a private network URL.
 */
function getPasswordResetLogoDataUri(): string {
  if (cachedLogoDataUri) {
    return cachedLogoDataUri;
  }

  const candidates = [
    path.join(__dirname, "../../../frontend/public/ligtas-logo.png"),
    path.join(process.cwd(), "frontend/public/ligtas-logo.png"),
    path.join(process.cwd(), "../frontend/public/ligtas-logo.png"),
  ];

  for (const filePath of candidates) {
    try {
      if (fs.existsSync(filePath)) {
        const buf = fs.readFileSync(filePath);
        cachedLogoDataUri = `data:image/png;base64,${buf.toString("base64")}`;
        return cachedLogoDataUri;
      }
    } catch {
      // try next candidate
    }
  }

  const fallbackSvg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" rx="8" fill="#fff"/><text x="24" y="32" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" font-weight="700" fill="#000">FC</text></svg>`,
  );
  cachedLogoDataUri = `data:image/svg+xml;charset=utf-8,${fallbackSvg}`;
  return cachedLogoDataUri;
}

export function escapeHtmlForEmail(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildPlainTextBody(resetUrl: string): string {
  return [
    "FireCheck (Ligtas QC)",
    "",
    "You requested a password reset.",
    "",
    "Reset your password within 15 minutes using this link:",
    resetUrl,
    "",
    "If the link expires, request a new reset from the sign-in page.",
    "",
    "Security: If you did not request this, ignore this email. Your password will not be changed.",
  ].join("\n");
}

/**
 * HTML + plain text for password reset (AC4). Matches site styling: black header, white card,
 * logo inlined from `frontend/public/ligtas-logo.png` so mail clients never load localhost URLs.
 */
export function buildPasswordResetEmailParts(resetUrl: string): {
  subject: string;
  html: string;
  text: string;
} {
  const safeUrl = escapeHtmlForEmail(resetUrl);
  const safeLogo = escapeHtmlForEmail(getPasswordResetLogoDataUri());

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtmlForEmail(SUBJECT)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f4f5;font-family:Helvetica,Arial,sans-serif;">
<tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
<tr>
<td style="background:#000000;padding:28px 28px 24px;">
<table role="presentation" cellspacing="0" cellpadding="0"><tr>
<td style="vertical-align:middle;padding-right:14px;">
<img src="${safeLogo}" alt="FireCheck" width="48" height="48" style="display:block;border-radius:8px;background:#ffffff;" />
</td>
<td style="vertical-align:middle;">
<p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;line-height:1.2;">FireCheck</p>
<p style="margin:6px 0 0;font-size:14px;color:#9ca3af;line-height:1.3;">Quality control · Ligtas QC</p>
</td>
</tr></table>
</td>
</tr>
<tr>
<td style="padding:28px 28px 8px;">
<p style="margin:0;font-size:18px;font-weight:700;color:#111827;">Reset your password</p>
<p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#4b5563;">We received a request to reset the password for your account. Use the button below — it stays valid for <strong style="color:#111827;">15 minutes</strong>.</p>
</td>
</tr>
<tr>
<td align="center" style="padding:20px 28px 8px;">
<a href="${safeUrl}" style="display:inline-block;background:#000000;color:#ffffff !important;text-decoration:none;font-weight:600;font-size:15px;padding:14px 32px;border-radius:8px;">Reset password</a>
</td>
</tr>
<tr>
<td style="padding:16px 28px 24px;">
<p style="margin:0;font-size:13px;line-height:1.55;color:#6b7280;">If the button does not work, copy and paste this address into your browser:</p>
<p style="margin:10px 0 0;font-size:12px;line-height:1.5;word-break:break-all;color:#374151;">${safeUrl}</p>
</td>
</tr>
<tr>
<td style="padding:18px 28px 22px;background:#f3f4f6;border-top:1px solid #e5e7eb;">
<p style="margin:0;font-size:13px;line-height:1.55;color:#4b5563;"><strong style="color:#111827;">Security notice:</strong> If you did not request a password reset, you can ignore this email. Your password will not be changed.</p>
</td>
</tr>
<tr>
<td style="padding:16px 28px 24px;text-align:center;border-top:1px solid #e5e7eb;">
<p style="margin:0;font-size:11px;color:#9ca3af;">© Ligtas QC · FireCheck</p>
</td>
</tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  return {
    subject: SUBJECT,
    html,
    text: buildPlainTextBody(resetUrl),
  };
}
