import { cookies, headers } from "next/headers";
import { getI18n } from "@/src/i18n";
import {
  detectLocaleFromAcceptLanguage,
  localeCookieName,
  normalizeLocale,
  type I18nLocale,
} from "@/src/i18n/config";

export async function getRequestLocale(): Promise<I18nLocale> {
  const headerStore = await headers();
  const localeFromMiddleware = headerStore.get("x-summa-locale");
  if (localeFromMiddleware) {
    return normalizeLocale(localeFromMiddleware);
  }

  const cookieStore = await cookies();
  const localeFromCookie = cookieStore.get(localeCookieName)?.value;
  if (localeFromCookie) {
    return normalizeLocale(localeFromCookie);
  }

  return detectLocaleFromAcceptLanguage(headerStore.get("accept-language"));
}

export async function getRequestI18n(): Promise<{ locale: I18nLocale; i18n: ReturnType<typeof getI18n> }> {
  const locale = await getRequestLocale();
  return { locale, i18n: getI18n(locale) };
}
