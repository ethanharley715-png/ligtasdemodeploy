import { describe, expect, it } from "vitest";
import { buildComposeUrl } from "../emailCompose";

describe("buildComposeUrl", () => {
  it("builds a mailto link for the default email app", () => {
    const url = buildComposeUrl("default", {
      to: "reviewer@example.com",
      subject: "QC results export",
      body: "Attach the downloaded file manually.",
    });
    const parsed = new URL(url);

    expect(parsed.protocol).toBe("mailto:");
    expect(decodeURIComponent(parsed.pathname)).toBe("reviewer@example.com");
    expect(parsed.searchParams.get("subject")).toBe("QC results export");
    expect(parsed.searchParams.get("body")).toBe("Attach the downloaded file manually.");
  });

  it("builds a Gmail compose link", () => {
    const parsed = new URL(
      buildComposeUrl("gmail", {
        to: "reviewer@example.com",
        subject: "Weekly QC digest",
        body: "Please review the digest.",
      }),
    );

    expect(parsed.origin).toBe("https://mail.google.com");
    expect(parsed.pathname).toBe("/mail/");
    expect(parsed.searchParams.get("view")).toBe("cm");
    expect(parsed.searchParams.get("fs")).toBe("1");
    expect(parsed.searchParams.get("to")).toBe("reviewer@example.com");
    expect(parsed.searchParams.get("su")).toBe("Weekly QC digest");
    expect(parsed.searchParams.get("body")).toBe("Please review the digest.");
  });

  it("builds an Outlook Web compose link", () => {
    const parsed = new URL(
      buildComposeUrl("outlook", {
        to: "reviewer@example.com",
        subject: "Weekly QC digest",
        body: "Please review the digest.",
      }),
    );

    expect(parsed.origin).toBe("https://outlook.office.com");
    expect(parsed.pathname).toBe("/mail/deeplink/compose");
    expect(parsed.searchParams.get("to")).toBe("reviewer@example.com");
    expect(parsed.searchParams.get("subject")).toBe("Weekly QC digest");
    expect(parsed.searchParams.get("body")).toBe("Please review the digest.");
  });
});
