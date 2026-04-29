import {
  clearPasswordResetEmailRateLimitState,
  getPasswordResetEmailRateLimitRetryAfterSeconds,
  isPasswordResetEmailRateLimited,
  recordPasswordResetEmailDispatched,
} from "../passwordResetRateLimitService";

describe("passwordResetRateLimitService", () => {
  beforeEach(() => {
    clearPasswordResetEmailRateLimitState();
  });

  it("allows three dispatches per email within one hour", () => {
    const t = 1_700_000_000_000;
    expect(isPasswordResetEmailRateLimited("User@Example.com", t)).toBe(false);
    recordPasswordResetEmailDispatched("user@example.com", t);
    expect(isPasswordResetEmailRateLimited("user@example.com", t)).toBe(false);
    recordPasswordResetEmailDispatched("user@example.com", t + 1000);
    expect(isPasswordResetEmailRateLimited("user@example.com", t + 1000)).toBe(false);
    recordPasswordResetEmailDispatched("user@example.com", t + 2000);
    expect(isPasswordResetEmailRateLimited("user@example.com", t + 2000)).toBe(true);
  });

  it("clears limit after one hour from oldest dispatch", () => {
    const t0 = 1_700_000_000_000;
    recordPasswordResetEmailDispatched("a@b.com", t0);
    recordPasswordResetEmailDispatched("a@b.com", t0 + 1);
    recordPasswordResetEmailDispatched("a@b.com", t0 + 2);
    expect(isPasswordResetEmailRateLimited("a@b.com", t0 + 3)).toBe(true);

    const oneHourMs = 60 * 60 * 1000;
    expect(isPasswordResetEmailRateLimited("a@b.com", t0 + oneHourMs + 1)).toBe(false);
  });

  it("returns retry-after based on oldest timestamp in window", () => {
    const t0 = 1_700_000_000_000;
    recordPasswordResetEmailDispatched("x@y.com", t0);
    recordPasswordResetEmailDispatched("x@y.com", t0 + 1000);
    recordPasswordResetEmailDispatched("x@y.com", t0 + 2000);
    const now = t0 + 5000;
    expect(isPasswordResetEmailRateLimited("x@y.com", now)).toBe(true);
    const retry = getPasswordResetEmailRateLimitRetryAfterSeconds("x@y.com", now);
    expect(retry).toBeGreaterThan(0);
    expect(retry).toBeLessThanOrEqual(3600);
  });
});
