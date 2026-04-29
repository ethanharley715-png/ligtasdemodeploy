export type EmailComposeTarget = "default" | "gmail" | "outlook";

type EmailComposeInput = {
  to?: string;
  subject: string;
  body: string;
};

function buildQuery(params: Record<string, string | undefined>, keyMap?: Record<string, string>): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "") {
      continue;
    }
    searchParams.set(keyMap?.[key] ?? key, value);
  }

  return searchParams.toString();
}

export function buildComposeUrl(target: EmailComposeTarget, input: EmailComposeInput): string {
  const to = input.to?.trim();
  const subject = input.subject.trim();
  const body = input.body.trim();

  if (target === "default") {
    return `mailto:${encodeURIComponent(to ?? "")}?${buildQuery({
      subject,
      body,
    })}`;
  }

  if (target === "gmail") {
    return `https://mail.google.com/mail/?${buildQuery(
      {
        view: "cm",
        fs: "1",
        to,
        subject,
        body,
      },
      { subject: "su" },
    )}`;
  }

  return `https://outlook.office.com/mail/deeplink/compose?${buildQuery({
    to,
    subject,
    body,
  })}`;
}

export function openComposeUrl(target: EmailComposeTarget, input: EmailComposeInput): void {
  const url = buildComposeUrl(target, input);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.target = target === "default" ? "_self" : "_blank";
  anchor.rel = "noopener noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
