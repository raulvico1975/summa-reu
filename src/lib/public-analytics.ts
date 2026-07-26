export const PUBLIC_ANALYTICS_CONSENT_KEY = 'summa_public_analytics_consent_v1';

export type PublicAnalyticsConsent = 'granted' | 'denied';
export type PublicContactMethod = 'contact_page' | 'email' | 'phone' | 'whatsapp';
export type PublicAnalyticsEventName = 'contact_intent' | 'generate_lead';
export type PublicAnalyticsEventParams = Record<
  string,
  string | number | boolean | null | undefined
>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function isValidGaMeasurementId(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^G-[A-Z0-9]{6,20}$/.test(value.trim());
}

export function readPublicAnalyticsConsent(): PublicAnalyticsConsent | null {
  if (typeof window === 'undefined') return null;

  try {
    const value = window.localStorage.getItem(PUBLIC_ANALYTICS_CONSENT_KEY);
    return value === 'granted' || value === 'denied' ? value : null;
  } catch {
    return null;
  }
}

export function writePublicAnalyticsConsent(consent: PublicAnalyticsConsent): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(PUBLIC_ANALYTICS_CONSENT_KEY, consent);
  } catch {
    // A blocked localStorage must never break the public website.
  }
}

export function clearPublicAnalyticsConsent(): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(PUBLIC_ANALYTICS_CONSENT_KEY);
  } catch {
    // A blocked localStorage must never break the public website.
  }
}

export function getPublicContactMethod(href: string): PublicContactMethod | null {
  const normalizedHref = href.trim().toLowerCase();

  if (normalizedHref.startsWith('mailto:')) return 'email';
  if (normalizedHref.startsWith('tel:')) return 'phone';

  try {
    const url = new URL(href, 'https://summasocial.app');
    const hostname = url.hostname.toLowerCase();
    const pathname = url.pathname.replace(/\/+$/, '') || '/';

    if (hostname === 'wa.me' || hostname.endsWith('.whatsapp.com')) {
      return 'whatsapp';
    }

    if (
      hostname === 'summasocial.app' &&
      /^\/(?:ca|es|fr|pt)\/(?:contact|contacto)$/.test(pathname)
    ) {
      return 'contact_page';
    }
  } catch {
    return null;
  }

  return null;
}

export function trackPublicAnalyticsEvent(
  eventName: PublicAnalyticsEventName,
  params: PublicAnalyticsEventParams = {}
): boolean {
  if (typeof window === 'undefined') return false;
  if (readPublicAnalyticsConsent() !== 'granted') return false;
  if (typeof window.gtag !== 'function') return false;

  const safeParams = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null)
  );

  window.gtag('event', eventName, safeParams);
  return true;
}
