'use client';

import * as React from 'react';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { HelpCircle, BookOpen, Link2, MessageSquare, ExternalLink, Play, AlertTriangle, CheckCircle2, XCircle, ClipboardCheck, RotateCcw, Layers, UserRound, Tag, FileText, Landmark, Sparkles, ListChecks, Upload, Filter, BadgeCheck, Workflow } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from '@/i18n';
import { getManualAnchorForRoute } from '@/help/help-manual-links';
import { trackUX } from '@/lib/ux/trackUX';
import { SUPPORT_EMAIL } from '@/lib/constants';
import { SUPER_ADMIN_UID } from '@/lib/data';
import { useFirebase } from '@/firebase';

// Extra section icons mapping
const EXTRA_SECTION_ICONS: Record<string, React.ReactNode> = {
  order: <CheckCircle2 className="h-4 w-4 text-green-600" />,
  flow: <Workflow className="h-4 w-4 text-blue-600" />,
  pitfalls: <AlertTriangle className="h-4 w-4 text-amber-600" />,
  whenNot: <XCircle className="h-4 w-4 text-slate-500" />,
  checks: <ClipboardCheck className="h-4 w-4 text-blue-600" />,
  returns: <RotateCcw className="h-4 w-4 text-amber-600" />,
  remittances: <Layers className="h-4 w-4 text-blue-600" />,
  contacts: <UserRound className="h-4 w-4 text-sky-600" />,
  categories: <Tag className="h-4 w-4 text-violet-600" />,
  documents: <FileText className="h-4 w-4 text-green-600" />,
  bankAccounts: <Landmark className="h-4 w-4 text-blue-600" />,
  ai: <Sparkles className="h-4 w-4 text-violet-500" />,
  bulk: <ListChecks className="h-4 w-4 text-slate-500" />,
  importing: <Upload className="h-4 w-4 text-teal-600" />,
  filters: <Filter className="h-4 w-4 text-slate-500" />,
  quality: <BadgeCheck className="h-4 w-4 text-emerald-600" />,
};

// Manual link hrefs (NOT translated - stay in code)
// Exported for use in /admin help audit
export const MANUAL_HREFS: Record<string, string> = {
  dashboard: '/dashboard/manual#14-entendre-el-dashboard',
  movimientos: '/dashboard/manual#5-gestio-de-moviments',
  movimientos_pendents: '/dashboard/manual#6b-documents-pendents',
  donants: '/dashboard/manual#3-gestio-de-donants',
  proveidors: '/dashboard/manual#4-gestio-de-proveidors-i-treballadors',
  treballadors: '/dashboard/manual#4-gestio-de-proveidors-i-treballadors',
  informes: '/dashboard/manual#9-informes-fiscals',
  configuracion: '/dashboard/manual#2-configuracio-inicial',
  project_expenses: '/dashboard/manual#6-assignacio-de-despeses',
  project_projects: '/dashboard/manual#6-gestio-de-projectes',
};

/**
 * Normalitza un pathname eliminant el segment orgSlug inicial.
 * Ex: /acme/dashboard/movimientos -> /dashboard/movimientos
 */
function normalizePathname(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length > 0 && parts[0] !== 'dashboard') {
    parts.shift();
  }
  return '/' + parts.join('/');
}

/**
 * Normalitza el routeKey per clau JSON
 * /dashboard/movimientos → movimientos
 * /dashboard/project-module/expenses → project_expenses
 * /dashboard/project-module/projects/abc123/budget → project_projects_id_budget
 */
function normalizeRouteKey(route: string): string {
  let key = route.replace(/^\/dashboard\//, '').replace(/^\//, '');

  if (key.startsWith('project-module/')) {
    key = key.replace('project-module/', 'project_');
  }

  // Substituir segments dinàmics (IDs) per 'id'
  // Patró: segment entre 'projects/' i el següent '/'
  key = key.replace(/projects\/[^/]+/g, 'projects/id');

  key = key.replace(/-/g, '_').replace(/\//g, '_');

  if (key === '' || route === '/dashboard') {
    key = 'dashboard';
  }

  return key;
}

/**
 * Highlights matching text with a <mark> tag.
 */
function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);

  if (index === -1) return text;

  const before = text.slice(0, index);
  const match = text.slice(index, index + query.length);
  const after = text.slice(index + query.length);

  return (
    <>
      {before}
      <mark className="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded">{match}</mark>
      {after}
    </>
  );
}

/**
 * Filters an array of strings by substring match.
 */
function filterByQuery(items: string[], query: string): string[] {
  if (!query.trim()) return items;
  const lowerQuery = query.toLowerCase();
  return items.filter((item) => item.toLowerCase().includes(lowerQuery));
}

/**
 * Extracts the orgSlug from a pathname.
 * E.g., /acme/dashboard/movimientos -> acme
 */
function getOrgSlug(pathname: string): string | null {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length > 0 && parts[0] !== 'dashboard') {
    return parts[0];
  }
  return null;
}

/**
 * Builds a manual URL with orgSlug, preserving any hash anchor.
 * E.g., /dashboard/manual#top + orgSlug="acme" -> /acme/dashboard/manual#top
 */
function buildManualUrl(href: string, orgSlug: string | null): string {
  const hashIndex = href.indexOf('#');
  const anchor = hashIndex !== -1 ? href.slice(hashIndex) : '';
  const base = orgSlug ? `/${orgSlug}/dashboard/manual` : '/dashboard/manual';
  return anchor ? `${base}${anchor}` : base;
}

/**
 * Helper to read array from tr()
 */
function getArray(tr: (key: string, fallback?: string) => string, prefix: string, maxItems = 20): string[] {
  const result: string[] = [];
  for (let i = 0; i < maxItems; i++) {
    const key = `${prefix}.${i}`;
    const value = tr(key);
    if (value === key) break;
    result.push(value);
  }
  return result;
}

export function HelpSheet() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const { language, tr } = useTranslations();
  const { user } = useFirebase();
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);

  // Ref to track how the sheet was opened
  const openSourceRef = React.useRef<'button' | 'deeplink'>('button');
  // Ref for search debounce timer
  const searchDebounceRef = React.useRef<NodeJS.Timeout | null>(null);

  const orgSlug = getOrgSlug(pathname);
  const routeKeyPath = normalizePathname(pathname);
  const routeKey = normalizeRouteKey(routeKeyPath);
  const prefix = `help.${routeKey}`;

  // SuperAdmin detection
  const isSuperAdmin = user?.uid === SUPER_ADMIN_UID;

  // Read help content from tr()
  const title = tr(`${prefix}.title`);
  const intro = tr(`${prefix}.intro`);
  const steps = getArray(tr, `${prefix}.steps`);
  const tips = getArray(tr, `${prefix}.tips`);

  // Read extra sections
  const extraSections = [
    'order',
    'flow',
    'pitfalls',
    'whenNot',
    'checks',
    'returns',
    'remittances',
    'contacts',
    'categories',
    'documents',
    'bankAccounts',
    'ai',
    'bulk',
    'importing',
    'filters',
    'quality',
  ];

  const extra: Record<string, { title: string; items: string[] }> = {};
  for (const section of extraSections) {
    const sectionTitle = tr(`${prefix}.extra.${section}.title`);
    const items = getArray(tr, `${prefix}.extra.${section}.items`);
    if (sectionTitle !== `${prefix}.extra.${section}.title` && items.length > 0) {
      extra[section] = { title: sectionTitle, items };
    }
  }

  // Manual/video links
  const manualLabel = tr(`${prefix}.extra.manual.label`);
  const hasManualLabel = manualLabel !== `${prefix}.extra.manual.label`;
  const videoLabel = tr(`${prefix}.extra.video.label`);
  const videoNote = tr(`${prefix}.extra.video.note`);
  const hasVideo = videoLabel !== `${prefix}.extra.video.label`;

  // UI strings
  const ui = {
    searchPlaceholder: tr('help.ui.searchPlaceholder'),
    viewManual: tr('help.ui.viewManual'),
    copyLink: tr('help.ui.copyLink'),
    suggest: tr('help.ui.suggest'),
    noHelp: tr('help.ui.noHelp'),
    noHelpNotPublished: tr('help.ui.noHelpNotPublished'),
    noHelpEditButton: tr('help.ui.noHelpEditButton'),
    noSteps: tr('help.ui.noSteps'),
    noResults: tr('help.ui.noResults'),
    linkCopied: tr('help.ui.linkCopied'),
    linkCopiedDesc: tr('help.ui.linkCopiedDesc'),
    steps: tr('help.ui.steps'),
    tips: tr('help.ui.tips'),
    tooltipHelp: tr('help.ui.tooltipHelp'),
  };

  // URLs
  const manualAnchor = getManualAnchorForRoute(routeKeyPath);
  const manualBase = orgSlug ? `/${orgSlug}/dashboard/manual` : '/dashboard/manual';
  const manualUrl = manualAnchor ? `${manualBase}#${manualAnchor}` : manualBase;
  const extraManualHref = MANUAL_HREFS[routeKey];

  // Check if we have help content
  const hasTitle = title !== `${prefix}.title`;
  const hasContent = hasTitle || steps.length > 0 || tips.length > 0;

  // Build feedback mailto URL
  const feedbackMailto = React.useMemo(() => {
    const subject = encodeURIComponent('Summa Social · Suggeriment d\'ajuda');
    const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
    const body = encodeURIComponent(
      `Pantalla: ${routeKeyPath}\n` +
      `URL: ${currentUrl}\n` +
      `Cerca a l'ajuda: ${query || '(cap)'}\n\n` +
      `Què faltava o què no s'entén?\n\n\n` +
      `Proposta de text (si la tens):\n`
    );
    return `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
  }, [routeKeyPath, query]);

  // Track help.open when sheet opens
  React.useEffect(() => {
    if (open) {
      trackUX('help.open', {
        routeKey: routeKeyPath,
        locale: language,
        source: openSourceRef.current,
      });
    }
  }, [open, routeKeyPath, language]);

  // Auto-open if ?help=1
  React.useEffect(() => {
    if (searchParams.get('help') === '1') {
      openSourceRef.current = 'deeplink';
      setOpen(true);
    }
  }, [searchParams]);

  // Reset query when pathname changes
  React.useEffect(() => {
    setQuery('');
  }, [pathname]);

  const handleCopyLink = async () => {
    if (typeof window === 'undefined') return;

    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('help', '1');
    const helpUrl = currentUrl.toString();

    trackUX('help.copyLink', { routeKey: routeKeyPath, locale: language });

    try {
      await navigator.clipboard.writeText(helpUrl);
      toast({
        title: ui.linkCopied,
        description: ui.linkCopiedDesc,
      });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No s\'ha pogut copiar l\'enllaç.',
      });
    }
  };

  // Handle sheet open/close with tracking
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      openSourceRef.current = 'button';
    }
    setOpen(newOpen);
  };

  // Handle manual link click - close sheet first, then navigate
  const handleManualClick = (e: React.MouseEvent, targetUrl: string) => {
    e.preventDefault();
    trackUX('help.manual.click', {
      routeKey: routeKeyPath,
      locale: language,
      anchor: manualAnchor || null,
    });
    setOpen(false);
    router.push(targetUrl);
  };

  // Handle feedback link click
  const handleFeedbackClick = () => {
    trackUX('help.feedback.click', { routeKey: routeKeyPath, locale: language });
  };

  // Handle search with debounce
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);

    // Clear previous timer
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    // Only track if query is meaningful (>= 2 chars)
    if (newQuery.trim().length >= 2) {
      searchDebounceRef.current = setTimeout(() => {
        const filteredSteps = filterByQuery(steps, newQuery);
        const filteredTips = filterByQuery(tips, newQuery);
        trackUX('help.search', {
          routeKey: routeKeyPath,
          locale: language,
          queryLen: newQuery.trim().length,
          hasResults: filteredSteps.length > 0 || filteredTips.length > 0,
          matchesSteps: filteredSteps.length,
          matchesTips: filteredTips.length,
        });
      }, 500);
    }
  };

  const filteredSteps = filterByQuery(steps, query);
  const filteredTips = filterByQuery(tips, query);

  const hasQuery = query.trim().length > 0;
  const hasResults = filteredSteps.length > 0 || filteredTips.length > 0;
  const showNoResults = hasQuery && !hasResults;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={ui.tooltipHelp}
              className="h-9 w-9"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
          </SheetTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>{ui.tooltipHelp}</p>
        </TooltipContent>
      </Tooltip>

      <SheetContent side="right" className="flex h-[100dvh] flex-col w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>{hasTitle ? title : ui.noHelp}</SheetTitle>
        </SheetHeader>

        {/* Scrollable content area */}
        <div className="flex-1 min-h-0 overflow-y-auto pb-8">
          {/* Show message when help not published */}
          {!hasContent && (
            <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                {ui.noHelpNotPublished}
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 font-mono">
                {routeKey}
              </p>
              {isSuperAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => router.push('/admin')}
                >
                  {ui.noHelpEditButton}
                </Button>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={(e) => handleManualClick(e, manualUrl)}>
              <BookOpen className="h-4 w-4 mr-2" />
              {ui.viewManual}
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopyLink}>
              <Link2 className="h-4 w-4 mr-2" />
              {ui.copyLink}
            </Button>
          </div>

          <div className="mt-4">
            <Input
              type="text"
              placeholder={ui.searchPlaceholder}
              value={query}
              onChange={handleSearchChange}
              className="w-full"
            />
          </div>

          <div className="mt-6 space-y-4">
          {intro && intro !== `${prefix}.intro` && !hasQuery && (
            <p className="text-muted-foreground">{intro}</p>
          )}

          {showNoResults ? (
            <p className="text-sm text-muted-foreground italic">
              {ui.noResults.replace('{query}', query)}
            </p>
          ) : (
            <>
              {filteredSteps.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-medium">{ui.steps}</h3>
                  <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                    {filteredSteps.map((step, index) => (
                      <li key={index}>{highlightText(step, query)}</li>
                    ))}
                  </ol>
                </div>
              )}

              {filteredTips.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-medium">{ui.tips}</h3>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    {filteredTips.map((tip, index) => (
                      <li key={index}>{highlightText(tip, query)}</li>
                    ))}
                  </ul>
                </div>
              )}

              {!hasQuery && filteredSteps.length === 0 && filteredTips.length === 0 && hasContent && (
                <p className="text-sm text-muted-foreground italic">
                  {ui.noSteps}
                </p>
              )}

              {/* Extra sections */}
              {!hasQuery && Object.keys(extra).length > 0 && (
                <div className="space-y-4 pt-4 border-t">
                  {extraSections.map((sectionKey) => {
                    const section = extra[sectionKey];
                    if (!section) return null;
                    const icon = EXTRA_SECTION_ICONS[sectionKey];
                    return (
                      <div key={sectionKey} className="space-y-2">
                        <h4 className="text-sm font-medium flex items-center gap-2">
                          {icon}
                          {section.title}
                        </h4>
                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-6">
                          {section.items.map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}

                  {/* Manual link from extra */}
                  {hasManualLabel && extraManualHref && (
                    <div className="pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => handleManualClick(e, buildManualUrl(extraManualHref, orgSlug))}
                      >
                        <BookOpen className="h-4 w-4 mr-2" />
                        {manualLabel}
                      </Button>
                    </div>
                  )}

                  {/* Video placeholder */}
                  {hasVideo && (
                    <div className="pt-2 flex items-center gap-2 text-sm text-muted-foreground">
                      <Play className="h-4 w-4" />
                      <span>{videoLabel}</span>
                      {videoNote && videoNote !== `${prefix}.extra.video.note` && (
                        <span className="text-xs">— {videoNote}</span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
          </div>
        </div>

        {/* Feedback link - fixed footer */}
        <div className="pt-4 border-t shrink-0">
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
            <a href={feedbackMailto} rel="noreferrer" onClick={handleFeedbackClick}>
              <MessageSquare className="h-4 w-4 mr-2" />
              {ui.suggest}
            </a>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
