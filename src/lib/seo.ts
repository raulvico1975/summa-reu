import type { Metadata } from "next";
import type { I18nLocale } from "@/src/i18n/config";
import { withLocalePath } from "@/src/i18n/routing";

export function absoluteBaseUrl(): string {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_CANONICAL_URL ??
    process.env.CANONICAL_URL ??
    `https://${process.env.CANONICAL_HOST ?? "summareu.app"}`;

  return configured.replace(/\/+$/, "");
}

export function buildAbsolutePublicUrl(locale: I18nLocale, path: string): string {
  return `${absoluteBaseUrl()}${withLocalePath(locale, path)}`;
}

export function localizedPublicMetadata(input: {
  locale: I18nLocale;
  path: string;
  title?: string;
  description?: string;
  robots?: Metadata["robots"];
}): Metadata {
  const base = absoluteBaseUrl();
  const canonicalPath = withLocalePath(input.locale, input.path);
  const canonicalUrl = `${base}${canonicalPath}`;
  const caPath = withLocalePath("ca", input.path);
  const esPath = withLocalePath("es", input.path);
  const title = input.title ?? "Summa Reu";
  const description = input.description ?? "";

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
      languages: {
        ca: `${base}${caPath}`,
        es: `${base}${esPath}`,
        "x-default": `${base}${caPath}`,
      },
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: "Summa Reu",
      locale: input.locale === "es" ? "es_ES" : "ca_ES",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: input.robots,
  };
}
