import { buildPasswordResetEmailParts, escapeHtmlForEmail } from "../passwordResetEmailTemplate";

describe("passwordResetEmailTemplate", () => {
  it("escapes HTML for email attributes", () => {
    expect(escapeHtmlForEmail(`a&b"c<'>`)).toBe("a&amp;b&quot;c&lt;&#39;&gt;");
  });

  it("includes FireCheck branding, CTA, expiry, security block, and plain text", () => {
    const url = "https://app.example.com/reset-password?token=abc";
    const { subject, html, text } = buildPasswordResetEmailParts(url);

    expect(subject).toContain("FireCheck");
    expect(html).toContain("FireCheck");
    expect(html).toContain("Reset your password");
    expect(html).toContain("15 minutes");
    expect(html).toContain("Security notice");
    expect(html).toContain("reset-password");
    expect(html).toMatch(/data:image\/png;base64,/);
    expect(text).toContain("FireCheck");
    expect(text).toContain(url);
    expect(text).toContain("15 minutes");
    expect(text).toContain("Security");
  });
});
