'use client';

import * as React from 'react';
import { ExternalLink, ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { extractToc, parseMarkdownWithIds } from '@/lib/help/manual-toc';
import type { TocEntry, RenderedLine } from '@/lib/help/manual-toc';
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

/**
 * Fetch manual with locale fallback to CA.
 * Tries locale-specific file first, falls back to .ca.md if 404.
 */
async function fetchManualWithFallback(locale: 'ca' | 'es' | 'fr'): Promise<string> {
  const basePath = '/docs/manual-usuari-summa-social';
  const localePath = `${basePath}.${locale}.md`;
  const fallbackPath = `${basePath}.ca.md`;

  // Try locale-specific file first
  const res = await fetch(localePath);
  if (res.ok) {
    return res.text();
  }

  // Fallback to CA
  const fallbackRes = await fetch(fallbackPath);
  if (!fallbackRes.ok) {
    throw new Error('No s\'ha pogut carregar el manual');
  }
  return fallbackRes.text();
}

export default function ManualPage() {
  const { language } = useTranslations();
  const [content, setContent] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [toc, setToc] = React.useState<TocEntry[]>([]);
  const [parsedContent, setParsedContent] = React.useState<RenderedLine[]>([]);

  // pt fa fallback a ca (UI_STRINGS i manual només tenen ca/es/fr)
  const contentLang = language === 'pt' ? 'ca' : language;
  const ui = UI_STRINGS[contentLang];

  React.useEffect(() => {
    fetchManualWithFallback(contentLang)
      .then((text) => {
        setContent(text);
        setToc(extractToc(text));
        setParsedContent(parseMarkdownWithIds(text));
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [contentLang]);

  const handleOpenInNewTab = () => {
    window.open(`/docs/manual-usuari-summa-social.${contentLang}.md`, '_blank');
  };

  // Padding segons nivell del TOC
  const getTocPadding = (level: 1 | 2 | 3) => {
    switch (level) {
      case 1:
        return 'pl-0';
      case 2:
        return 'pl-3';
      case 3:
        return 'pl-6';
    }
  };

  // Classes per headings
  const getHeadingClasses = (level: 1 | 2 | 3) => {
    switch (level) {
      case 1:
        return 'text-xl font-bold mt-8 mb-4 scroll-mt-24';
      case 2:
        return 'text-lg font-semibold mt-6 mb-3 scroll-mt-24';
      case 3:
        return 'text-base font-medium mt-4 mb-2 scroll-mt-24';
    }
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
        <>
          {/* Taula de continguts */}
          {toc.length > 0 && (
            <div className="rounded-lg border bg-muted/30 p-4 mb-8">
              <h2 className="font-semibold mb-3">{ui.toc}</h2>
              <nav className="space-y-1">
                {toc.map((entry, index) => (
                  <a
                    key={`${entry.id}-${index}`}
                    href={`#${entry.id}`}
                    className={`block text-sm text-muted-foreground hover:text-foreground hover:underline ${getTocPadding(entry.level)}`}
                  >
                    {entry.text}
                  </a>
                ))}
              </nav>
            </div>
          )}

          {/* Cos del manual */}
          <div className="rounded-lg border bg-muted/30 p-6">
            {parsedContent.map((line, index) => {
              if (line.type === 'heading') {
                const Tag = line.level === 1 ? 'h2' : line.level === 2 ? 'h3' : 'h4';
                return (
                  <Tag
                    key={index}
                    id={line.id}
                    className={getHeadingClasses(line.level)}
                  >
                    {line.text}
                  </Tag>
                );
              }

              if (line.type === 'empty') {
                return <div key={index} className="h-3" />;
              }

              // text
              return (
                <p
                  key={index}
                  className="text-sm leading-6 text-muted-foreground whitespace-pre-wrap"
                >
                  {line.content}
                </p>
              );
            })}
          </div>

          {/* Botó tornar a dalt */}
          <div className="mt-6 flex justify-center">
            <Button variant="ghost" size="sm" asChild>
              <a href="#top">
                <ArrowUp className="h-4 w-4 mr-2" />
                {ui.backToTop}
              </a>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
