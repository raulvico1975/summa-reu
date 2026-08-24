'use client';

import * as React from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ManualMarkdownDocument } from '@/components/help/ManualMarkdownDocument';
import { extractToc } from '@/lib/help/manual-toc';
import { useTranslations } from '@/i18n';

// UI strings per idioma
const UI_STRINGS = {
  ca: {
    title: "Manual d'usuari",
    subtitle: 'Referencia completa per fer servir Summa Social sense suport.',
    openNewTab: 'Obrir en una pestanya nova',
    loading: 'Carregant manual...',
    toc: 'Continguts',
    backToTop: 'Tornar a dalt',
  },
  es: {
    title: 'Manual de usuario',
    subtitle: 'Referencia completa para usar Summa Social sin soporte.',
    openNewTab: 'Abrir en una pestana nueva',
    loading: 'Cargando manual...',
    toc: 'Contenidos',
    backToTop: 'Volver arriba',
  },
  fr: {
    title: "Manuel d'utilisateur",
    subtitle: 'Reference complete pour utiliser Summa Social sans support.',
    openNewTab: 'Ouvrir dans un nouvel onglet',
    loading: 'Chargement du manuel...',
    toc: 'Sommaire',
    backToTop: 'Retour en haut',
  },
} as const;

function shouldFallbackToCatalan(locale: 'ca' | 'es' | 'fr', text: string): boolean {
  if (locale === 'ca') return false;
  const toc = extractToc(text);
  if (toc.length < 8) return true;
  if (!toc.some((entry) => entry.id === '11-resolucio-de-problemes')) return true;
  // FIX (auditoria 2026-08-23): un manual "esquelet" amb les àncrees de
  // navegació però contingut mínim no és útil. Comparem amb una mida
  // referencial: el manual complet té ordre de 90 KB; un esquelet, ~10 KB.
  if (text.trim().length < 40_000) return true;
  return false;
}

/**
 * Fetch manual with locale fallback to CA.
 * Falls back not only on 404 but also on placeholder manuals without enough anchors.
 */
async function fetchManualWithFallback(locale: 'ca' | 'es' | 'fr'): Promise<{ text: string; sourceLocale: 'ca' | 'es' | 'fr' }> {
  const basePath = '/docs/manual-usuari-summa-social';
  const localePath = `${basePath}.${locale}.md`;
  const fallbackPath = `${basePath}.ca.md`;

  if (locale !== 'ca') {
    const res = await fetch(localePath);
    if (res.ok) {
      const text = await res.text();
      if (!shouldFallbackToCatalan(locale, text)) {
        return { text, sourceLocale: locale };
      }
    }
  }

  const fallbackRes = await fetch(fallbackPath);
  if (!fallbackRes.ok) {
    throw new Error('No s\'ha pogut carregar el manual');
  }
  return {
    text: await fallbackRes.text(),
    sourceLocale: 'ca',
  };
}

export default function ManualPage() {
  const { language } = useTranslations();
  const [content, setContent] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [sourceLocale, setSourceLocale] = React.useState<'ca' | 'es' | 'fr'>('ca');

  // pt fa fallback a ca (UI_STRINGS i manual només tenen ca/es/fr)
  const contentLang = language === 'pt' ? 'ca' : language;
  const ui = UI_STRINGS[contentLang];

  React.useEffect(() => {
    fetchManualWithFallback(contentLang)
      .then(({ text, sourceLocale }) => {
        setContent(text);
        setSourceLocale(sourceLocale);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [contentLang]);

  const handleOpenInNewTab = () => {
    window.open(`/docs/manual-usuari-summa-social.${sourceLocale}.md`, '_blank');
  };

  return (
    <div id="top" className="container max-w-4xl py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{ui.title}</h1>
            <p className="text-muted-foreground mt-1">
              {ui.subtitle}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleOpenInNewTab}>
            <ExternalLink className="h-4 w-4 mr-2" />
            {ui.openNewTab}
          </Button>
        </div>
      </div>
      {loading && (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">{ui.loading}</p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <p className="text-destructive">{error}</p>
        </div>
      )}

      {content && (
        <ManualMarkdownDocument
          markdown={content}
          tocLabel={ui.toc}
          backToTopLabel={ui.backToTop}
        />
      )}
    </div>
  );
}
