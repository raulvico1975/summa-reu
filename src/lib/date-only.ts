/**
 * Helpers for values whose calendar date is part of the business contract.
 *
 * Fiscal and bank dates are stored as YYYY-MM-DD or as ISO values beginning
 * with YYYY-MM-DD. Their calendar year/month must not depend on the runtime
 * timezone used to parse the value.
 */
const DATE_PREFIX_RE = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/;

export function getCalendarDateParts(value: unknown): { year: number; month: number; day: number } | null {
  if (typeof value === 'string') {
    const match = DATE_PREFIX_RE.exec(value.trim());
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return { year, month, day };
      }
    }
  }

  const date = value instanceof Date
    ? value
    : typeof value === 'number'
      ? new Date(value)
      : value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function'
        ? value.toDate()
        : null;

  if (!date || Number.isNaN(date.getTime())) return null;
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

export function getCalendarYear(value: unknown): number | null {
  return getCalendarDateParts(value)?.year ?? null;
}

export function getCalendarMonth(value: unknown): number | null {
  return getCalendarDateParts(value)?.month ?? null;
}
