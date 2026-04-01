import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { localeCookieName } from "@/src/i18n/config";
import { areSectionsComplete, getNoFallbackSectionsForPath } from "@/src/i18n/coverage";
import { resolvePreferredLocale, stripLocalePrefix, withLocalePath } from "@/src/i18n/routing";
import { DEFAULT_DEMO_OWNER_UID } from "@/src/lib/firebase/demo-session";

const CANONICAL_HOST = process.env.CANONICAL_HOST ?? "summareu.app";
const FORCE_CANONICAL_REDIRECT = process.env.FORCE_CANONICAL_REDIRECT !== "false";
const DEMO_SESSION_COOKIE_NAME = "summareu_demo_session";
const STATIC_FILE_REGEX = /\.[a-zA-Z0-9]+$/;

function isLocalHost(host: string): boolean {
  return host.startsWith("127.0.0.1") || host.startsWith("localhost");
}

function isExcludedPath(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/favicon.ico" ||
    pathname === "/icon.svg" ||
    STATIC_FILE_REGEX.test(pathname)
  );
}

function withLocaleCookie(response: NextResponse, locale: "ca" | "es", secure: boolean): NextResponse {
  response.cookies.set(localeCookieName, locale, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    secure,
  });
  return response;
}

function enforceNoFallbackLocale(locale: "ca" | "es", strippedPathname: string): "ca" | "es" {
  if (locale !== "es") {
    return locale;
  }

  const requiredSections = getNoFallbackSectionsForPath(strippedPathname);
  if (!requiredSections) {
    return locale;
  }

  return areSectionsComplete(locale, requiredSections) ? locale : "ca";
}

export function middleware(request: NextRequest) {
  const host =
    request.headers.get("x-fh-requested-host")?.toLowerCase() ??
    request.headers.get("x-forwarded-host")?.toLowerCase() ??
    request.headers.get("host")?.toLowerCase() ??
    "";
  const localRequest = isLocalHost(request.nextUrl.hostname.toLowerCase()) || (host ? isLocalHost(host) : false);
  const useSecureCookies = process.env.NODE_ENV === "production" && !localRequest;

  if (FORCE_CANONICAL_REDIRECT) {
    if (host && !isLocalHost(host) && host !== CANONICAL_HOST) {
      if (host.endsWith(".web.app") || host.endsWith(".firebaseapp.com")) {
        const nextUrl = request.nextUrl.clone();
        nextUrl.protocol = "https";
        nextUrl.hostname = CANONICAL_HOST;
        nextUrl.port = "";
        return NextResponse.redirect(nextUrl, 308);
      }
    }
  }

  const { pathname } = request.nextUrl;
  if (isExcludedPath(pathname)) {
    return NextResponse.next();
  }

  if (request.headers.get("x-summa-locale")) {
    return NextResponse.next();
  }

  const strippedPathname = stripLocalePrefix(pathname);
  const localeFromPath = resolvePreferredLocale({ pathname });
  const hasLocalePrefix = pathname !== strippedPathname;

  if (localRequest && strippedPathname === "/demo") {
    const redirectUrl = new URL(withLocalePath(localeFromPath, "/dashboard"), request.url);

    const response = withLocaleCookie(NextResponse.redirect(redirectUrl, 307), localeFromPath, useSecureCookies);
    response.cookies.set(DEMO_SESSION_COOKIE_NAME, `demo:${DEFAULT_DEMO_OWNER_UID}`, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      secure: useSecureCookies,
    });
    return response;
  }

  if (hasLocalePrefix) {
    const finalLocale = enforceNoFallbackLocale(localeFromPath, strippedPathname);
    if (finalLocale !== localeFromPath) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = withLocalePath(finalLocale, strippedPathname);
      return withLocaleCookie(NextResponse.redirect(redirectUrl, 307), finalLocale, useSecureCookies);
    }

    const rewrittenUrl = request.nextUrl.clone();
    rewrittenUrl.pathname = strippedPathname;

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-summa-locale", finalLocale);

    return withLocaleCookie(
      NextResponse.rewrite(rewrittenUrl, {
        request: { headers: requestHeaders },
      }),
      finalLocale,
      useSecureCookies
    );
  }

  const resolvedLocale = resolvePreferredLocale({
    cookieLocale: request.cookies.get(localeCookieName)?.value ?? null,
    acceptLanguage: request.headers.get("accept-language"),
  });
  const finalLocale = enforceNoFallbackLocale(resolvedLocale, strippedPathname);

  // In local dev, keep stable non-localized URLs ("/", "/login", etc.)
  // while preserving locale context via header + cookie.
  if (localRequest) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-summa-locale", finalLocale);
    return withLocaleCookie(
      NextResponse.next({
        request: { headers: requestHeaders },
      }),
      finalLocale,
      useSecureCookies
    );
  }

  const localizedUrl = request.nextUrl.clone();
  localizedUrl.pathname = withLocalePath(finalLocale, strippedPathname);
  return withLocaleCookie(NextResponse.redirect(localizedUrl, 307), finalLocale, useSecureCookies);
}

export const config = {
  matcher: ["/:path*"],
};
