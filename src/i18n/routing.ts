import {
  defaultLocale,
  detectLocaleFromAcceptLanguage,
  isI18nLocale,
  normalizeLocale,
  type I18nLocale,
} from "@/src/i18n/config";

export function extractLocaleFromPathname(pathname: string): I18nLocale | null {
  const firstSegment = pathname.split("/")[1] ?? "";
  if (!isI18nLocale(firstSegment)) {
    return null;
  }

  return firstSegment;
}

export function stripLocalePrefix(pathname: string): string {
  const locale = extractLocaleFromPathname(pathname);
  if (!locale) {
    return pathname || "/";
  }

  const stripped = pathname.replace(new RegExp(`^/${locale}(?=/|$)`), "");
  return stripped || "/";
}

export function withLocalePath(locale: I18nLocale, path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const cleanedPath = stripLocalePrefix(normalizedPath);
  return cleanedPath === "/" ? `/${locale}` : `/${locale}${cleanedPath}`;
}

export function resolvePreferredLocale(input: {
  pathname?: string | null;
  cookieLocale?: string | null;
  acceptLanguage?: string | null;
}): I18nLocale {
  const localeFromPath = extractLocaleFromPathname(input.pathname ?? "");
  if (localeFromPath) return localeFromPath;

  if (input.cookieLocale) return normalizeLocale(input.cookieLocale);
  if (!input.acceptLanguage) return defaultLocale;
  return detectLocaleFromAcceptLanguage(input.acceptLanguage);
}
