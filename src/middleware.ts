/**
 * Middleware — Font de veritat per a routing i redirects
 *
 * Responsabilitats:
 * 1. Redirect app.summasocial.app → summasocial.app (canonical)
 * 2. Canonicalitzar dominis tècnics i rutes públiques legacy/internes
 * 3. Redirect /{lang}/login → /{lang} (no existeix login públic general)
 * 4. Rewrite /{lang}/... → /public/{lang}/... (rutes públiques)
 * 5. Redirect /dashboard → /redirect-to-org (selector d'org)
 *
 * IMPORTANT (anti-regressió):
 * - Totes les decisions de routing es fan AQUÍ, abans de renderitzar JSX
 * - Si una ruta no hauria d'existir, redirigir-la aquí
 * - PROTECTED_ROUTES mai es redirigeixen (evitar loops)
 *
 * @see docs/DEV-SOLO-MANUAL.md secció "Arquitectura de rutes i layouts"
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const CANONICAL_HOST = 'summasocial.app';
const ALIAS_HOST = 'app.summasocial.app';
const TECHNICAL_PUBLIC_HOST = 'studio--summa-social.us-central1.hosted.app';

// Idiomes públics vàlids per [lang]
const PUBLIC_LOCALES = new Set(['ca', 'es', 'fr', 'pt']);

// Rutes que MAI s'han de redirigir (evitar loops i salts dobles)
const PROTECTED_ROUTES = [
  '/redirect-to-org',
  '/admin',
  '/login',
  '/quick',
  '/registre',
  '/public', // segment intern per rutes públiques
];

const LEGACY_PUBLIC_PATHS = new Map<string, string>([
  ['/novetats', '/ca/novetats'],
  ['/novedades', '/es/novetats'],
  ['/es/novedades', '/es/novetats'],
]);

const CA_ES_ONLY_LANDING_SLUGS = new Set([
  'model-182',
  'certificats-donacio',
  'model-347-ong',
  'remeses-sepa',
  'devolucions-rebuts-socis',
  'conciliacio-bancaria-ong',
  'importar-extracte-bancari',
  'gestio-donants',
  'control-donacions-ong',
  'gestio-projectes-justificacio',
  'control-visibilitat-entitats',
  'software-gestion-ong',
  'programa-associacions',
]);

// Les sondes de WordPress/PHP no corresponen a cap ruta de l'aplicació. Si
// continuen caient al shell de l'app, els cercadors les poden interpretar com
// a pàgines públiques vàlides (soft 404).
const LEGACY_PROBE_PATH_PATTERN = /(?:^|\/)(?:wp-(?:admin|content|includes|login|[^/]*)(?:\/|$)|xmlrpc\.php$|[^/]+\.php$)/i;

function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/:\d+$/, '');
}

function getExternalHost(request: NextRequest): string {
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  return forwardedHost || request.headers.get('host') || '';
}

function isLocalDevelopmentHost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

/**
 * Converteix rutes antigues o internes en l'URL pública neta que s'ha d'indexar.
 */
export function resolveCanonicalPublicPath(pathname: string): string {
  const internalPublicMatch = pathname.match(/^\/public\/(ca|es|fr|pt)(\/.*)?$/);
  const externalPathname = internalPublicMatch
    ? `/${internalPublicMatch[1]}${internalPublicMatch[2] ?? ''}`
    : pathname;
  const unsupportedLandingMatch = externalPathname.match(/^\/(fr|pt)\/([^/]+)\/?$/);

  if (
    unsupportedLandingMatch &&
    CA_ES_ONLY_LANDING_SLUGS.has(unsupportedLandingMatch[2])
  ) {
    return `/es/${unsupportedLandingMatch[2]}`;
  }

  return LEGACY_PUBLIC_PATHS.get(externalPathname) ?? externalPathname;
}

export function middleware(request: NextRequest) {
  // App Hosting executa Next.js darrere d'un proxy de Cloud Run. El header
  // `host` pot contenir el domini intern del runtime; `x-forwarded-host`
  // conserva el domini que ha demanat l'usuari.
  const host = getExternalHost(request);
  const { pathname, search } = request.nextUrl;
  const normalizedHost = normalizeHost(host);
  const canonicalPathname = resolveCanonicalPublicPath(pathname);
  const isAliasHost = normalizedHost === ALIAS_HOST;
  const isTechnicalPublicPage =
    normalizedHost === TECHNICAL_PUBLIC_HOST &&
    (request.method === 'GET' || request.method === 'HEAD') &&
    !pathname.startsWith('/api/');

  // Un sol salt cap al domini i ruta canònics. Les API del backend tècnic es
  // mantenen operatives perquè integracions i comprovacions no canviïn d'origen.
  if (isAliasHost || isTechnicalPublicPage || canonicalPathname !== pathname) {
    const mustUsePublicDomain =
      isAliasHost ||
      isTechnicalPublicPage ||
      (canonicalPathname !== pathname && !isLocalDevelopmentHost(normalizedHost));
    const canonicalHost = mustUsePublicDomain ? CANONICAL_HOST : host;
    const protocol = mustUsePublicDomain
      ? 'https'
      : request.nextUrl.protocol.replace(/:$/, '');
    const canonicalUrl = `${protocol}://${canonicalHost}${canonicalPathname}${search}`;
    return NextResponse.redirect(canonicalUrl, 308);
  }

  if (
    (request.method === 'GET' || request.method === 'HEAD') &&
    !pathname.startsWith('/api/') &&
    LEGACY_PROBE_PATH_PATTERN.test(pathname)
  ) {
    return new NextResponse('Not Found', {
      status: 404,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Robots-Tag': 'noindex',
      },
    });
  }

  // Mai redirigir rutes protegides (evita loops)
  if (PROTECTED_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
    return NextResponse.next();
  }

  // Redirect /{lang}/login → /{lang} (no existeix login públic general)
  const loginMatch = pathname.match(/^\/(ca|es|fr|pt)\/login$/);
  if (loginMatch) {
    const lang = loginMatch[1];
    return NextResponse.redirect(new URL(`/${lang}`, request.url));
  }

  // Rewrite d'idiomes: /fr/... → /public/fr/... (intern)
  // Això evita la col·lisió amb [orgSlug] mantenint la URL pública
  const segments = pathname.split('/').filter(Boolean);
  const firstSegment = segments[0];

  if (firstSegment && PUBLIC_LOCALES.has(firstSegment)) {
    const url = request.nextUrl.clone();
    const rest = '/' + segments.slice(1).join('/');
    url.pathname = `/public/${firstSegment}${rest === '/' ? '' : rest}`;
    const response = NextResponse.rewrite(url);
    response.headers.set('Content-Language', firstSegment);
    return response;
  }

  // Si l'usuari accedeix a /dashboard sense slug, redirigir a la pàgina de selecció
  // Sempre conservar searchParams (inclòs ?next=...)
  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
    const url = request.nextUrl.clone();
    url.pathname = '/redirect-to-org';
    // Conservar next existent o posar pathname com a next
    if (!url.searchParams.has('next')) {
      url.searchParams.set('next', pathname);
    }
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Processar totes les rutes per detectar el host alias
export const config = {
  matcher: [
    // Excloure fitxers estàtics i API
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
};
