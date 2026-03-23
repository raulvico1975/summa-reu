// src/lib/system-incidents.ts
// Sistema de sentinelles i alertes robustes per detectar incidències reals

import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  Timestamp,
  type Firestore,
} from 'firebase/firestore';

// ═══════════════════════════════════════════════════════════════════════════
// TIPUS
// ═══════════════════════════════════════════════════════════════════════════

export type IncidentType =
  | 'CLIENT_CRASH'
  | 'PERMISSIONS'
  | 'IMPORT_FAILURE'
  | 'EXPORT_FAILURE'
  | 'INVARIANT_BROKEN';

export type IncidentSeverity = 'CRITICAL' | 'WARNING';

export type IncidentStatus = 'OPEN' | 'ACK' | 'RESOLVED';

export type IncidentImpact = 'blocker' | 'functional' | 'cosmetic';

export interface IncidentResolution {
  resolvedAt: string; // ISO timestamp
  resolvedByUid: string;
  fixCommit: string | null;
  fixNote: string | null;
  noCommit: boolean;
}

export interface SystemIncident {
  id: string;
  signature: string; // hash estable: type+route+topStackLine+code
  type: IncidentType;
  severity: IncidentSeverity;
  orgId?: string;
  orgSlug?: string;
  route?: string; // pathname
  message: string;
  topStack?: string; // primera línia útil del stack
  count: number; // comptador total d'ocurrències
  firstSeenAt: Timestamp;
  lastSeenAt: Timestamp;
  status: IncidentStatus;
  lastSeenMeta?: Record<string, unknown>; // error code, function name, etc.
  alertSentAt?: Timestamp; // quan s'ha enviat email d'alerta (usat per Cloud Function)
  // Nous camps per gestió millorada
  impact?: IncidentImpact; // blocker | functional | cosmetic
  resolution?: IncidentResolution; // dades de resolució
  // Build tracking
  firstSeenBuildId?: string; // build on va aparèixer per primera vegada
  lastSeenBuildId?: string;  // build més recent on s'ha vist
}

// ═══════════════════════════════════════════════════════════════════════════
// TEXTOS D'AJUDA (no tècnics)
// ═══════════════════════════════════════════════════════════════════════════

export interface IncidentHelp {
  whatItMeans: string;
  whyCritical: string;
  nextSteps: string;
}

export const INCIDENT_HELP: Record<IncidentType, IncidentHelp> = {
  CLIENT_CRASH: {
    whatItMeans: 'Una pantalla no s\'obre bé i l\'usuari queda bloquejat.',
    whyCritical: 'La persona no pot continuar la feina en aquest punt del producte.',
    nextSteps:
      '1. Obre la ruta afectada en una finestra privada i comprova si també falla.\n2. Si falla, copia el missatge i passa\'l a l\'equip tècnic.',
  },
  PERMISSIONS: {
    whatItMeans: 'El sistema ha bloquejat un accés perquè no reconeix permisos suficients.',
    whyCritical: 'L\'usuari pot quedar-se sense accés a dades necessàries per treballar.',
    nextSteps:
      '1. Revisa el rol de la persona afectada a l\'organització.\n2. Si el rol és correcte, escala el cas a tècnic amb la signatura de l\'incident.',
  },
  IMPORT_FAILURE: {
    whatItMeans: 'La càrrega d\'un fitxer o connexió externa no s\'ha completat.',
    whyCritical: 'Les dades noves no entren i l\'equip no pot avançar amb normalitat.',
    nextSteps:
      '1. Torna a provar la importació amb el fitxer original.\n2. Si torna a fallar, escala el cas amb el missatge d\'error.',
  },
  EXPORT_FAILURE: {
    whatItMeans: 'No s\'ha pogut generar o descarregar un document.',
    whyCritical: 'L\'equip no pot entregar informes o fitxers de gestió quan toca.',
    nextSteps:
      '1. Reintenta l\'exportació manualment.\n2. Si falla de nou, escala el cas amb la ruta i el missatge.',
  },
  INVARIANT_BROKEN: {
    whatItMeans: 'S\'ha detectat una incoherència interna de dades.',
    whyCritical: 'Podria afectar càlculs o processos financers si no es revisa.',
    nextSteps:
      '1. No facis canvis manuals sobre les dades afectades.\n2. Identifica els IDs del cas i escala-ho a tècnic per revisió.',
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// FILTRES ANTI-SOROLL
// ═══════════════════════════════════════════════════════════════════════════

const IGNORED_ERRORS = [
  'ERR_BLOCKED_BY_CLIENT', // extensions de navegador, adblockers
  'ResizeObserver loop', // error benigne de layout
  'ChunkLoadError', // errors de xarxa, usuari amb mala connexió
  'Loading chunk', // idem
  'Network request failed', // errors de xarxa temporals
  'Failed to fetch', // errors de xarxa temporals
  'Load failed', // Safari network errors
  'Script error.', // cross-origin errors sense info útil
  'AbortError', // requests cancel·lats intencionalment
];

export function shouldIgnoreError(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return IGNORED_ERRORS.some((ignored) =>
    lowerMessage.includes(ignored.toLowerCase())
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SIGNATURA (deduplicació)
// ═══════════════════════════════════════════════════════════════════════════

function extractTopStackLine(stack: string | undefined): string {
  if (!stack) return '';
  const lines = stack.split('\n').filter((l) => l.trim().startsWith('at '));
  // Eliminar línies de node_modules i framework
  const appLine = lines.find(
    (l) => !l.includes('node_modules') && !l.includes('webpack')
  );
  if (appLine) {
    // Netejar la línia: deixar només el path relatiu i línia
    const match = appLine.match(/at\s+(?:\w+\s+)?\(?(.+?)(?::\d+:\d+)?\)?$/);
    return match?.[1]?.split('/').slice(-2).join('/') || appLine.slice(0, 80);
  }
  return lines[0]?.slice(0, 80) || '';
}

export function computeSignature(
  type: IncidentType,
  route: string | undefined,
  message: string,
  stack?: string,
  code?: string
): string {
  const topStack = extractTopStackLine(stack);
  // Netejar el missatge de números dinàmics (IDs, timestamps)
  const cleanMessage = message
    .replace(/[0-9a-f]{20,}/gi, 'ID') // IDs llargs
    .replace(/\d{10,}/g, 'TS') // timestamps
    .slice(0, 100);
  const raw = `${type}|${route || ''}|${cleanMessage}|${topStack}|${code || ''}`;
  // Hash simple (no cryptogràfic, només per agrupar)
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
  }
  return `${type.slice(0, 3)}_${Math.abs(hash).toString(36)}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// REPORT INCIDENT (amb deduplicació)
// ═══════════════════════════════════════════════════════════════════════════

export interface ReportIncidentParams {
  firestore: Firestore;
  type: IncidentType;
  message: string;
  route?: string;
  stack?: string;
  orgId?: string;
  orgSlug?: string;
  code?: string;
  meta?: Record<string, unknown>;
  buildId?: string; // Optional: si no es passa, s'obté de process.env.BUILD_ID
}

/**
 * Obté el build ID actual de l'aplicació.
 * Prioritat: param > env BUILD_ID > 'unknown'
 */
function getBuildId(paramBuildId?: string): string {
  return paramBuildId || process.env.BUILD_ID || 'unknown';
}

export function getIncidentOrgContext(
  orgId?: string,
  orgSlug?: string
): { orgId: string; orgSlug?: string } | null {
  const normalizedOrgId = typeof orgId === 'string' ? orgId.trim() : '';
  if (!normalizedOrgId) {
    return null;
  }

  const normalizedOrgSlug = typeof orgSlug === 'string' ? orgSlug.trim() : '';

  return normalizedOrgSlug
    ? { orgId: normalizedOrgId, orgSlug: normalizedOrgSlug }
    : { orgId: normalizedOrgId };
}

export async function reportSystemIncident(
  params: ReportIncidentParams
): Promise<void> {
  const { firestore, type, message, route, stack, orgId, orgSlug, code, meta, buildId: paramBuildId } =
    params;

  // Filtrar soroll
  if (shouldIgnoreError(message)) {
    console.debug('[SystemIncidents] Ignored:', message.slice(0, 60));
    return;
  }

  const orgContext = getIncidentOrgContext(orgId, orgSlug);
  if (!orgContext) {
    console.debug('[SystemIncidents] Skipped: missing orgId');
    return;
  }

  const signature = computeSignature(type, route, message, stack, code);
  const buildId = getBuildId(paramBuildId);

  // Determinar severitat
  const severity: IncidentSeverity =
    type === 'CLIENT_CRASH' || type === 'PERMISSIONS' || type === 'INVARIANT_BROKEN'
      ? 'CRITICAL'
      : 'WARNING';

  const now = Timestamp.now();
  const docRef = doc(firestore, 'systemIncidents', signature);

  try {
    const existing = await getDoc(docRef);

    if (existing.exists()) {
      // Incrementar comptador i actualitzar lastSeen
      const data = existing.data();
      await updateDoc(docRef, {
        count: (data.count || 1) + 1,
        lastSeenAt: now,
        lastSeenBuildId: buildId,
        status: data.status === 'RESOLVED' ? 'OPEN' : data.status, // Reobrir si estava RESOLVED
        lastSeenMeta: meta || null,
      });
      console.info(
        `[SystemIncidents] Updated incident ${signature} (count: ${(data.count || 1) + 1}, build: ${buildId})`
      );
    } else {
      // Crear nou incident (filtrant undefined per evitar errors Firestore)
      const incident: Record<string, unknown> = {
        signature,
        type,
        severity,
        message: message.slice(0, 500),
        count: 1,
        firstSeenAt: now,
        lastSeenAt: now,
        firstSeenBuildId: buildId,
        lastSeenBuildId: buildId,
        status: 'OPEN',
      };
      // Afegir camps opcionals només si tenen valor
      if (route) incident.route = route.slice(0, 200);
      const topStack = extractTopStackLine(stack);
      if (topStack) incident.topStack = topStack;
      incident.orgId = orgContext.orgId;
      if (orgContext.orgSlug) incident.orgSlug = orgContext.orgSlug;
      if (meta) incident.lastSeenMeta = meta;

      await setDoc(docRef, incident);
      console.info(`[SystemIncidents] Created incident ${signature}: ${message.slice(0, 60)} (build: ${buildId})`);
    }
  } catch (err) {
    // Best-effort: no volem que el sistema de monitorització causi més errors
    console.error('[SystemIncidents] Failed to report incident:', err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// OBTENIR INCIDENTS
// ═══════════════════════════════════════════════════════════════════════════

export async function getOpenIncidents(
  firestore: Firestore
): Promise<SystemIncident[]> {
  const q = query(
    collection(firestore, 'systemIncidents'),
    where('status', 'in', ['OPEN', 'ACK']),
    orderBy('lastSeenAt', 'desc'),
    limit(50)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as SystemIncident);
}

export async function getOpenIncidentsByType(
  firestore: Firestore,
  type: IncidentType
): Promise<SystemIncident[]> {
  const q = query(
    collection(firestore, 'systemIncidents'),
    where('type', '==', type),
    where('status', '==', 'OPEN'),
    orderBy('lastSeenAt', 'desc'),
    limit(20)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as SystemIncident);
}

export async function countOpenIncidentsByType(
  firestore: Firestore
): Promise<Record<IncidentType, number>> {
  const incidents = await getOpenIncidents(firestore);
  const counts: Record<IncidentType, number> = {
    CLIENT_CRASH: 0,
    PERMISSIONS: 0,
    IMPORT_FAILURE: 0,
    EXPORT_FAILURE: 0,
    INVARIANT_BROKEN: 0,
  };
  for (const inc of incidents) {
    if (inc.status === 'OPEN') {
      counts[inc.type] = (counts[inc.type] || 0) + 1;
    }
  }
  return counts;
}

// ═══════════════════════════════════════════════════════════════════════════
// ACCIONS (ACK, RESOLVED)
// ═══════════════════════════════════════════════════════════════════════════

export async function acknowledgeIncident(
  firestore: Firestore,
  incidentId: string
): Promise<void> {
  await updateDoc(doc(firestore, 'systemIncidents', incidentId), {
    status: 'ACK',
  });
}

export async function resolveIncident(
  firestore: Firestore,
  incidentId: string
): Promise<void> {
  await updateDoc(doc(firestore, 'systemIncidents', incidentId), {
    status: 'RESOLVED',
  });
}

export async function reopenIncident(
  firestore: Firestore,
  incidentId: string
): Promise<void> {
  await updateDoc(doc(firestore, 'systemIncidents', incidentId), {
    status: 'OPEN',
  });
}

/**
 * Resol un incident amb dades completes de resolució.
 * Requereix indicar commit o marcar "no hi ha commit".
 */
export async function resolveIncidentWithDetails(
  firestore: Firestore,
  incidentId: string,
  resolution: IncidentResolution,
  impact?: IncidentImpact
): Promise<void> {
  if (impact) {
    await updateDoc(doc(firestore, 'systemIncidents', incidentId), {
      status: 'RESOLVED',
      resolution,
      impact,
    });
  } else {
    await updateDoc(doc(firestore, 'systemIncidents', incidentId), {
      status: 'RESOLVED',
      resolution,
    });
  }
}

/**
 * Actualitza l'impacte d'un incident sense canviar l'estat.
 */
export async function updateIncidentImpact(
  firestore: Firestore,
  incidentId: string,
  impact: IncidentImpact
): Promise<void> {
  await updateDoc(doc(firestore, 'systemIncidents', incidentId), {
    impact,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// RUTES CORE (errors aquí són crítics des del primer cop)
// ═══════════════════════════════════════════════════════════════════════════

const CORE_ROUTES = [
  '/movimientos',
  '/moviments',
  '/importar',
  '/import',
  '/fiscalitat',
  '/fiscalidad',
  '/project-module',
  '/projectes',
  '/proyectos',
  '/pendents',       // Documents pendents
  '/liquidacions',   // Liquidacions / expense reports
  '/liquidaciones',
];

export function isCoreRoute(route: string | undefined): boolean {
  if (!route) return false;
  const lowerRoute = route.toLowerCase();
  return CORE_ROUTES.some((core) => lowerRoute.includes(core));
}

// ═══════════════════════════════════════════════════════════════════════════
// INCIDENT FIX PACK (prompt de reparació per Claude Code)
// ═══════════════════════════════════════════════════════════════════════════

export interface IncidentFixPack {
  title: string;
  summary: string;
  promptText: string;
}

export interface AppMeta {
  version?: string;
  env?: 'prod' | 'dev';
  projectId?: string;
  commit?: string;
}

const TYPE_LABELS: Record<IncidentType, string> = {
  CLIENT_CRASH: 'Pantalla bloquejada',
  PERMISSIONS: 'Accés bloquejat',
  IMPORT_FAILURE: "Importació fallida",
  EXPORT_FAILURE: "Exportació fallida",
  INVARIANT_BROKEN: 'Incoherència de dades',
};

export function buildIncidentFixPack(
  incident: SystemIncident,
  appMeta: AppMeta = {}
): IncidentFixPack {
  const typeLabel = TYPE_LABELS[incident.type] || incident.type;
  const routeShort = incident.route?.split('/').slice(-2).join('/') || 'desconeguda';

  // Title: una línia humana
  const title = `${typeLabel} a ${routeShort} – ${incident.message.slice(0, 50)}${incident.message.length > 50 ? '...' : ''}`;

  // Summary: 3 línies
  const help = INCIDENT_HELP[incident.type];
  const summary = [
    `Què passa: ${help.whatItMeans}`,
    `Impacte: ${help.whyCritical}`,
    `Primer pas: ${help.nextSteps.split('\n')[0]}`,
  ].join('\n');

  // PromptText: text complet per Claude Code
  const promptText = `## Incident Fix Pack – Summa Social

### 1. Context de projecte
Ets Claude Code dins el repo Summa Social (Next.js 14 + Firebase).
Abans de tocar res, llegeix:
- docs/SUMMA-SOCIAL-REFERENCIA-COMPLETA.md
- docs/DEV-SOLO-MANUAL.md

**Regles obligatòries:**
- No afegeixis dependències noves
- No refactoritzis codi no afectat
- Canvi mínim viable

### 2. Detalls de l'incident

| Camp | Valor |
|------|-------|
| **Tipus** | ${incident.type} |
| **Severitat** | ${incident.severity} |
| **Ruta** | ${incident.route || 'N/A'} |
| **Organització** | ${incident.orgSlug || incident.orgId || 'N/A'} |
| **Repeticions** | ${incident.count} |
| **Última vegada** | ${incident.lastSeenAt?.toDate?.()?.toISOString?.() || 'N/A'} |
| **Signatura** | ${incident.signature} |

**Missatge d'error:**
\`\`\`
${incident.message}
\`\`\`

**Top stack:**
\`\`\`
${incident.topStack || 'No disponible'}
\`\`\`

${appMeta.version ? `**Versió app:** ${appMeta.version}` : ''}
${appMeta.env ? `**Entorn:** ${appMeta.env}` : ''}
${appMeta.commit ? `**Commit:** ${appMeta.commit}` : ''}

### 3. Objectiu
- Arreglar l'error perquè la ruta torni a carregar sense regressions.
- Afegir test manual de regressió (passos reproducció → resultat esperat).

### 4. Procediment obligatori
1. Localitza el fitxer origen del stack (${incident.topStack?.split('/').slice(-1)[0] || 'desconegut'})
2. Proposa canvi mínim amb paths exactes
3. Indica QA: com verificar que funciona
${incident.type === 'PERMISSIONS' ? '4. Si és PERMISSIONS: indica quina rule i quin path està denegant.' : ''}

### 5. Informació addicional
${help.nextSteps}
`;

  return { title, summary, promptText };
}

// ═══════════════════════════════════════════════════════════════════════════
// DETERMINAR SI CAL ENVIAR ALERTA
// ═══════════════════════════════════════════════════════════════════════════

export interface AlertDecision {
  shouldAlert: boolean;
  reason: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// DETECCIÓ D'ERRORS DE STORAGE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Detecta si un error és de tipus storage/unauthorized.
 * Suporta tant FirebaseError amb code com missatges de text.
 */
export function isStorageUnauthorizedError(error: unknown): boolean {
  if (!error) return false;

  // Check FirebaseError code
  if (typeof error === 'object' && error !== null) {
    const err = error as { code?: string; message?: string };
    if (err.code === 'storage/unauthorized') return true;
    if (err.message?.includes('storage/unauthorized')) return true;
    if (err.message?.includes('User does not have permission')) return true;
  }

  // Check string message
  if (typeof error === 'string') {
    if (error.includes('storage/unauthorized')) return true;
    if (error.includes('User does not have permission')) return true;
  }

  return false;
}

/**
 * Reporta un error de storage/unauthorized com a incident CRITICAL.
 * Sanititza el path per no incloure tokens ni dades sensibles.
 */
export async function reportStorageUnauthorized(
  firestore: Firestore,
  params: {
    storagePath: string;
    feature: 'pendingDocuments' | 'expenseReportsPdf' | 'attachments' | 'other';
    route?: string;
    orgId?: string;
    orgSlug?: string;
    originalError?: unknown;
  }
): Promise<void> {
  // Sanititzar path: només el bucket path, sense URL signada ni tokens
  const sanitizedPath = params.storagePath
    .replace(/\?.*$/, '')          // Treure query params
    .replace(/^https?:\/\/[^/]+/, '') // Treure domini si és URL
    .replace(/[0-9a-f]{40,}/gi, '[TOKEN]'); // Ofuscar tokens llargs

  const message = `Storage permission denied: ${params.feature} at ${sanitizedPath}`;

  await reportSystemIncident({
    firestore,
    type: 'PERMISSIONS',
    message,
    route: params.route,
    orgId: params.orgId,
    orgSlug: params.orgSlug,
    code: 'storage/unauthorized',
    meta: {
      feature: params.feature,
      storagePath: sanitizedPath,
      errorCode: 'storage/unauthorized',
    },
  });
}

export function shouldSendAlert(incident: SystemIncident): AlertDecision {
  // Condició 1: ha de ser CRITICAL
  if (incident.severity !== 'CRITICAL') {
    return { shouldAlert: false, reason: 'No és CRITICAL' };
  }

  // Condició 2: ha de ser OPEN (no ACK ni RESOLVED)
  if (incident.status !== 'OPEN') {
    return { shouldAlert: false, reason: `Status és ${incident.status}, no OPEN` };
  }

  // Condició 3: count >= 2 O primer error en ruta core
  const isCore = isCoreRoute(incident.route);
  if (incident.count < 2 && !isCore) {
    return { shouldAlert: false, reason: 'count < 2 i no és ruta core' };
  }

  // Tot OK
  return {
    shouldAlert: true,
    reason: isCore ? 'Ruta core afectada' : `Repetit ${incident.count} vegades`,
  };
}
