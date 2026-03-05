export const locales = ["ca", "es"] as const;
export type I18nLocale = (typeof locales)[number];

export const defaultLocale: I18nLocale = "ca";
export const localeCookieName = "summa-locale";

export function isI18nLocale(value: string | null | undefined): value is I18nLocale {
  return value === "ca" || value === "es";
}

export function normalizeLocale(value: string | null | undefined): I18nLocale {
  const normalized = value?.toLowerCase();
  return isI18nLocale(normalized) ? normalized : defaultLocale;
}

export function detectLocaleFromAcceptLanguage(value: string | null | undefined): I18nLocale {
  if (!value) {
    return defaultLocale;
  }

  const preferences = value
    .split(",")
    .map((item) => item.split(";")[0]?.trim().toLowerCase())
    .filter((item): item is string => Boolean(item));

  for (const preference of preferences) {
    if (preference === "ca" || preference.startsWith("ca-")) return "ca";
    if (preference === "es" || preference.startsWith("es-")) return "es";
  }

  return defaultLocale;
}

export function toIntlLocale(locale: I18nLocale): string {
  return locale === "es" ? "es-ES" : "ca-ES";
}
