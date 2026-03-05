import type { NextRequest } from "next/server";
import { getI18n } from "@/src/i18n";
import {
  detectLocaleFromAcceptLanguage,
  localeCookieName,
  normalizeLocale,
  type I18nLocale,
} from "@/src/i18n/config";

export function getRequestLocaleFromNextRequest(request: NextRequest): I18nLocale {
  const localeFromMiddleware = request.headers.get("x-summa-locale");
  if (localeFromMiddleware) {
    return normalizeLocale(localeFromMiddleware);
  }

  const localeFromCookie = request.cookies.get(localeCookieName)?.value;
  if (localeFromCookie) {
    return normalizeLocale(localeFromCookie);
  }

  return detectLocaleFromAcceptLanguage(request.headers.get("accept-language"));
}

export function getRequestI18nFromNextRequest(request: NextRequest): {
  locale: I18nLocale;
  i18n: ReturnType<typeof getI18n>;
} {
  const locale = getRequestLocaleFromNextRequest(request);
  return { locale, i18n: getI18n(locale) };
}
