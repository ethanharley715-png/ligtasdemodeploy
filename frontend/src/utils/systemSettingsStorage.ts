/** Shared key and readers so idle logout and password checks stay in sync with Settings. */

export const SYSTEM_SETTINGS_STORAGE_KEY = "ligtas-system-settings-v1";

export type SessionTimeoutChoice =
  | "15"
  | "30"
  | "60"
  | "120"
  | "240"
  | "480"
  | "never";

export type PasswordPolicy = {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSpecial: boolean;
};

const DEFAULT_POLICY: PasswordPolicy = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: true,
};

function parseSettingsBlob(): Record<string, unknown> | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(SYSTEM_SETTINGS_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Minutes until auto logout, or never. */
export function getSessionTimeoutMinutesFromStorage(): number | "never" {
  const p = parseSettingsBlob();
  const v = p?.sessionTimeoutMinutes;
  if (v === "never") return "never";
  if (typeof v === "string") {
    const n = Number.parseInt(v, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 30;
}

export function loadPasswordPolicyFromStorage(): PasswordPolicy {
  const p = parseSettingsBlob();
  if (!p) return { ...DEFAULT_POLICY };
  const minLength =
    typeof p.passwordMinLength === "number"
      ? Math.min(32, Math.max(6, Math.round(p.passwordMinLength)))
      : DEFAULT_POLICY.minLength;
  return {
    minLength,
    requireUppercase:
      typeof p.passwordRequireUppercase === "boolean" ? p.passwordRequireUppercase : DEFAULT_POLICY.requireUppercase,
    requireLowercase:
      typeof p.passwordRequireLowercase === "boolean" ? p.passwordRequireLowercase : DEFAULT_POLICY.requireLowercase,
    requireNumber:
      typeof p.passwordRequireNumber === "boolean" ? p.passwordRequireNumber : DEFAULT_POLICY.requireNumber,
    requireSpecial:
      typeof p.passwordRequireSpecial === "boolean" ? p.passwordRequireSpecial : DEFAULT_POLICY.requireSpecial,
  };
}

/** Returns a user-facing error message, or null if valid. */
export function validatePasswordAgainstPolicy(password: string, policy: PasswordPolicy): string | null {
  if (password.length < policy.minLength) {
    return `Password must be at least ${policy.minLength} characters.`;
  }
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    return "Password must include at least one uppercase letter.";
  }
  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    return "Password must include at least one lowercase letter.";
  }
  if (policy.requireNumber && !/[0-9]/.test(password)) {
    return "Password must include at least one number.";
  }
  if (policy.requireSpecial && !/[^A-Za-z0-9]/.test(password)) {
    return "Password must include at least one special character.";
  }
  return null;
}
