'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { PublicLocale } from '@/lib/public-locale';
import {
  getPublicContactMethod,
  isValidGaMeasurementId,
  readPublicAnalyticsConsent,
  trackPublicAnalyticsEvent,
  writePublicAnalyticsConsent,
  type PublicAnalyticsConsent,
} from '@/lib/public-analytics';

const CONSENT_COPY: Record<
  PublicLocale,
  {
    title: string;
    description: string;
    accept: string;
    reject: string;
    privacy: string;
  }
> = {
  ca: {
    title: 'Analítica del web',
    description:
      'Ens ajuda a saber quines pàgines són útils i si les visites acaben en una consulta. No enviem a l’analítica el nom, el correu ni el missatge dels formularis.',
    accept: 'Acceptar analítica',
    reject: 'Continuar sense analítica',
    privacy: 'Més informació',
  },
  es: {
    title: 'Analítica de la web',
    description:
      'Nos ayuda a saber qué páginas son útiles y si las visitas terminan en una consulta. No enviamos a la analítica el nombre, el correo ni el mensaje de los formularios.',
    accept: 'Aceptar analítica',
    reject: 'Continuar sin analítica',
    privacy: 'Más información',
  },
  fr: {
    title: 'Analyse du site',
    description:
      'Elle nous aide à comprendre quelles pages sont utiles et si les visites aboutissent à une demande. Le nom, l’adresse e-mail et le message des formulaires ne sont pas envoyés.',
    accept: 'Accepter l’analyse',
    reject: 'Continuer sans analyse',
    privacy: 'En savoir plus',
  },
  pt: {
    title: 'Analítica do site',
    description:
      'Ajuda-nos a perceber quais páginas são úteis e se as visitas resultam num contacto. O nome, o email e a mensagem dos formulários não são enviados.',
    accept: 'Aceitar analítica',
    reject: 'Continuar sem analítica',
    privacy: 'Mais informação',
  },
};

interface PublicAnalyticsProps {
  locale: PublicLocale;
  measurementId?: string;
}

export function PublicAnalytics({ locale, measurementId = '' }: PublicAnalyticsProps) {
  const enabled = isValidGaMeasurementId(measurementId);
  const normalizedMeasurementId = measurementId.trim();
  const [consent, setConsent] = useState<PublicAnalyticsConsent | null>(null);
  const [preferenceLoaded, setPreferenceLoaded] = useState(false);
  const copy = CONSENT_COPY[locale];

  useEffect(() => {
    if (!enabled) return;
    setConsent(readPublicAnalyticsConsent());
    setPreferenceLoaded(true);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || consent !== 'granted') return;

    function handleDocumentClick(event: MouseEvent) {
      if (!(event.target instanceof Element)) return;

      const anchor = event.target.closest<HTMLAnchorElement>('a[href]');
      if (!anchor) return;

      const method = getPublicContactMethod(anchor.getAttribute('href') || '');
      if (!method) return;

      trackPublicAnalyticsEvent('contact_intent', {
        contact_method: method,
        locale,
        page_path: window.location.pathname,
      });
    }

    document.addEventListener('click', handleDocumentClick, { capture: true });
    return () => document.removeEventListener('click', handleDocumentClick, { capture: true });
  }, [consent, enabled, locale]);

  if (!enabled) return null;

  function chooseConsent(value: PublicAnalyticsConsent) {
    writePublicAnalyticsConsent(value);
    setConsent(value);
  }

  return (
    <>
      {consent === 'granted' ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${normalizedMeasurementId}`}
            strategy="afterInteractive"
          />
          <Script id="summa-google-analytics" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = gtag;
              gtag('consent', 'default', {
                analytics_storage: 'granted',
                ad_storage: 'denied',
                ad_user_data: 'denied',
                ad_personalization: 'denied'
              });
              gtag('js', new Date());
              gtag('config', ${JSON.stringify(normalizedMeasurementId)}, {
                allow_google_signals: false,
                allow_ad_personalization_signals: false
              });
            `}
          </Script>
        </>
      ) : null}

      {preferenceLoaded && consent === null ? (
        <aside
          aria-label={copy.title}
          className="fixed inset-x-4 bottom-4 z-[100] mx-auto max-w-3xl rounded-2xl border border-border/70 bg-background/98 p-5 shadow-2xl backdrop-blur"
        >
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="font-semibold text-foreground">{copy.title}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{copy.description}</p>
              <a
                href={`/${locale}/privacy#analitica-web`}
                className="mt-2 inline-flex text-sm font-medium text-primary hover:underline"
              >
                {copy.privacy}
              </a>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row md:flex-col">
              <Button type="button" onClick={() => chooseConsent('granted')}>
                {copy.accept}
              </Button>
              <Button type="button" variant="outline" onClick={() => chooseConsent('denied')}>
                {copy.reject}
              </Button>
            </div>
          </div>
        </aside>
      ) : null}
    </>
  );
}
