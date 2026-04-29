export const USER_DISPLAY_PREFS_CHANGED = "ligtas-user-display-prefs-changed";

export type TextSizeOption = "small" | "medium" | "large";
export type DefaultDashboardViewOption = "dashboard" | "upload" | "history";

export interface UserDisplayPreferences {
  darkMode: boolean;
  colourBlindMode: boolean;
  textSize: TextSizeOption;
  defaultDashboardView: DefaultDashboardViewOption;
}

const DEFAULTS: UserDisplayPreferences = {
  darkMode: false,
  colourBlindMode: false,
  textSize: "medium",
  defaultDashboardView: "dashboard",
};

function storageKey(email: string): string {
  return `ligtas-user-display-prefs-${email.trim().toLowerCase()}`;
}

export function loadUserDisplayPreferences(email: string): UserDisplayPreferences {
  try {
    if (typeof localStorage === "undefined") return { ...DEFAULTS };
    const raw = localStorage.getItem(storageKey(email));
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<UserDisplayPreferences>;
    return {
      ...DEFAULTS,
      ...parsed,
      textSize: parsed.textSize === "small" || parsed.textSize === "large" ? parsed.textSize : "medium",
      defaultDashboardView:
        parsed.defaultDashboardView === "upload" || parsed.defaultDashboardView === "history"
          ? parsed.defaultDashboardView
          : "dashboard",
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveUserDisplayPreferences(email: string, prefs: UserDisplayPreferences): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(storageKey(email), JSON.stringify(prefs));
}

export function notifyUserDisplayPreferencesChanged(): void {
  window.dispatchEvent(new CustomEvent(USER_DISPLAY_PREFS_CHANGED));
}

/** Apply display preferences to `<html>` (live preview before persisting to localStorage). */
export function applyDisplayPrefsToDocument(prefs: UserDisplayPreferences): void {
  const root = document.documentElement;
  root.classList.toggle("dark", prefs.darkMode);
  root.dataset.colourBlind = prefs.colourBlindMode ? "true" : "false";
  root.classList.remove("ligtas-text-sm", "ligtas-text-base", "ligtas-text-lg");
  const sizeClass =
    prefs.textSize === "small"
      ? "ligtas-text-sm"
      : prefs.textSize === "large"
        ? "ligtas-text-lg"
        : "ligtas-text-base";
  root.classList.add(sizeClass);
  notifyUserDisplayPreferencesChanged();
}

export function applyUserDisplayPreferencesToDocument(email: string): void {
  applyDisplayPrefsToDocument(loadUserDisplayPreferences(email));
}

export function clearUserDisplayPreferencesFromDocument(): void {
  const root = document.documentElement;
  root.classList.remove("dark");
  delete root.dataset.colourBlind;
  root.classList.remove("ligtas-text-sm", "ligtas-text-base", "ligtas-text-lg");
  notifyUserDisplayPreferencesChanged();
}

/** View id used by `DashboardLayout` `activeView` state. */
export function getInitialDashboardView(email: string): string {
  const v = loadUserDisplayPreferences(email).defaultDashboardView;
  if (v === "upload") return "upload";
  if (v === "history") return "history";
  return "dashboard";
}

