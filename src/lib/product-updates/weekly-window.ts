export interface WeeklyWindow {
  weekStart: string;
  weekEnd: string;
  weekStartLabel: string;
  weekEndLabel: string;
}

type LocalDateParts = {
  year: number;
  month: number;
  day: number;
};

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function formatLocalDate(parts: LocalDateParts): string {
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

function getLocalDateParts(date: Date, timeZone: string): LocalDateParts {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);

  const year = Number(parts.find((part) => part.type === 'year')?.value ?? 0);
  const month = Number(parts.find((part) => part.type === 'month')?.value ?? 0);
  const day = Number(parts.find((part) => part.type === 'day')?.value ?? 0);

  return { year, month, day };
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'longOffset',
    hour: '2-digit',
    minute: '2-digit',
  });
  const zoneName = formatter
    .formatToParts(date)
    .find((part) => part.type === 'timeZoneName')
    ?.value;

  if (!zoneName || zoneName === 'GMT') {
    return 0;
  }

  const match = zoneName.match(/^GMT([+-])(\d{2}):(\d{2})$/);
  if (!match) {
    throw new Error(`Unsupported timezone offset format: ${zoneName}`);
  }

  const [, sign, hoursRaw, minutesRaw] = match;
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  const totalMs = ((hours * 60) + minutes) * 60 * 1000;
  return sign === '-' ? -totalMs : totalMs;
}

function toUtcDate(
  parts: LocalDateParts,
  timeZone: string,
  hour: number,
  minute: number,
  second: number,
  millisecond: number
): Date {
  const baseUtcMs = Date.UTC(parts.year, parts.month - 1, parts.day, hour, minute, second, millisecond);
  let candidate = new Date(baseUtcMs);

  for (let iteration = 0; iteration < 3; iteration += 1) {
    const offsetMs = getTimeZoneOffsetMs(candidate, timeZone);
    const nextCandidate = new Date(baseUtcMs - offsetMs);
    if (nextCandidate.getTime() === candidate.getTime()) {
      return nextCandidate;
    }
    candidate = nextCandidate;
  }

  return candidate;
}

function shiftLocalDate(parts: LocalDateParts, days: number): LocalDateParts {
  const anchor = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  anchor.setUTCDate(anchor.getUTCDate() + days);
  return {
    year: anchor.getUTCFullYear(),
    month: anchor.getUTCMonth() + 1,
    day: anchor.getUTCDate(),
  };
}

function getLocalIsoWeekday(parts: LocalDateParts): number {
  const day = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
  return day === 0 ? 7 : day;
}

export function buildPreviousWeeklyWindow(
  referenceDate: Date = new Date(),
  timeZone: string = 'Europe/Madrid'
): WeeklyWindow {
  const localToday = getLocalDateParts(referenceDate, timeZone);
  const isoWeekday = getLocalIsoWeekday(localToday);
  const currentWeekStart = shiftLocalDate(localToday, -(isoWeekday - 1));
  const previousWeekStart = shiftLocalDate(currentWeekStart, -7);
  const previousWeekEnd = shiftLocalDate(currentWeekStart, -1);

  const weekStartDate = toUtcDate(previousWeekStart, timeZone, 0, 0, 0, 0);
  const weekEndDate = toUtcDate(previousWeekEnd, timeZone, 23, 59, 59, 999);

  return {
    weekStart: weekStartDate.toISOString(),
    weekEnd: weekEndDate.toISOString(),
    weekStartLabel: formatLocalDate(previousWeekStart),
    weekEndLabel: formatLocalDate(previousWeekEnd),
  };
}
