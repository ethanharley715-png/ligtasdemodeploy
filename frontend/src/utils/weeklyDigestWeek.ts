const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

function toUtcDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfIsoWeek(date: Date): Date {
  const utcDate = toUtcDateOnly(date);
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() - day + 1);
  return utcDate;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatDateLabel(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function getIsoWeekParts(date: Date): { year: number; week: number } {
  const monday = startOfIsoWeek(date);
  const thursday = new Date(monday);
  thursday.setUTCDate(thursday.getUTCDate() + 3);

  const isoYear = thursday.getUTCFullYear();
  const firstWeekStart = startOfIsoWeek(new Date(Date.UTC(isoYear, 0, 4)));
  const week = Math.round((monday.getTime() - firstWeekStart.getTime()) / MS_PER_WEEK) + 1;

  return { year: isoYear, week };
}

export function getLastCompletedWeekValue(now: Date = new Date()): string {
  const currentWeekStart = startOfIsoWeek(now);
  currentWeekStart.setUTCDate(currentWeekStart.getUTCDate() - 7);
  const { year, week } = getIsoWeekParts(currentWeekStart);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function weekValueToWeekStartIso(value: string): string {
  const match = /^(\d{4})-W(\d{2})$/.exec(value);

  if (!match) {
    return "";
  }

  const year = Number(match[1]);
  const week = Number(match[2]);
  const firstWeekStart = startOfIsoWeek(new Date(Date.UTC(year, 0, 4)));
  const selectedWeekStart = new Date(firstWeekStart);
  selectedWeekStart.setUTCDate(selectedWeekStart.getUTCDate() + (week - 1) * 7);

  return toIsoDate(selectedWeekStart);
}

export function describeWeekRange(value: string): string | null {
  const weekStartIso = weekValueToWeekStartIso(value);

  if (!weekStartIso) {
    return null;
  }

  const weekStart = new Date(`${weekStartIso}T00:00:00.000Z`);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);

  return `${formatDateLabel(weekStart)} to ${formatDateLabel(weekEnd)}`;
}
