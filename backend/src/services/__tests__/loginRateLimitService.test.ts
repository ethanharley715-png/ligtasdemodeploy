import {
  assertLoginAttemptAllowed,
  clearFailedLoginAttempts,
  clearLoginRateLimitState,
  LoginProtectionError,
  recordFailedLoginAttempt,
} from "../loginRateLimitService";

describe("loginRateLimitService", () => {
  const baseOptions = {
    windowMs: 15 * 60 * 1000,
    maxFailuresPerIp: 99,
    maxFailuresPerIpAndEmail: 2,
    backoffDurationsMs: [60_000, 300_000, 900_000],
    captchaEnabled: true,
    captchaRequiredAfterLockouts: 2,
  };

  beforeEach(() => {
    clearLoginRateLimitState();
  });

  it("enforces a combined per-IP and per-email lockout", () => {
    const ipAddress = "127.0.0.1";
    const email = "user@example.com";
    const first = new Date("2026-04-07T10:00:00.000Z");
    const second = new Date("2026-04-07T10:01:00.000Z");
    const third = new Date("2026-04-07T10:02:00.000Z");

    recordFailedLoginAttempt({ ipAddress, email }, { ...baseOptions, now: first });
    recordFailedLoginAttempt({ ipAddress, email }, { ...baseOptions, now: second });

    expect(() =>
      recordFailedLoginAttempt({ ipAddress, email }, { ...baseOptions, now: third }),
    ).toThrow(LoginProtectionError);
  });

  it("enforces an aggregate per-IP lockout across multiple emails", () => {
    const ipAddress = "127.0.0.1";
    const first = new Date("2026-04-07T10:00:00.000Z");
    const second = new Date("2026-04-07T10:01:00.000Z");
    const third = new Date("2026-04-07T10:02:00.000Z");
    const fourth = new Date("2026-04-07T10:03:00.000Z");
    const fifth = new Date("2026-04-07T10:04:00.000Z");

    const ipOptions = { ...baseOptions, maxFailuresPerIp: 4 };

    recordFailedLoginAttempt({ ipAddress, email: "a@example.com" }, { ...ipOptions, now: first });
    recordFailedLoginAttempt({ ipAddress, email: "b@example.com" }, { ...ipOptions, now: second });
    recordFailedLoginAttempt({ ipAddress, email: "c@example.com" }, { ...ipOptions, now: third });
    recordFailedLoginAttempt({ ipAddress, email: "d@example.com" }, { ...ipOptions, now: fourth });

    expect(() =>
      recordFailedLoginAttempt({ ipAddress, email: "e@example.com" }, { ...ipOptions, now: fifth }),
    ).toThrow(LoginProtectionError);
  });

  it("applies progressive backoff durations across repeated lockouts", () => {
    const ipAddress = "127.0.0.1";
    const email = "user@example.com";
    const start = new Date("2026-04-07T10:00:00.000Z");

    recordFailedLoginAttempt({ ipAddress, email }, { ...baseOptions, now: start });
    recordFailedLoginAttempt({ ipAddress, email }, { ...baseOptions, now: new Date(start.getTime() + 1_000) });

    try {
      recordFailedLoginAttempt({ ipAddress, email }, { ...baseOptions, now: new Date(start.getTime() + 2_000) });
      throw new Error("Expected first lockout");
    } catch (error) {
      expect(error).toBeInstanceOf(LoginProtectionError);
      expect((error as LoginProtectionError).retryAfterSeconds).toBe(60);
    }

    const afterFirstLockout = new Date(start.getTime() + 63_000);
    recordFailedLoginAttempt({ ipAddress, email }, { ...baseOptions, now: afterFirstLockout });
    recordFailedLoginAttempt(
      { ipAddress, email },
      { ...baseOptions, now: new Date(afterFirstLockout.getTime() + 1_000) },
    );

    try {
      recordFailedLoginAttempt(
        { ipAddress, email },
        { ...baseOptions, now: new Date(afterFirstLockout.getTime() + 2_000) },
      );
      throw new Error("Expected second lockout");
    } catch (error) {
      expect(error).toBeInstanceOf(LoginProtectionError);
      expect((error as LoginProtectionError).retryAfterSeconds).toBe(300);
      expect((error as LoginProtectionError).captchaRequired).toBe(true);
    }
  });

  it("requires captcha after repeated lockouts when enabled", () => {
    const ipAddress = "127.0.0.1";
    const email = "user@example.com";
    const start = new Date("2026-04-07T10:00:00.000Z");

    recordFailedLoginAttempt({ ipAddress, email }, { ...baseOptions, now: start });
    recordFailedLoginAttempt({ ipAddress, email }, { ...baseOptions, now: new Date(start.getTime() + 1_000) });
    try {
      recordFailedLoginAttempt({ ipAddress, email }, { ...baseOptions, now: new Date(start.getTime() + 2_000) });
    } catch {
      // expected
    }

    const afterFirstLockout = new Date(start.getTime() + 63_000);
    recordFailedLoginAttempt({ ipAddress, email }, { ...baseOptions, now: afterFirstLockout });
    recordFailedLoginAttempt(
      { ipAddress, email },
      { ...baseOptions, now: new Date(afterFirstLockout.getTime() + 1_000) },
    );
    try {
      recordFailedLoginAttempt(
        { ipAddress, email },
        { ...baseOptions, now: new Date(afterFirstLockout.getTime() + 2_000) },
      );
    } catch {
      // expected
    }

    expect(() =>
      assertLoginAttemptAllowed(
        { ipAddress, email },
        {
          ...baseOptions,
          now: new Date(afterFirstLockout.getTime() + 303_000),
          captchaVerified: false,
        },
      ),
    ).toThrow(LoginProtectionError);
  });

  it("does not remove an active ip-level lockout when clearing email-specific state", () => {
    const ipAddress = "127.0.0.1";
    const email = "user@example.com";
    const start = new Date("2026-04-07T10:00:00.000Z");

    recordFailedLoginAttempt({ ipAddress, email }, { ...baseOptions, now: start });
    recordFailedLoginAttempt({ ipAddress, email }, { ...baseOptions, now: new Date(start.getTime() + 1_000) });
    try {
      recordFailedLoginAttempt({ ipAddress, email }, { ...baseOptions, now: new Date(start.getTime() + 2_000) });
    } catch {
      // expected
    }

    clearFailedLoginAttempts({ ipAddress, email });

    expect(() =>
      assertLoginAttemptAllowed(
        { ipAddress, email },
        {
          ...baseOptions,
          now: new Date(start.getTime() + 3_000),
          captchaVerified: false,
        },
      ),
    ).toThrow(LoginProtectionError);
  });
});
