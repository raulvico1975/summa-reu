type RecordLike = Record<string, unknown>;

export type ProductUpdateContentLocale = 'ca' | 'es';

export interface ProductUpdateAppCopy {
  locale: ProductUpdateContentLocale;
  title: string;
  body: string;
  contentLong: string | null;
  ctaLabel: string | null;
}

export interface ProductUpdatePublicCopy {
  locale: ProductUpdateContentLocale;
  title: string;
  excerpt: string | null;
  content: string | null;
}

function isRecord(value: unknown): value is RecordLike {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function getNestedRecord(source: RecordLike | null, key: string): RecordLike | null {
  if (!source) return null;
  const value = source[key];
  return isRecord(value) ? value : null;
}

function readLocalizedString(source: RecordLike | null, key: string): string | null {
  return source ? asNonEmptyString(source[key]) : null;
}

export function getEffectiveProductUpdateLocale(
  locale?: string | null
): ProductUpdateContentLocale {
  if (!locale || locale === 'ca') return 'ca';
  return 'es';
}

export function getBaseProductUpdateLocale(
  locale?: string | null
): ProductUpdateContentLocale {
  return locale === 'es' ? 'es' : 'ca';
}

export function resolveAppProductUpdateCopy(
  raw: unknown,
  locale?: string | null
): ProductUpdateAppCopy | null {
  if (!isRecord(raw)) return null;

  const effectiveLocale = getEffectiveProductUpdateLocale(locale);
  const baseLocale = getBaseProductUpdateLocale(asNonEmptyString(raw.locale));
  const localizedApp = getNestedRecord(getNestedRecord(raw, 'locales'), effectiveLocale);
  const web = getNestedRecord(raw, 'web');
  const localizedWeb = getNestedRecord(getNestedRecord(web, 'locales'), effectiveLocale);

  const baseTitle = asNonEmptyString(raw.title) ?? readLocalizedString(web, 'title');
  if (!baseTitle) return null;

  const baseBody =
    asNonEmptyString(raw.description) ??
    asNonEmptyString(raw.body) ??
    readLocalizedString(web, 'excerpt') ??
    '';

  const baseContentLong =
    asNonEmptyString(raw.contentLong) ??
    readLocalizedString(web, 'content') ??
    null;

  const baseCtaLabel = asNonEmptyString(raw.ctaLabel);

  return {
    locale: effectiveLocale === baseLocale || localizedApp || localizedWeb ? effectiveLocale : baseLocale,
    title:
      readLocalizedString(localizedApp, 'title') ??
      readLocalizedString(localizedWeb, 'title') ??
      baseTitle,
    body:
      readLocalizedString(localizedApp, 'description') ??
      readLocalizedString(localizedApp, 'body') ??
      readLocalizedString(localizedWeb, 'excerpt') ??
      baseBody,
    contentLong:
      readLocalizedString(localizedApp, 'contentLong') ??
      readLocalizedString(localizedWeb, 'content') ??
      baseContentLong,
    ctaLabel:
      readLocalizedString(localizedApp, 'ctaLabel') ??
      baseCtaLabel,
  };
}

export function resolvePublicProductUpdateCopy(
  raw: unknown,
  locale?: string | null
): ProductUpdatePublicCopy | null {
  if (!isRecord(raw)) return null;

  const web = getNestedRecord(raw, 'web');
  if (!web || web.enabled !== true) return null;

  const effectiveLocale = getEffectiveProductUpdateLocale(locale);
  const baseLocale = getBaseProductUpdateLocale(
    asNonEmptyString(web.locale) ?? asNonEmptyString(raw.locale)
  );
  const localizedWeb = getNestedRecord(getNestedRecord(web, 'locales'), effectiveLocale);
  const canUseBaseCopy = effectiveLocale === baseLocale;

  if (!canUseBaseCopy && !localizedWeb) {
    return null;
  }

  const title =
    readLocalizedString(localizedWeb, 'title') ??
    readLocalizedString(web, 'title') ??
    asNonEmptyString(raw.title);

  if (!title) return null;

  return {
    locale: canUseBaseCopy ? baseLocale : effectiveLocale,
    title,
    excerpt:
      readLocalizedString(localizedWeb, 'excerpt') ??
      readLocalizedString(web, 'excerpt') ??
      asNonEmptyString(raw.description),
    content:
      readLocalizedString(localizedWeb, 'content') ??
      readLocalizedString(web, 'content') ??
      asNonEmptyString(raw.contentLong),
  };
}
