import { ApiError } from "../errors/apiError";

type ScopeState = {
  failureTimestamps: number[];
  blockedUntil: number | null;
  lockoutCount: number;
};

export type LoginProtectionOptions = {
  now?: Date;
  windowMs?: number;
  maxFailuresPerIp?: number;
  maxFailuresPerIpAndEmail?: number;
  backoffDurationsMs?: number[];
  captchaRequiredAfterLockouts?: number;
  captchaEnabled?: boolean;
  captchaVerified?: boolean;
};

const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_MAX_FAILURES_PER_IP = 20;
const DEFAULT_MAX_FAILURES_PER_IP_AND_EMAIL = 5;
const DEFAULT_BACKOFF_DURATIONS_MS = [
  5 * 60 * 1000,
  15 * 60 * 1000,
  60 * 60 * 1000,
];
const DEFAULT_CAPTCHA_REQUIRED_AFTER_LOCKOUTS = 2;

const ipStates = new Map<string, ScopeState>();
const ipEmailStates = new Map<string, ScopeState>();

function normalizeIpAddress(ipAddress: string): string {
  const trimmed = ipAddress.trim();

  if (trimmed === "::1") {
    return "127.0.0.1";
  }

  if (trimmed.startsWith("::ffff:")) {
    return trimmed.slice("::ffff:".length);
  }

  return trimmed.toLowerCase();
}

export class LoginProtectionError extends ApiError {
  public readonly retryAfterSeconds: number;
  public readonly captchaRequired: boolean;

  constructor(message: string, retryAfterSeconds: number, captchaRequired: boolean) {
    super(429, "rate_limited", message);
    this.retryAfterSeconds = retryAfterSeconds;
    this.captchaRequired = captchaRequired;
  }
}

function getOrCreateState(store: Map<string, ScopeState>, key: string): ScopeState {
  const existing = store.get(key);
  if (existing) {
    return existing;
  }

  const created: ScopeState = {
    failureTimestamps: [],
    blockedUntil: null,
    lockoutCount: 0,
  };
  store.set(key, created);
  return created;
}

function buildIpEmailKey(ipAddress: string, email: string): string {
  return `${normalizeIpAddress(ipAddress)}|${email.trim().toLowerCase()}`;
}

function pruneState(state: ScopeState, nowMs: number, windowMs: number): void {
  state.failureTimestamps = state.failureTimestamps.filter((timestamp) => timestamp > nowMs - windowMs);
  if (state.blockedUntil != null && state.blockedUntil <= nowMs) {
    state.blockedUntil = null;
  }
}

function getRetryAfterSeconds(blockedUntil: number, nowMs: number): number {
  return Math.max(1, Math.ceil((blockedUntil - nowMs) / 1000));
}

function nextBackoffDurationMs(lockoutCount: number, backoffDurationsMs: number[]): number {
  const index = Math.min(Math.max(lockoutCount - 1, 0), backoffDurationsMs.length - 1);
  return backoffDurationsMs[index] ?? DEFAULT_BACKOFF_DURATIONS_MS[DEFAULT_BACKOFF_DURATIONS_MS.length - 1];
}

function getCaptchaRequired(
  options: Required<Pick<LoginProtectionOptions, "captchaEnabled" | "captchaRequiredAfterLockouts">>,
  states: ScopeState[],
): boolean {
  if (!options.captchaEnabled) {
    return false;
  }

  return states.some((state) => state.lockoutCount >= options.captchaRequiredAfterLockouts);
}

function getActiveBlock(nowMs: number, states: ScopeState[]): number | null {
  let activeUntil: number | null = null;

  for (const state of states) {
    if (state.blockedUntil != null && state.blockedUntil > nowMs) {
      activeUntil = activeUntil == null ? state.blockedUntil : Math.max(activeUntil, state.blockedUntil);
    }
  }

  return activeUntil;
}

function maybeThrowProtectionError(
  nowMs: number,
  states: ScopeState[],
  options: Required<Pick<LoginProtectionOptions, "captchaEnabled" | "captchaRequiredAfterLockouts" | "captchaVerified">>,
): void {
  const captchaRequired = getCaptchaRequired(options, states);
  const activeBlock = getActiveBlock(nowMs, states);

  if (activeBlock != null) {
    throw new LoginProtectionError(
      "Too many sign-in attempts. Please wait before trying again.",
      getRetryAfterSeconds(activeBlock, nowMs),
      captchaRequired,
    );
  }

  if (captchaRequired && !options.captchaVerified) {
    throw new LoginProtectionError(
      "Additional verification is required before you can sign in.",
      0,
      true,
    );
  }
}

function registerFailureOnScope(
  state: ScopeState,
  nowMs: number,
  maxFailures: number,
  backoffDurationsMs: number[],
): void {
  state.failureTimestamps.push(nowMs);

  if (state.failureTimestamps.length > maxFailures) {
    state.lockoutCount += 1;
    state.blockedUntil = nowMs + nextBackoffDurationMs(state.lockoutCount, backoffDurationsMs);
    state.failureTimestamps = [];
  }
}

function syncIpBlockFromEmailScope(ipState: ScopeState, emailState: ScopeState): void {
  if (emailState.blockedUntil == null) {
    return;
  }

  if (ipState.blockedUntil == null || ipState.blockedUntil < emailState.blockedUntil) {
    ipState.blockedUntil = emailState.blockedUntil;
  }

  if (ipState.lockoutCount < emailState.lockoutCount) {
    ipState.lockoutCount = emailState.lockoutCount;
  }
}

export function clearLoginRateLimitState(): void {
  ipStates.clear();
  ipEmailStates.clear();
}

export function assertLoginAttemptAllowed(
  params: { ipAddress: string; email?: string },
  options?: LoginProtectionOptions,
): void {
  const nowMs = (options?.now ?? new Date()).getTime();
  const windowMs = options?.windowMs ?? DEFAULT_WINDOW_MS;
  const captchaEnabled = options?.captchaEnabled ?? false;
  const captchaRequiredAfterLockouts =
    options?.captchaRequiredAfterLockouts ?? DEFAULT_CAPTCHA_REQUIRED_AFTER_LOCKOUTS;
  const captchaVerified = options?.captchaVerified ?? false;

  const relevantStates: ScopeState[] = [];
  const normalizedIp = normalizeIpAddress(params.ipAddress);
  const ipState = getOrCreateState(ipStates, normalizedIp);
  pruneState(ipState, nowMs, windowMs);
  relevantStates.push(ipState);

  if (params.email) {
    const ipEmailState = getOrCreateState(ipEmailStates, buildIpEmailKey(normalizedIp, params.email));
    pruneState(ipEmailState, nowMs, windowMs);
    relevantStates.push(ipEmailState);
  }

  maybeThrowProtectionError(nowMs, relevantStates, {
    captchaEnabled,
    captchaRequiredAfterLockouts,
    captchaVerified,
  });
}

export function recordFailedLoginAttempt(
  params: { ipAddress: string; email?: string },
  options?: LoginProtectionOptions,
): void {
  const nowMs = (options?.now ?? new Date()).getTime();
  const windowMs = options?.windowMs ?? DEFAULT_WINDOW_MS;
  const maxFailuresPerIp = options?.maxFailuresPerIp ?? DEFAULT_MAX_FAILURES_PER_IP;
  const maxFailuresPerIpAndEmail =
    options?.maxFailuresPerIpAndEmail ?? DEFAULT_MAX_FAILURES_PER_IP_AND_EMAIL;
  const backoffDurationsMs = options?.backoffDurationsMs ?? DEFAULT_BACKOFF_DURATIONS_MS;
  const captchaEnabled = options?.captchaEnabled ?? false;
  const captchaRequiredAfterLockouts =
    options?.captchaRequiredAfterLockouts ?? DEFAULT_CAPTCHA_REQUIRED_AFTER_LOCKOUTS;

  const normalizedIp = normalizeIpAddress(params.ipAddress);
  const ipState = getOrCreateState(ipStates, normalizedIp);
  pruneState(ipState, nowMs, windowMs);
  registerFailureOnScope(ipState, nowMs, maxFailuresPerIp, backoffDurationsMs);

  const relevantStates = [ipState];

  if (params.email) {
    const ipEmailState = getOrCreateState(ipEmailStates, buildIpEmailKey(normalizedIp, params.email));
    pruneState(ipEmailState, nowMs, windowMs);
    registerFailureOnScope(ipEmailState, nowMs, maxFailuresPerIpAndEmail, backoffDurationsMs);
    syncIpBlockFromEmailScope(ipState, ipEmailState);
    relevantStates.push(ipEmailState);
  }

  maybeThrowProtectionError(nowMs, relevantStates, {
    captchaEnabled,
    captchaRequiredAfterLockouts,
    captchaVerified: false,
  });
}

export function clearFailedLoginAttempts(params: { ipAddress: string; email: string }): void {
  ipEmailStates.delete(buildIpEmailKey(params.ipAddress, params.email));
}
