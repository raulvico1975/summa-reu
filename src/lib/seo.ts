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
  alternatePaths?: Partial<Record<I18nLocale | "x-default", string>>;
  title?: string;
  description?: string;
  keywords?: string[];
  imagePath?: string;
  openGraphType?: "website" | "article";
  robots?: Metadata["robots"];
}): Metadata {
  const base = absoluteBaseUrl();
  const canonicalPath = withLocalePath(input.locale, input.path);
  const canonicalUrl = `${base}${canonicalPath}`;
  const caPath = withLocalePath("ca", input.alternatePaths?.ca ?? input.path);
  const esPath = withLocalePath("es", input.alternatePaths?.es ?? input.path);
  const defaultPath = withLocalePath("ca", input.alternatePaths?.["x-default"] ?? input.alternatePaths?.ca ?? input.path);
  const title = input.title ?? "Summa Reu";
  const description = input.description ?? "";
  const imageUrl = input.imagePath
    ? `${base}${input.imagePath.startsWith("/") ? input.imagePath : `/${input.imagePath}`}`
    : undefined;

  return {
    title,
    description,
    keywords: input.keywords,
    alternates: {
      canonical: canonicalUrl,
      languages: {
        ca: `${base}${caPath}`,
        es: `${base}${esPath}`,
        "x-default": `${base}${defaultPath}`,
      },
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: "Summa Reu",
      locale: input.locale === "es" ? "es_ES" : "ca_ES",
      type: input.openGraphType ?? "website",
      images: imageUrl ? [{ url: imageUrl }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
    robots: input.robots,
  };
}
