/**
 * Mapping de rutes d'ajuda a ancoratges del manual públic real.
 * Els IDs han de coincidir amb els headings/IDs de public/docs/manual-usuari-summa-social.ca.md.
 */

export const CONTEXT_HELP_UI_PATHS = {
  ca: 'Header > ? (Ajuda contextual)',
  es: 'Header > ? (Ayuda contextual)',
} as const;

export const DEFAULT_MANUAL_UI_PATHS = {
  ca: 'Manual > Resolució de problemes',
  es: 'Manual > Resolución de problemas',
} as const;

type RouteAnchorEntry = {
  routePrefix: string;
  anchor: string;
};

type ManualHintEntry = {
  anchor: string;
  patterns: string[];
};

export const ROUTE_MANUAL_ANCHORS: RouteAnchorEntry[] = [
  { routePrefix: '/dashboard/movimientos/liquidacions', anchor: '6c-liquidacions-de-despeses-de-viatge' },
  { routePrefix: '/dashboard/movimientos/pendents', anchor: '6b-documents-pendents' },
  { routePrefix: '/dashboard/movimientos', anchor: '5-gestio-de-moviments' },
  { routePrefix: '/dashboard/donants/remeses-cobrament', anchor: '6a-remeses-sepa-de-cobrament' },
  { routePrefix: '/dashboard/donants', anchor: '3-gestio-de-donants' },
  { routePrefix: '/dashboard/proveidors', anchor: '4-gestio-de-proveidors-i-treballadors' },
  { routePrefix: '/dashboard/treballadors', anchor: '4-gestio-de-proveidors-i-treballadors' },
  { routePrefix: '/dashboard/informes', anchor: '9-informes-fiscals' },
  { routePrefix: '/dashboard/configuracion', anchor: '2-configuracio-inicial' },
  { routePrefix: '/dashboard/project-module/projects', anchor: '6-gestio-de-projectes' },
  { routePrefix: '/dashboard/project-module/expenses', anchor: '6-assignacio-de-despeses' },
  { routePrefix: '/dashboard/project-module', anchor: '10-projectes' },
  { routePrefix: '/dashboard/projectes', anchor: '10-projectes' },
  { routePrefix: '/dashboard', anchor: '14-entendre-el-dashboard' },
];

export const MANUAL_HINT_ANCHORS: ManualHintEntry[] = [
  { anchor: '11-resolucio-de-problemes', patterns: ['resolucio de problemes', 'resolucion de problemas', 'manual > problemes', 'manual > problemas'] },
  { anchor: '5-gestio-de-moviments', patterns: ['manual > moviments', 'manual > movimientos'] },
  { anchor: '6-divisor-de-remeses', patterns: ['manual > remeses', 'manual > remesas'] },
  { anchor: '6a-remeses-sepa-de-cobrament', patterns: ['manual > remeses de cobrament', 'manual > remesas de cobro', 'manual > sepa cobraments', 'manual > sepa cobros'] },
  { anchor: '6c-liquidacions-de-despeses-de-viatge', patterns: ['manual > liquidacions', 'manual > liquidaciones', 'manual > despeses de viatge', 'manual > gastos de viaje'] },
  { anchor: '7-gestio-de-devolucions', patterns: ['manual > devolucions', 'manual > devoluciones'] },
  { anchor: '8-donacions-via-stripe', patterns: ['manual > stripe', 'manual > donacions stripe', 'manual > donaciones stripe'] },
  { anchor: '9-informes-fiscals', patterns: ['manual > informes', 'manual > fiscal'] },
  { anchor: '10-projectes', patterns: ['manual > projectes', 'manual > proyectos'] },
  { anchor: '2-configuracio-inicial', patterns: ['manual > configuracio', 'manual > configuración', 'manual > configuracion'] },
  { anchor: '3-gestio-de-donants', patterns: ['manual > donants', 'manual > donantes'] },
  { anchor: '4-gestio-de-proveidors-i-treballadors', patterns: ['manual > proveidors', 'manual > proveedores', 'manual > treballadors', 'manual > trabajadores'] },
  { anchor: '14-entendre-el-dashboard', patterns: ['manual > dashboard'] },
  { anchor: '6b-documents-pendents', patterns: ['manual > documents pendents', 'manual > documentos pendientes'] },
];

export function getManualAnchorForRoute(routeKey: string): string | null {
  const match = ROUTE_MANUAL_ANCHORS.find((entry) => routeKey === entry.routePrefix || routeKey.startsWith(`${entry.routePrefix}/`));
  return match?.anchor ?? null;
}

export function resolveManualAnchorFromHint(rawHint: string): string | null {
  const normalized = rawHint
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return null;

  const match = MANUAL_HINT_ANCHORS.find((entry) =>
    entry.patterns.some((pattern) => normalized.includes(pattern))
  );

  return match?.anchor ?? null;
}
