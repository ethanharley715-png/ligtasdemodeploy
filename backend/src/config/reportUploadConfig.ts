const ONE_MB = 1024 * 1024;
const FIFTY_MB = 50 * ONE_MB;

function readBoundedIntEnv(
  key: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const rawValue = process.env[key];

  if (!rawValue) {
    return fallback;
  }

  const parsedValue = Number.parseInt(rawValue, 10);

  if (!Number.isFinite(parsedValue) || parsedValue < min || parsedValue > max) {
    return fallback;
  }

  return parsedValue;
}

export const reportUploadConfig = {
  maxReportFileSizeBytes: readBoundedIntEnv(
    "MAX_REPORT_FILE_SIZE_BYTES",
    FIFTY_MB,
    ONE_MB,
    200 * ONE_MB,
  ),
  reportSessionTtlHours: readBoundedIntEnv("REPORT_SESSION_TTL_HOURS", 4, 1, 24),
  wordsPerPageHeuristic: readBoundedIntEnv("WORDS_PER_PAGE_HEURISTIC", 500, 100, 2000),
};
