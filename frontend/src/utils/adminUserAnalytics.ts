/**
 * adminUserAnalytics.ts
 * Author: Abdulaziz Albaiji
 *
 * Utility for generating admin analytics deep-link URLs.
 *
 * Centralising the URL pattern here means any future path change only
 * needs to be updated in one place rather than across every component
 * that links to the admin user analytics profile.
 */

/**
 * Returns the canonical client-side path for the admin per-user analytics
 * view (AC4).  The userId is URL-encoded to handle numeric and string IDs safely.
 *
 * @example adminUserAnalyticsHref(42) → "/admin/users/42/analytics"
 */
export function adminUserAnalyticsHref(userId: string | number): string {
  return `/admin/users/${encodeURIComponent(String(userId))}/analytics`;
}
