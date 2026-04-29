const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:5173"];

function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function getAllowedOrigins(): string[] {
  const configured = process.env.ALLOWED_ORIGINS
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const candidates = configured && configured.length > 0 ? configured : DEFAULT_ALLOWED_ORIGINS;
  const normalized = candidates
    .map((value) => normalizeOrigin(value))
    .filter((value): value is string => Boolean(value));

  return normalized.length > 0 ? normalized : DEFAULT_ALLOWED_ORIGINS;
}

export function isAllowedOrigin(origin: string, allowedOrigins: string[] = getAllowedOrigins()): boolean {
  const normalized = normalizeOrigin(origin);
  return normalized != null && allowedOrigins.includes(normalized);
}

export function hasTrustedBrowserSource(
  headers: { origin?: string | string[]; referer?: string | string[] },
  allowedOrigins: string[] = getAllowedOrigins(),
): boolean {
  const origin = Array.isArray(headers.origin) ? headers.origin[0] : headers.origin;
  if (origin && isAllowedOrigin(origin, allowedOrigins)) {
    return true;
  }

  const referer = Array.isArray(headers.referer) ? headers.referer[0] : headers.referer;
  if (referer && isAllowedOrigin(referer, allowedOrigins)) {
    return true;
  }

  return false;
}
