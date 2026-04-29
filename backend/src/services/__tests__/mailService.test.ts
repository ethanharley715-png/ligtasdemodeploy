import { createMailService, DisabledMailService, ResendMailService, SmtpMailService } from "../mailService";

describe("mail service factory", () => {
  const originalEmailProvider = process.env.EMAIL_PROVIDER;
  const originalResendKey = process.env.RESEND_API_KEY;

  afterEach(() => {
    if (originalEmailProvider == null) {
      delete process.env.EMAIL_PROVIDER;
    } else {
      process.env.EMAIL_PROVIDER = originalEmailProvider;
    }
    if (originalResendKey == null) {
      delete process.env.RESEND_API_KEY;
    } else {
      process.env.RESEND_API_KEY = originalResendKey;
    }
  });

  it("returns a disabled mail service when email is not configured", () => {
    delete process.env.EMAIL_PROVIDER;

    const service = createMailService({
      config: {
        host: "",
        port: 587,
        secure: false,
        user: "",
        pass: "",
        from: "",
        tlsRejectUnauthorized: true,
      },
    });

    expect(service).toBeInstanceOf(DisabledMailService);
  });

  it("uses smtp when EMAIL_PROVIDER=smtp even if RESEND_API_KEY is set", () => {
    process.env.EMAIL_PROVIDER = "smtp";
    process.env.RESEND_API_KEY = "re_should_not_be_used";

    const service = createMailService({
      config: {
        host: "smtp.example.com",
        port: 587,
        secure: false,
        user: "smtp-user",
        pass: "smtp-pass",
        from: "noreply@example.com",
        tlsRejectUnauthorized: true,
      },
    });

    expect(service).toBeInstanceOf(SmtpMailService);
  });

  it("returns an smtp mail service when smtp is configured", () => {
    delete process.env.EMAIL_PROVIDER;

    const service = createMailService({
      config: {
        host: "smtp.example.com",
        port: 587,
        secure: false,
        user: "smtp-user",
        pass: "smtp-pass",
        from: "noreply@example.com",
        tlsRejectUnauthorized: true,
      },
    });

    expect(service).toBeInstanceOf(SmtpMailService);
  });

  it("returns ResendMailService when RESEND_API_KEY and from are configured", () => {
    delete process.env.EMAIL_PROVIDER;
    process.env.RESEND_API_KEY = "re_test_key";

    const service = createMailService({
      config: {
        host: "",
        port: 587,
        secure: false,
        user: "",
        pass: "",
        from: "onboarding@resend.dev",
        tlsRejectUnauthorized: true,
      },
    });

    expect(service).toBeInstanceOf(ResendMailService);
  });

  it("honours an explicit disabled provider even when smtp credentials are present", () => {
    process.env.EMAIL_PROVIDER = "disabled";

    const service = createMailService({
      config: {
        host: "smtp.example.com",
        port: 587,
        secure: false,
        user: "smtp-user",
        pass: "smtp-pass",
        from: "noreply@example.com",
        tlsRejectUnauthorized: true,
      },
    });

    expect(service).toBeInstanceOf(DisabledMailService);
  });
});
