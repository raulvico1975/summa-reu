import { Timestamp } from "firebase-admin/firestore";
import { defaultLocale, toIntlLocale, type I18nLocale } from "@/src/i18n/config";

export function timestampToDate(value: Timestamp | Date | string | null | undefined): Date | null {
  if (!value) return null;

  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function formatDateTime(
  value: Timestamp | Date | string | null | undefined,
  locale: I18nLocale = defaultLocale
): string {
  const date = timestampToDate(value);
  if (!date) return "-";

  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Madrid",
  }).format(date);
}

export function toIso(value: Timestamp | Date | string | null | undefined): string {
  const date = timestampToDate(value);
  if (!date) return "";
  return date.toISOString();
}
