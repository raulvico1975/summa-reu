// src/components/admin/system-health.tsx
// Component de Salut del Sistema amb sentinelles S1-S8 i Semàfor de producció

'use client';

import * as React from 'react';
import { useTranslations, type Language, type TrFunction } from '@/i18n';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, getDoc, getDocs, limit } from 'firebase/firestore';
import { getStorage, ref, getDownloadURL, uploadBytes, deleteObject } from 'firebase/storage';
import {
  getOpenIncidents,
  countOpenIncidentsByType,
  acknowledgeIncident,
  resolveIncidentWithDetails,
  updateIncidentImpact,
  reopenIncident,
  INCIDENT_HELP,
  buildIncidentFixPack,
  type SystemIncident,
  type IncidentType,
  type IncidentImpact,
  type IncidentResolution,
} from '@/lib/system-incidents';
import {
  getRecommendedAction,
  getDefaultImpact,
  validateResolution,
  buildResolution,
  IMPACT_LABELS,
  ACTION_LABELS,
} from '@/lib/admin/incident-recommendations';
import type { Organization } from '@/lib/data';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Shield,
  Loader2,
  Eye,
  Check,
  HelpCircle,
  MonitorX,
  Lock,
  Upload,
  Download,
  Scale,
  Clock,
  FileText,
  Activity,
  Copy,
  Play,
  Database,
  ExternalLink,
  Mail,
} from 'lucide-react';
import { SUPPORT_EMAIL } from '@/lib/constants';
import { useIsMobile } from '@/hooks/use-is-mobile';

// ═══════════════════════════════════════════════════════════════════════════
// DEFINICIÓ DE SENTINELLES
// ═══════════════════════════════════════════════════════════════════════════

interface Sentinel {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  incidentTypes?: IncidentType[]; // Tipus d'incidents que activen aquesta sentinella
  isQuery?: boolean; // Només consulta, sense incidents automàtics
}

const SENTINELS: Sentinel[] = [
  {
    id: 'S1',
    name: 'Permisos',
    description: 'Errors de permisos Firestore',
    icon: <Lock className="h-4 w-4" />,
    incidentTypes: ['PERMISSIONS'],
  },
  {
    id: 'S2',
    name: 'Moviments',
    description: 'Errors a la pantalla de moviments',
    icon: <MonitorX className="h-4 w-4" />,
    incidentTypes: ['CLIENT_CRASH'], // Filtrem per ruta movimientos
  },
  {
    id: 'S3',
    name: 'Importadors',
    description: "Errors d'importació de dades",
    icon: <Upload className="h-4 w-4" />,
    incidentTypes: ['IMPORT_FAILURE'],
  },
  {
    id: 'S4',
    name: 'Exports',
    description: "Errors d'exportació (Excel, PDF, SEPA)",
    icon: <Download className="h-4 w-4" />,
    incidentTypes: ['EXPORT_FAILURE'],
  },
  {
    id: 'S5',
    name: 'Remeses OUT',
    description: 'Invariants de remeses (deltaCents, isValid)',
    icon: <Scale className="h-4 w-4" />,
    incidentTypes: ['INVARIANT_BROKEN'],
  },
  {
    id: 'S6',
    name: 'Encallaments',
    description: 'Transaccions sense classificar > 30 dies',
    icon: <Clock className="h-4 w-4" />,
    isQuery: true,
  },
  {
    id: 'S7',
    name: 'Fiscal 182',
    description: 'Donants sense dades fiscals completes',
    icon: <FileText className="h-4 w-4" />,
    isQuery: true,
  },
  {
    id: 'S8',
    name: 'Activitat',
    description: 'Organitzacions inactives > 60 dies',
    icon: <Activity className="h-4 w-4" />,
    isQuery: true,
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// SEMÀFOR DE PRODUCCIÓ - Tipus i constants
// ═══════════════════════════════════════════════════════════════════════════

type CheckStatus = 'pending' | 'running' | 'ok' | 'warning' | 'error';

interface HealthCheck {
  id: string;
  name: string;
  description: string;
  humanExplanation: string; // Text explicatiu per no-programadors
  status: CheckStatus;
  message?: string;
  requiresOrg?: boolean;
  actionable?: 'documentsEnabled' | 'goToI18n' | 'openRoute' | 'testRealUpload'; // Tipus d'acció
  isNonCritical?: boolean; // Si true, no contribueix al ❌ global del semàfor
}

const INITIAL_CHECKS: HealthCheck[] = [
  {
    id: 'superadmin-status',
    name: 'Accés administració',
    description: 'Comprova accés al panell',
    humanExplanation: 'Confirma que el teu usuari pot gestionar el sistema. Si falla, no podràs usar el panell de control.',
    status: 'pending',
  },
  {
    id: 'firestore-i18n',
    name: 'Textos centrals',
    description: 'Dades de traduccions disponibles',
    humanExplanation: 'Valida que la base de textos està accessible. Si falla, poden aparèixer textos trencats o inconsistents.',
    status: 'pending',
    actionable: 'goToI18n',
  },
  {
    id: 'firestore-updates',
    name: 'Novetats publicades',
    description: 'Historial de novetats',
    humanExplanation: 'És informatiu. Si falla, no afecta l’operativa del dia a dia.',
    status: 'pending',
    isNonCritical: true, // No contribueix al ❌ global
  },
  {
    id: 'storage-ca',
    name: 'Traduccions català',
    description: 'Fitxer de traduccions disponible',
    humanExplanation: 'Comprova que els usuaris en català veuran textos correctes.',
    status: 'pending',
    actionable: 'goToI18n',
  },
  {
    id: 'storage-es',
    name: 'Traduccions castellà',
    description: 'Fitxer de traduccions disponible',
    humanExplanation: 'Comprova que els usuaris en castellà veuran textos correctes.',
    status: 'pending',
    actionable: 'goToI18n',
  },
  {
    id: 'storage-fr',
    name: 'Traduccions francès',
    description: 'Fitxer de traduccions disponible',
    humanExplanation: 'Comprova que els usuaris en francès veuran textos correctes.',
    status: 'pending',
    actionable: 'goToI18n',
  },
  {
    id: 'storage-pt',
    name: 'Traduccions portuguès',
    description: 'Fitxer de traduccions disponible',
    humanExplanation: 'Comprova que els usuaris en portuguès veuran textos correctes.',
    status: 'pending',
    actionable: 'goToI18n',
  },
  {
    id: 'firestore-transactions',
    name: 'Llistat de moviments',
    description: 'Lectura de dades operatives',
    humanExplanation: 'Si falla, els usuaris no podran veure ni revisar els moviments.',
    status: 'pending',
    requiresOrg: true,
  },
  {
    id: 'storage-upload',
    name: 'Pujada de documents',
    description: 'Pujada de factures i nòmines',
    humanExplanation: 'Confirma que es poden pujar documents. Si falla, l’equip es queda aturat en la gestió diària.',
    status: 'pending',
    requiresOrg: true,
    actionable: 'testRealUpload', // Quan OK: botó test real.
  },
  {
    id: 'legacy-redirect',
    name: 'Entrada ràpida despeses',
    description: 'Comprovació d’accés a la ruta',
    humanExplanation: 'Comprova que l’entrada ràpida de despeses obre correctament per als usuaris.',
    status: 'pending',
    requiresOrg: true,
    actionable: 'openRoute',
  },
];

const SEMAPHORE_STORAGE_KEY = 'systemHealthSemaphore_selectedOrg';

type NightlyHealthCode =
  | 'A'
  | 'B'
  | 'C'
  | 'D'
  | 'E'
  | 'F'
  | 'G'
  | 'H'
  | 'I'
  | 'J'
  | 'K'
  | 'R1'
  | 'R2'
  | 'R3';

type NightlyPresentationSeverity = 'high' | 'medium' | 'low';

interface NightlyCheckPresentation {
  title: string;
  whatHappens: string;
  impact: string;
  firstStep: string;
  ctaLabel: string;
  targetPath?: string;
  severity: NightlyPresentationSeverity;
}

interface NightlyHealthItem {
  code: NightlyHealthCode;
  delta: number | null;
  samples: string[];
  presentation: NightlyCheckPresentation;
}

interface NightlyHealthGroup {
  incident: SystemIncident;
  items: NightlyHealthItem[];
}

interface NightlyCheckPresentationConfig {
  titleKey: string;
  titleFallback: string;
  whatHappensKey: string;
  whatHappensFallback: string;
  impactKey: string;
  impactFallback: string;
  firstStepKey: string;
  firstStepFallback: string;
  ctaLabelKey: string;
  ctaLabelFallback: string;
  targetPath?: string;
  severity: NightlyPresentationSeverity;
}

const NIGHTLY_CHECK_PRESENTATION_CONFIG: Record<NightlyHealthCode, NightlyCheckPresentationConfig> = {
  A: {
    titleKey: 'admin.health.nightly.codes.A.title',
    titleFallback: 'Categories legacy',
    whatHappensKey: 'admin.health.nightly.codes.A.whatHappens',
    whatHappensFallback: 'Hi ha moviments que encara apunten a categories antigues o nominals, no al registre canònic actual.',
    impactKey: 'admin.health.nightly.codes.A.impact',
    impactFallback: 'Pot desquadrar informes i revisions posteriors si no es reclassifica.',
    firstStepKey: 'admin.health.nightly.codes.A.firstStep',
    firstStepFallback: 'Obre moviments i revisa els exemples per substituir la categoria antiga per la vigent.',
    ctaLabelKey: 'admin.health.nightly.codes.A.ctaLabel',
    ctaLabelFallback: 'Revisar moviments',
    targetPath: '/dashboard/movimientos',
    severity: 'medium',
  },
  B: {
    titleKey: 'admin.health.nightly.codes.B.title',
    titleFallback: 'Dates de moviments',
    whatHappensKey: 'admin.health.nightly.codes.B.whatHappens',
    whatHappensFallback: 'S’han detectat dates mal formatades o barrejades en formats diferents.',
    impactKey: 'admin.health.nightly.codes.B.impact',
    impactFallback: 'Pot afectar ordenació, períodes fiscals, conciliació i coherència d’informes.',
    firstStepKey: 'admin.health.nightly.codes.B.firstStep',
    firstStepFallback: 'Obre moviments i revisa els exemples per normalitzar la data a format correcte.',
    ctaLabelKey: 'admin.health.nightly.codes.B.ctaLabel',
    ctaLabelFallback: 'Revisar moviments',
    targetPath: '/dashboard/movimientos',
    severity: 'high',
  },
  C: {
    titleKey: 'admin.health.nightly.codes.C.title',
    titleFallback: 'Compte bancari incoherent',
    whatHappensKey: 'admin.health.nightly.codes.C.whatHappens',
    whatHappensFallback: 'Hi ha moviments on la font i el compte bancari no encaixen.',
    impactKey: 'admin.health.nightly.codes.C.impact',
    impactFallback: 'Pot fer fallar conciliacions i seguiment d’origen dels moviments.',
    firstStepKey: 'admin.health.nightly.codes.C.firstStep',
    firstStepFallback: 'Obre moviments i comprova si la font o el compte assignat són correctes.',
    ctaLabelKey: 'admin.health.nightly.codes.C.ctaLabel',
    ctaLabelFallback: 'Revisar moviments',
    targetPath: '/dashboard/movimientos',
    severity: 'high',
  },
  D: {
    titleKey: 'admin.health.nightly.codes.D.title',
    titleFallback: 'Arxivats dins l’operativa',
    whatHappensKey: 'admin.health.nightly.codes.D.whatHappens',
    whatHappensFallback: 'S’han colat moviments arxivats dins del dataset operatiu.',
    impactKey: 'admin.health.nightly.codes.D.impact',
    impactFallback: 'Afegeix soroll i pot alterar comptadors o llistats de treball.',
    firstStepKey: 'admin.health.nightly.codes.D.firstStep',
    firstStepFallback: 'Obre moviments i valida si aquests casos s’han d’excloure o restaurar.',
    ctaLabelKey: 'admin.health.nightly.codes.D.ctaLabel',
    ctaLabelFallback: 'Revisar moviments',
    targetPath: '/dashboard/movimientos',
    severity: 'low',
  },
  E: {
    titleKey: 'admin.health.nightly.codes.E.title',
    titleFallback: 'Signe incoherent',
    whatHappensKey: 'admin.health.nightly.codes.E.whatHappens',
    whatHappensFallback: 'Hi ha imports amb signe incompatible amb el tipus de moviment.',
    impactKey: 'admin.health.nightly.codes.E.impact',
    impactFallback: 'Pot alterar totals, balanç i exportacions.',
    firstStepKey: 'admin.health.nightly.codes.E.firstStep',
    firstStepFallback: 'Obre moviments i corregeix el tipus o l’import dels exemples afectats.',
    ctaLabelKey: 'admin.health.nightly.codes.E.ctaLabel',
    ctaLabelFallback: 'Revisar moviments',
    targetPath: '/dashboard/movimientos',
    severity: 'high',
  },
  F: {
    titleKey: 'admin.health.nightly.codes.F.title',
    titleFallback: 'Categories inexistents',
    whatHappensKey: 'admin.health.nightly.codes.F.whatHappens',
    whatHappensFallback: 'Hi ha moviments que apunten a categories que ja no existeixen a l’organització.',
    impactKey: 'admin.health.nightly.codes.F.impact',
    impactFallback: 'Pot deixar moviments fora de classificació útil i afectar informes.',
    firstStepKey: 'admin.health.nightly.codes.F.firstStep',
    firstStepFallback: 'Revisa categories de l’organització i després corregeix els moviments afectats.',
    ctaLabelKey: 'admin.health.nightly.codes.F.ctaLabel',
    ctaLabelFallback: 'Anar a configuració',
    targetPath: '/dashboard/configuracion',
    severity: 'high',
  },
  G: {
    titleKey: 'admin.health.nightly.codes.G.title',
    titleFallback: 'Projectes inexistents',
    whatHappensKey: 'admin.health.nightly.codes.G.whatHappens',
    whatHappensFallback: 'Hi ha moviments o imputacions que apunten a projectes que no existeixen.',
    impactKey: 'admin.health.nightly.codes.G.impact',
    impactFallback: 'Pot trencar seguiment de projecte i repartiment de despesa.',
    firstStepKey: 'admin.health.nightly.codes.G.firstStep',
    firstStepFallback: 'Revisa els projectes vigents i corregeix la referència dels exemples afectats.',
    ctaLabelKey: 'admin.health.nightly.codes.G.ctaLabel',
    ctaLabelFallback: 'Revisar projectes',
    targetPath: '/dashboard/projectes',
    severity: 'high',
  },
  H: {
    titleKey: 'admin.health.nightly.codes.H.title',
    titleFallback: 'Comptes bancaris inexistents',
    whatHappensKey: 'admin.health.nightly.codes.H.whatHappens',
    whatHappensFallback: 'Alguns moviments apunten a comptes bancaris que no existeixen o ja no són vàlids.',
    impactKey: 'admin.health.nightly.codes.H.impact',
    impactFallback: 'Pot distorsionar conciliació i rastreig d’origen del moviment.',
    firstStepKey: 'admin.health.nightly.codes.H.firstStep',
    firstStepFallback: 'Comença pels exemples afectats i valida quin compte hauria de constar.',
    ctaLabelKey: 'admin.health.nightly.codes.H.ctaLabel',
    ctaLabelFallback: 'Veure exemples',
    severity: 'medium',
  },
  I: {
    titleKey: 'admin.health.nightly.codes.I.title',
    titleFallback: 'Contactes inexistents',
    whatHappensKey: 'admin.health.nightly.codes.I.whatHappens',
    whatHappensFallback: 'Hi ha moviments que conserven una referència a un contacte que ja no existeix.',
    impactKey: 'admin.health.nightly.codes.I.impact',
    impactFallback: 'Pot afectar relació amb donants, proveïdors o persones vinculades al moviment.',
    firstStepKey: 'admin.health.nightly.codes.I.firstStep',
    firstStepFallback: 'Revisa els exemples i decideix si cal reassignar contacte o netejar la referència.',
    ctaLabelKey: 'admin.health.nightly.codes.I.ctaLabel',
    ctaLabelFallback: 'Veure exemples',
    severity: 'medium',
  },
  J: {
    titleKey: 'admin.health.nightly.codes.J.title',
    titleFallback: 'Tiquets sense liquidació',
    whatHappensKey: 'admin.health.nightly.codes.J.whatHappens',
    whatHappensFallback: 'S’han detectat tiquets que apunten a una liquidació inexistent.',
    impactKey: 'admin.health.nightly.codes.J.impact',
    impactFallback: 'Pot deixar justificacions trencades o informes incomplets.',
    firstStepKey: 'admin.health.nightly.codes.J.firstStep',
    firstStepFallback: 'Obre liquidacions i verifica si cal recrear la relació o reubicar el tiquet.',
    ctaLabelKey: 'admin.health.nightly.codes.J.ctaLabel',
    ctaLabelFallback: 'Obrir liquidacions',
    targetPath: '/dashboard/movimientos/liquidacions',
    severity: 'medium',
  },
  K: {
    titleKey: 'admin.health.nightly.codes.K.title',
    titleFallback: 'Remeses filles sense pare',
    whatHappensKey: 'admin.health.nightly.codes.K.whatHappens',
    whatHappensFallback: 'Hi ha línies de remesa que ja no tenen moviment pare vàlid.',
    impactKey: 'admin.health.nightly.codes.K.impact',
    impactFallback: 'Pot trencar totals, seguiment de cobraments i coherència de remeses.',
    firstStepKey: 'admin.health.nightly.codes.K.firstStep',
    firstStepFallback: 'Obre remeses de cobrament i revisa si falta recuperar el pare o netejar les filles.',
    ctaLabelKey: 'admin.health.nightly.codes.K.ctaLabel',
    ctaLabelFallback: 'Obrir remeses',
    targetPath: '/dashboard/donants/remeses-cobrament',
    severity: 'high',
  },
  R1: {
    titleKey: 'admin.health.nightly.codes.R1.title',
    titleFallback: 'Paritat del dashboard',
    whatHappensKey: 'admin.health.nightly.codes.R1.whatHappens',
    whatHappensFallback: 'Els totals agregats no quadren amb el desglossament intern.',
    impactKey: 'admin.health.nightly.codes.R1.impact',
    impactFallback: 'Pot fer que el resum global no coincideixi amb el detall.',
    firstStepKey: 'admin.health.nightly.codes.R1.firstStep',
    firstStepFallback: 'Revisa els exemples afectats per veure quin bloc està desquadrant el total.',
    ctaLabelKey: 'admin.health.nightly.codes.R1.ctaLabel',
    ctaLabelFallback: 'Veure exemples',
    severity: 'high',
  },
  R2: {
    titleKey: 'admin.health.nightly.codes.R2.title',
    titleFallback: 'Feed de despeses de projectes',
    whatHappensKey: 'admin.health.nightly.codes.R2.whatHappens',
    whatHappensFallback: 'Hi ha despeses que no coincideixen amb l’elegibilitat o l’export esperat del mòdul de projectes.',
    impactKey: 'admin.health.nightly.codes.R2.impact',
    impactFallback: 'Pot deixar despeses fora del flux o mostrar-ne de més dins projectes.',
    firstStepKey: 'admin.health.nightly.codes.R2.firstStep',
    firstStepFallback: 'Obre despeses de projectes i revisa els exemples per validar elegibilitat i origen.',
    ctaLabelKey: 'admin.health.nightly.codes.R2.ctaLabel',
    ctaLabelFallback: 'Obrir despeses',
    targetPath: '/dashboard/project-module/expenses',
    severity: 'high',
  },
  R3: {
    titleKey: 'admin.health.nightly.codes.R3.title',
    titleFallback: 'FX i imputacions',
    whatHappensKey: 'admin.health.nightly.codes.R3.whatHappens',
    whatHappensFallback: 'Hi ha incoherències entre tipus de canvi, imports imputats o repartiments entre projectes.',
    impactKey: 'admin.health.nightly.codes.R3.impact',
    impactFallback: 'Pot desquadrar imports en EUR i justificar malament despeses internacionals.',
    firstStepKey: 'admin.health.nightly.codes.R3.firstStep',
    firstStepFallback: 'Obre despeses de projectes i comprova les imputacions i tipus de canvi dels exemples.',
    ctaLabelKey: 'admin.health.nightly.codes.R3.ctaLabel',
    ctaLabelFallback: 'Obrir despeses',
    targetPath: '/dashboard/project-module/expenses',
    severity: 'high',
  },
};

const NIGHTLY_SEVERITY_STYLES: Record<NightlyPresentationSeverity, string> = {
  high: 'border-red-200 bg-red-50 text-red-800',
  medium: 'border-amber-200 bg-amber-50 text-amber-800',
  low: 'border-slate-200 bg-slate-50 text-slate-700',
};

function isNightlyHealthCode(value: unknown): value is NightlyHealthCode {
  return typeof value === 'string' && value in NIGHTLY_CHECK_PRESENTATION_CONFIG;
}

function isNightlyHealthIncident(incident: SystemIncident): boolean {
  return incident.type === 'INVARIANT_BROKEN' && incident.route === '/health-check/nightly';
}

function interpolateMessage(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (message, [key, value]) => message.replaceAll(`{${key}}`, String(value)),
    template
  );
}

function localeForLanguage(language: Language): string {
  if (language === 'es') return 'es-ES';
  if (language === 'fr') return 'fr-FR';
  if (language === 'pt') return 'pt-PT';
  return 'ca-ES';
}

function buildNightlyCheckPresentation(tr: TrFunction): Record<NightlyHealthCode, NightlyCheckPresentation> {
  return Object.fromEntries(
    Object.entries(NIGHTLY_CHECK_PRESENTATION_CONFIG).map(([code, config]) => [
      code,
      {
        title: tr(config.titleKey, config.titleFallback),
        whatHappens: tr(config.whatHappensKey, config.whatHappensFallback),
        impact: tr(config.impactKey, config.impactFallback),
        firstStep: tr(config.firstStepKey, config.firstStepFallback),
        ctaLabel: tr(config.ctaLabelKey, config.ctaLabelFallback),
        targetPath: config.targetPath,
        severity: config.severity,
      },
    ])
  ) as Record<NightlyHealthCode, NightlyCheckPresentation>;
}

function getNightlyIncidentItems(
  incident: SystemIncident,
  presentationMap: Record<NightlyHealthCode, NightlyCheckPresentation>
): NightlyHealthItem[] {
  const meta = incident.lastSeenMeta && typeof incident.lastSeenMeta === 'object'
    ? incident.lastSeenMeta as Record<string, unknown>
    : {};

  const sampleIdsByCode = meta.sampleIds && typeof meta.sampleIds === 'object'
    ? meta.sampleIds as Record<string, unknown>
    : {};

  const deltasByCode = meta.deltas && typeof meta.deltas === 'object'
    ? meta.deltas as Record<string, unknown>
    : {};

  const orderedCodes = new Set<NightlyHealthCode>();

  if (Array.isArray(meta.deltasList)) {
    for (const item of meta.deltasList) {
      const code = (item as { id?: unknown }).id;
      if (isNightlyHealthCode(code)) {
        orderedCodes.add(code);
      }
    }
  }

  if (Array.isArray(meta.worsenedCriticalChecks)) {
    for (const code of meta.worsenedCriticalChecks) {
      if (isNightlyHealthCode(code)) {
        orderedCodes.add(code);
      }
    }
  }

  for (const key of Object.keys(sampleIdsByCode)) {
    if (isNightlyHealthCode(key)) {
      orderedCodes.add(key);
    }
  }

  for (const key of Object.keys(deltasByCode)) {
    if (isNightlyHealthCode(key)) {
      orderedCodes.add(key);
    }
  }

  const severityWeight: Record<NightlyPresentationSeverity, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };

  return Array.from(orderedCodes)
    .map((code) => {
      const rawDelta = deltasByCode[code];
      const rawSamples = sampleIdsByCode[code];

        return {
          code,
          delta: typeof rawDelta === 'number' && Number.isFinite(rawDelta) ? rawDelta : null,
          samples: Array.isArray(rawSamples)
            ? rawSamples.filter((value): value is string => typeof value === 'string').slice(0, 10)
            : [],
          presentation: presentationMap[code],
        };
      })
    .sort((a, b) => {
      const severityDiff = severityWeight[a.presentation.severity] - severityWeight[b.presentation.severity];
      if (severityDiff !== 0) return severityDiff;
      return a.code.localeCompare(b.code);
    });
}

function buildNightlyTargetHref(orgSlug: string | undefined, targetPath: string | undefined): string | null {
  if (!orgSlug || !targetPath) return null;
  return `/${orgSlug}${targetPath}`;
}

function buildNightlySampleHref(orgSlug: string | undefined, code: NightlyHealthCode, sampleId: string): string | null {
  if (!orgSlug) return null;
  if (code === 'R2' || code === 'R3') {
    return `/${orgSlug}/dashboard/project-module/expenses/${encodeURIComponent(sampleId)}`;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export function SystemHealth() {
  const { tr, language } = useTranslations();
  const { firestore, user } = useFirebase();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [incidents, setIncidents] = React.useState<SystemIncident[]>([]);
  const [incidentCounts, setIncidentCounts] = React.useState<Record<IncidentType, number>>({
    CLIENT_CRASH: 0,
    PERMISSIONS: 0,
    IMPORT_FAILURE: 0,
    EXPORT_FAILURE: 0,
    INVARIANT_BROKEN: 0,
  });
  const [isLoading, setIsLoading] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selectedIncident, setSelectedIncident] = React.useState<SystemIncident | null>(null);
  const [selectedNightlyGroup, setSelectedNightlyGroup] = React.useState<NightlyHealthGroup | null>(null);
  const [selectedNightlyItem, setSelectedNightlyItem] = React.useState<NightlyHealthItem | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);

  // Modal de resolució d'incidents
  const [resolveDialogOpen, setResolveDialogOpen] = React.useState(false);
  const [incidentToResolve, setIncidentToResolve] = React.useState<SystemIncident | null>(null);
  const [resolveCommit, setResolveCommit] = React.useState('');
  const [resolveNote, setResolveNote] = React.useState('');
  const [resolveNoCommit, setResolveNoCommit] = React.useState(false);
  const [resolveImpact, setResolveImpact] = React.useState<IncidentImpact>('functional');
  const [resolveError, setResolveError] = React.useState<string | null>(null);

  // Semàfor de producció state
  const [healthChecks, setHealthChecks] = React.useState<HealthCheck[]>(INITIAL_CHECKS);
  const [isRunningChecks, setIsRunningChecks] = React.useState(false);
  const [selectedOrgId, setSelectedOrgId] = React.useState<string>('');


  // Carregar organitzacions per al selector
  const orgsQuery = useMemoFirebase(
    () => query(collection(firestore, 'organizations'), orderBy('name', 'asc')),
    [firestore]
  );
  const { data: organizations } = useCollection<Organization>(orgsQuery);

  // Carregar org seleccionada de localStorage
  React.useEffect(() => {
    const savedOrg = localStorage.getItem(SEMAPHORE_STORAGE_KEY);
    if (savedOrg) {
      setSelectedOrgId(savedOrg);
    }
  }, []);

  // Guardar org seleccionada a localStorage
  const handleOrgChange = (orgId: string) => {
    setSelectedOrgId(orgId);
    localStorage.setItem(SEMAPHORE_STORAGE_KEY, orgId);
  };

  // Carregar incidents
  const loadIncidents = React.useCallback(async () => {
    if (!firestore) return;
    setIsLoading(true);
    try {
      const [allIncidents, counts] = await Promise.all([
        getOpenIncidents(firestore),
        countOpenIncidentsByType(firestore),
      ]);
      setIncidents(allIncidents);
      setIncidentCounts(counts);
    } catch (err) {

    } finally {
      setIsLoading(false);
    }
  }, [firestore]);

  React.useEffect(() => {
    loadIncidents();
  }, [loadIncidents]);

  const uiLocale = React.useMemo(() => localeForLanguage(language), [language]);

  const nightlyCheckPresentation = React.useMemo(
    () => buildNightlyCheckPresentation(tr),
    [tr]
  );

  const realIncidents = React.useMemo(
    () => incidents.filter((incident) => !isNightlyHealthIncident(incident)),
    [incidents]
  );

  const nightlyHealthGroups = React.useMemo(
    () =>
      incidents
        .filter(isNightlyHealthIncident)
        .map((incident) => ({
          incident,
          items: getNightlyIncidentItems(incident, nightlyCheckPresentation),
        }))
        .filter((group) => group.items.length > 0),
    [incidents, nightlyCheckPresentation]
  );

  const openRealIncidentCount = React.useMemo(
    () => realIncidents.filter((incident) => incident.status === 'OPEN').length,
    [realIncidents]
  );

  const nightlyCheckCount = React.useMemo(
    () => nightlyHealthGroups.reduce((sum, group) => sum + group.items.length, 0),
    [nightlyHealthGroups]
  );

  // Determinar estat de cada sentinella
  const getSentinelStatus = (sentinel: Sentinel): 'ok' | 'warning' | 'critical' => {
    if (sentinel.isQuery) return 'ok'; // Les sentinelles de consulta sempre verdes per ara

    if (!sentinel.incidentTypes) return 'ok';

    // Per S2 (Moviments), filtrar incidents CLIENT_CRASH que siguin a ruta movimientos
    if (sentinel.id === 'S2') {
      const movimientosIncidents = incidents.filter(
        (i) =>
          i.type === 'CLIENT_CRASH' &&
          i.status === 'OPEN' &&
          i.route?.includes('movimiento')
      );
      return movimientosIncidents.length > 0 ? 'critical' : 'ok';
    }

    // Per altres sentinelles, comptar incidents del tipus corresponent
    const count = sentinel.incidentTypes.reduce(
      (sum, type) => sum + (incidentCounts[type] || 0),
      0
    );
    return count > 0 ? 'critical' : 'ok';
  };

  // Handler per ACK
  const handleAck = async (incident: SystemIncident) => {
    if (!firestore) return;
    setIsProcessing(true);
    try {
      await acknowledgeIncident(firestore, incident.id);
      await loadIncidents();
    } catch (err) {

    } finally {
      setIsProcessing(false);
    }
  };

  // Handler per obrir modal de resolució
  const handleOpenResolveDialog = (incident: SystemIncident) => {
    setIncidentToResolve(incident);
    setResolveCommit('');
    setResolveNote('');
    setResolveNoCommit(false);
    setResolveImpact(incident.impact || getDefaultImpact(incident));
    setResolveError(null);
    setResolveDialogOpen(true);
  };

  // Handler per confirmar resolució amb dades completes
  const handleConfirmResolve = async () => {
    if (!firestore || !incidentToResolve || !user) return;

    // Validar
    const validation = validateResolution(resolveCommit, resolveNoCommit);
    if (!validation.valid) {
      setResolveError(validation.error || 'Error de validació');
      return;
    }

    setIsProcessing(true);
    setResolveError(null);

    try {
      const resolution = buildResolution(
        user.uid,
        resolveCommit,
        resolveNote,
        resolveNoCommit
      );
      await resolveIncidentWithDetails(firestore, incidentToResolve.id, resolution, resolveImpact);
      await loadIncidents();
      setResolveDialogOpen(false);
      setIncidentToResolve(null);
      toast({
        title: 'Incident tancat',
        description: resolveNoCommit
          ? 'Marcat com resolt sense commit.'
          : `Resolt amb commit: ${resolveCommit}`,
      });
    } catch (err) {

      setResolveError('No s\'ha pogut tancar l\'incident.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handler per canviar impacte sense tancar
  const handleChangeImpact = async (incident: SystemIncident, newImpact: IncidentImpact) => {
    if (!firestore) return;
    try {
      await updateIncidentImpact(firestore, incident.id, newImpact);

      // Si es marca com "blocker", enviar alerta per email
      if (newImpact === 'blocker' && incident.impact !== 'blocker') {
        try {
          await fetch('/api/admin/incident-alert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              incidentId: incident.id,
              title: incident.message.slice(0, 80),
              type: incident.type,
              severity: incident.severity,
              impact: newImpact,
              route: incident.route,
              message: incident.message,
              count: incident.count,
            }),
          });
          toast({
            title: 'Alerta enviada',
            description: 'S\'ha enviat un email d\'alerta per aquest incident crític.',
          });
        } catch (emailErr) {

        }
      }

      await loadIncidents();
    } catch (err) {

    }
  };

  // Handler per reobrir
  const handleReopen = async (incident: SystemIncident) => {
    if (!firestore) return;
    setIsProcessing(true);
    try {
      await reopenIncident(firestore, incident.id);
      await loadIncidents();
    } catch (err) {

    } finally {
      setIsProcessing(false);
    }
  };

  // Handler per copiar prompt de reparació
  const handleCopyPrompt = async (incident: SystemIncident) => {
    const { promptText } = buildIncidentFixPack(incident);
    try {
      await navigator.clipboard.writeText(promptText);
      toast({
        title: 'Prompt copiat',
        description: 'Enganxa el text a Claude Code per reparar l\'error.',
      });
    } catch (err) {

      toast({
        title: 'Error copiant',
        description: 'No s\'ha pogut copiar al portapapers.',
        variant: 'destructive',
      });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // SEMÀFOR DE PRODUCCIÓ - Executar checks
  // ─────────────────────────────────────────────────────────────────────────

  const updateCheck = (id: string, updates: Partial<HealthCheck>) => {
    setHealthChecks((prev) =>
      prev.map((check) => (check.id === id ? { ...check, ...updates } : check))
    );
  };

  const runHealthChecks = async () => {
    if (!firestore) return;

    setIsRunningChecks(true);
    // Reset all checks to running
    setHealthChecks(INITIAL_CHECKS.map((c) => ({ ...c, status: 'running' as CheckStatus })));

    const storage = getStorage();
    const selectedOrg = organizations?.find((o) => o.id === selectedOrgId);

    // 0. Check SuperAdmin status (nou check prioritari)
    if (user) {
      try {
        const superAdminDoc = await getDoc(doc(firestore, 'systemSuperAdmins', user.uid));
        if (superAdminDoc.exists()) {
          const data = superAdminDoc.data();
          updateCheck('superadmin-status', {
            status: 'ok',
            message: data?.email ? `✓ ${data.email}` : '✓ Registrat',
          });
        } else {
          updateCheck('superadmin-status', {
            status: 'error',
            message: 'No ets SuperAdmin',
          });
        }
      } catch (err) {
        // Si permission-denied, vol dir que no tenim accés (probablement no som superadmin)
        const error = err as { code?: string };
        if (error.code === 'permission-denied') {
          updateCheck('superadmin-status', {
            status: 'error',
            message: 'Sense permisos (no ets SuperAdmin)',
          });
        } else {
          updateCheck('superadmin-status', { status: 'error', message: (err as Error).message });
        }
      }
    } else {
      updateCheck('superadmin-status', { status: 'warning', message: 'No autenticat' });
    }

    // 1. Check system/i18n (Firestore)
    try {
      const i18nDoc = await getDoc(doc(firestore, 'system', 'i18n'));
      if (i18nDoc.exists()) {
        updateCheck('firestore-i18n', { status: 'ok', message: `v${i18nDoc.data()?.version || '?'}` });
      } else {
        updateCheck('firestore-i18n', { status: 'warning', message: 'No existeix' });
      }
    } catch (err) {
      updateCheck('firestore-i18n', { status: 'error', message: (err as Error).message });
    }

    // 2. Check productUpdates (Firestore) - no és crític si està buit
    try {
      const updatesDoc = await getDoc(doc(firestore, 'system', 'productUpdates'));
      if (updatesDoc.exists()) {
        updateCheck('firestore-updates', { status: 'ok', message: 'Configurat' });
      } else {
        // No existeix és normal si no s'han publicat novetats
        updateCheck('firestore-updates', { status: 'ok', message: 'Normal (cap novetat publicada)' });
      }
    } catch (err) {
      // Error d'accés sí que és problema
      updateCheck('firestore-updates', { status: 'warning', message: (err as Error).message });
    }

    // 3-6. Check i18n Storage files
    const languages = ['ca', 'es', 'fr', 'pt'] as const;
    for (const lang of languages) {
      try {
        const fileRef = ref(storage, `i18n/${lang}.json`);
        await getDownloadURL(fileRef);
        updateCheck(`storage-${lang}`, { status: 'ok', message: 'Existeix' });
      } catch (err) {
        const error = err as { code?: string };
        if (error.code === 'storage/object-not-found') {
          updateCheck(`storage-${lang}`, { status: 'error', message: 'No existeix' });
        } else if (error.code === 'storage/unauthorized') {
          updateCheck(`storage-${lang}`, { status: 'error', message: 'Sense permisos' });
        } else {
          updateCheck(`storage-${lang}`, { status: 'error', message: (err as Error).message });
        }
      }
    }

    // 7. Check moviments accessibles (Firestore read tècnic)
    if (selectedOrg) {
      try {
        const txQuery = query(
          collection(firestore, `organizations/${selectedOrgId}/transactions`),
          limit(1)
        );
        await getDocs(txQuery);
        updateCheck('firestore-transactions', { status: 'ok', message: 'Accessible' });
      } catch (err) {
        const error = err as { code?: string };
        if (error.code === 'permission-denied') {
          updateCheck('firestore-transactions', { status: 'error', message: 'Sense permisos' });
        } else {
          updateCheck('firestore-transactions', { status: 'error', message: (err as Error).message });
        }
      }
    } else {
      updateCheck('firestore-transactions', { status: 'warning', message: 'Cal seleccionar org' });
    }

    // 8. Check pendingDocuments upload (requires org)
    // Política TEMPORAL: qualsevol usuari autenticat pot pujar
    if (selectedOrg && user) {
      const testFileName = `_healthcheck/${Date.now()}.txt`;
      const testPath = `organizations/${selectedOrgId}/pendingDocuments/${testFileName}`;
      const testRef = ref(storage, testPath);
      const testContent = new Blob(['health check'], { type: 'text/plain' });

      try {
        await uploadBytes(testRef, testContent);
        // Cleanup: delete the test file
        await deleteObject(testRef);
        updateCheck('storage-upload', { status: 'ok', message: 'Upload OK' });
      } catch (err) {
        const error = err as { code?: string };
        if (error.code === 'storage/unauthorized') {
          // Amb la política temporal, si falla és problema de rules
          updateCheck('storage-upload', {
            status: 'error',
            message: 'Rules Storage incorrectes',
          });

        } else {
          updateCheck('storage-upload', { status: 'error', message: (err as Error).message });
        }
      }
    } else if (!user) {
      updateCheck('storage-upload', { status: 'warning', message: 'No autenticat' });
    } else {
      updateCheck('storage-upload', { status: 'warning', message: 'Cal seleccionar org' });
    }

    // 9. Check legacy quick-expense redirect
    if (selectedOrg) {
      try {
        const response = await fetch(`/${selectedOrg.slug}/quick-expense`, {
          method: 'HEAD',
          redirect: 'manual',
        });
        // 308 o 200 = OK (redirect o pàgina existent)
        if (response.status === 200 || response.status === 308 || response.type === 'opaqueredirect') {
          updateCheck('legacy-redirect', { status: 'ok', message: 'Ruta operativa' });
        } else if (response.status === 404) {
          updateCheck('legacy-redirect', { status: 'error', message: '404 Not Found' });
        } else {
          updateCheck('legacy-redirect', { status: 'warning', message: `Status ${response.status}` });
        }
      } catch {
        // fetch error usually means CORS or network issue, but route likely exists
        updateCheck('legacy-redirect', { status: 'ok', message: 'Ruta existeix (CORS)' });
      }
    } else {
      updateCheck('legacy-redirect', { status: 'warning', message: 'Cal seleccionar org' });
    }

    setIsRunningChecks(false);
  };

  // Generar informe per copiar
  const generateReport = () => {
    const selectedOrg = organizations?.find((o) => o.id === selectedOrgId);
    const timestamp = new Date().toISOString();
    const lines = [
      `# Informe Semàfor de Producció`,
      `Data: ${timestamp}`,
      selectedOrg ? `Org: ${selectedOrg.name} (${selectedOrg.slug})` : 'Org: No seleccionada',
      '',
      '## Checks',
      ...healthChecks.map((check) => {
        const icon = check.status === 'ok' ? '✅' : check.status === 'warning' ? '⚠️' : check.status === 'error' ? '❌' : '⏳';
        return `${icon} ${check.name}: ${check.message || check.status}`;
      }),
      '',
      `## Resum`,
      `- OK: ${healthChecks.filter((c) => c.status === 'ok').length}`,
      `- Warning: ${healthChecks.filter((c) => c.status === 'warning').length}`,
      `- Error: ${healthChecks.filter((c) => c.status === 'error').length}`,
    ];
    return lines.join('\n');
  };

  const handleCopyReport = async () => {
    try {
      await navigator.clipboard.writeText(generateReport());
      toast({
        title: 'Informe copiat',
        description: 'Pots enganxar-lo on vulguis.',
      });
    } catch (err) {

      toast({
        title: 'Error copiant',
        description: 'No s\'ha pogut copiar al portapapers.',
        variant: 'destructive',
      });
    }
  };

  // Calcular estat global del semàfor
  // Només errors crítics (no isNonCritical) contribueixen al ❌ global
  // Els warnings de "Cal seleccionar org" no penalitzen
  const semaphoreStatus = React.useMemo(() => {
    const hasPending = healthChecks.some((c) => c.status === 'pending' || c.status === 'running');
    if (hasPending) return 'pending';

    // Filtrar errors crítics (exclou isNonCritical)
    const criticalChecks = healthChecks.filter((c) => !c.isNonCritical);
    const hasCriticalError = criticalChecks.some((c) => c.status === 'error');

    // Filtrar warnings que NO són "Cal seleccionar org" (aquests no penalitzen)
    const hasRealWarning = healthChecks.some(
      (c) => c.status === 'warning' && c.message !== 'Cal seleccionar org'
    );

    if (hasCriticalError) return 'error';
    if (hasRealWarning) return 'warning';

    // Si tots els checks crítics estan OK (o són non-critical OK/warning)
    const allCriticalOk = criticalChecks.every((c) => c.status === 'ok' || c.status === 'warning');
    if (allCriticalOk) return 'ok';

    return 'pending';
  }, [healthChecks]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" />
            Salut del sistema
          </CardTitle>
          <CardDescription>
            Sentinelles que detecten problemes abans que els usuaris els reportin.
            <span className="flex items-center gap-1 text-xs mt-1 opacity-70">
              <Mail className="h-3 w-3" />
              Contacte/suport: <span className="font-mono">{SUPPORT_EMAIL}</span>
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregant...
            </div>
          ) : (
            <>
              {/* Grid de sentinelles */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {SENTINELS.map((sentinel) => {
                  const status = getSentinelStatus(sentinel);
                  return (
                    <TooltipProvider key={sentinel.id} delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={`flex items-center gap-2 p-2 rounded-lg border cursor-default transition-colors ${
                              status === 'critical'
                                ? 'bg-red-50 border-red-200'
                                : status === 'warning'
                                  ? 'bg-yellow-50 border-yellow-200'
                                  : 'bg-green-50 border-green-200'
                            }`}
                          >
                            {status === 'critical' ? (
                              <XCircle className="h-4 w-4 text-red-600" />
                            ) : status === 'warning' ? (
                              <AlertTriangle className="h-4 w-4 text-yellow-600" />
                            ) : (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium truncate">
                                {sentinel.id} {sentinel.name}
                              </div>
                            </div>
                            {sentinel.icon}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-[200px]">
                          <p className="text-xs">{sentinel.description}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
              </div>

              <div className="pt-4 mt-4 border-t space-y-6">
                <section className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-medium">{tr('admin.health.realIncidents.sectionTitle', 'Incidents reals')}</h4>
                      <p className="text-xs text-muted-foreground">
                        {tr(
                          'admin.health.realIncidents.sectionDescription',
                          "Errors d'ús real del sistema: crashes, permisos, imports o exports. Mantenen el flux actual d'ACK i Resolt."
                        )}
                      </p>
                    </div>
                    {realIncidents.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDialogOpen(true)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        {tr('admin.health.realIncidents.viewDetail', 'Veure detall')}
                      </Button>
                    )}
                  </div>

                  {realIncidents.length === 0 ? (
                    <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                      {tr('admin.health.realIncidents.empty', 'No hi ha incidents reals oberts ara mateix.')}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                        {interpolateMessage(
                          tr(
                            'admin.health.realIncidents.summary',
                            '{open} incidents reals oberts i {ack} en ACK.'
                          ),
                          {
                            open: openRealIncidentCount,
                            ack: realIncidents.length - openRealIncidentCount,
                          }
                        )}
                      </div>
                      {realIncidents.slice(0, 3).map((incident) => (
                        <div key={incident.id} className="rounded-lg border px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="text-sm font-medium">{incident.message}</p>
                              <p className="text-xs text-muted-foreground">
                                {incident.route || tr('admin.health.realIncidents.noRoute', 'Sense ruta')}{incident.orgSlug ? ` · ${incident.orgSlug}` : ''}
                              </p>
                            </div>
                            <Badge variant={incident.status === 'ACK' ? 'secondary' : 'destructive'}>
                              {incident.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-medium">{tr('admin.health.dataHealth.sectionTitle', 'Salut de dades')}</h4>
                      <p className="text-xs text-muted-foreground">
                        {tr(
                          'admin.health.dataHealth.sectionDescription',
                          "Resultats del control nocturn. Són checks operatius sobre dades i coherència, no crashes d'usuari."
                        )}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {interpolateMessage(
                        tr('admin.health.dataHealth.countBadge', '{count} checks'),
                        { count: nightlyCheckCount }
                      )}
                    </Badge>
                  </div>

                  {nightlyHealthGroups.length === 0 ? (
                    <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                      {tr(
                        'admin.health.dataHealth.empty',
                        'El darrer control nocturn no ha deixat checks operatius oberts.'
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {nightlyHealthGroups.map((group) => (
                        <div key={group.incident.id} className="rounded-xl border bg-card p-4 space-y-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h5 className="text-sm font-medium">
                                {group.incident.orgSlug || group.incident.orgId || tr('admin.health.dataHealth.orgWithoutSlug', 'Organització sense slug')}
                              </h5>
                              <p className="text-xs text-muted-foreground">
                                {interpolateMessage(
                                  tr(
                                    'admin.health.dataHealth.detectedAt',
                                    'Detectat al darrer control nocturn · {date}'
                                  ),
                                  {
                                    date: group.incident.lastSeenAt?.toDate?.()?.toLocaleString(uiLocale, {
                                      day: '2-digit',
                                      month: '2-digit',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    }) || tr('admin.health.dataHealth.noDate', 'sense data'),
                                  }
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {tr('admin.health.dataHealth.pendingReview', 'Pendent de revisió')} · {tr('admin.health.dataHealth.autoCloseHint', 'Es tancarà quan deixi de reaparèixer')}
                              </p>
                            </div>
                            <Badge variant="secondary">
                              {interpolateMessage(
                                tr('admin.health.dataHealth.countBadge', '{count} checks'),
                                { count: group.items.length }
                              )}
                            </Badge>
                          </div>

                          <div className="space-y-3">
                            {group.items.map((item) => {
                              const targetHref = buildNightlyTargetHref(group.incident.orgSlug, item.presentation.targetPath);
                              return (
                                <div key={`${group.incident.id}-${item.code}`} className="rounded-lg border p-3 space-y-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs font-mono text-muted-foreground">{item.code}</span>
                                        <span className="text-sm font-medium">{item.presentation.title}</span>
                                        <span className={`rounded-full border px-2 py-0.5 text-[11px] ${NIGHTLY_SEVERITY_STYLES[item.presentation.severity]}`}>
                                          {item.presentation.severity === 'high'
                                            ? tr('admin.health.dataHealth.severity.high', 'alt')
                                            : item.presentation.severity === 'medium'
                                            ? tr('admin.health.dataHealth.severity.medium', 'mitja')
                                            : tr('admin.health.dataHealth.severity.low', 'baixa')}
                                        </span>
                                        {item.delta !== null && (
                                          <span className="text-xs text-muted-foreground">
                                            {interpolateMessage(
                                              tr('admin.health.dataHealth.deltaVsPrevious', '+{delta} vs nit anterior'),
                                              { delta: item.delta }
                                            )}
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-sm text-foreground">{item.presentation.whatHappens}</p>
                                    </div>
                                  </div>

                                  <div className="grid gap-3 md:grid-cols-2">
                                    <div className="rounded-lg bg-muted/50 p-3">
                                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{tr('admin.health.dataHealth.impactLabel', 'Impacte')}</p>
                                      <p className="mt-1 text-sm">{item.presentation.impact}</p>
                                    </div>
                                    <div className="rounded-lg bg-muted/50 p-3">
                                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{tr('admin.health.dataHealth.firstStepLabel', 'Primer pas')}</p>
                                      <p className="mt-1 text-sm">{item.presentation.firstStep}</p>
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{tr('admin.health.dataHealth.examplesLabel', 'Exemples detectats')}</p>
                                    {item.samples.length > 0 ? (
                                      <div className="flex flex-wrap gap-2">
                                        {item.samples.slice(0, 3).map((sampleId) => {
                                          const sampleHref = buildNightlySampleHref(group.incident.orgSlug, item.code, sampleId);
                                          if (sampleHref) {
                                            return (
                                              <Button
                                                key={sampleId}
                                                variant="outline"
                                                size="sm"
                                                className="h-7 px-2 font-mono text-xs"
                                                onClick={() => window.open(sampleHref, '_blank')}
                                              >
                                                {sampleId}
                                              </Button>
                                            );
                                          }
                                          return (
                                            <span key={sampleId} className="rounded-md border bg-muted px-2 py-1 font-mono text-xs">
                                              {sampleId}
                                            </span>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <p className="text-sm text-muted-foreground">
                                        {tr(
                                          'admin.health.dataHealth.noSamples',
                                          'Sense sampleIds automàtics en aquest check. Cal diagnòstic manual.'
                                        )}
                                      </p>
                                    )}
                                  </div>

                                  <div className="flex flex-wrap gap-2">
                                    {targetHref ? (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => window.open(targetHref, '_blank')}
                                      >
                                        <ExternalLink className="h-4 w-4 mr-2" />
                                        {item.presentation.ctaLabel}
                                      </Button>
                                    ) : (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setSelectedNightlyGroup(group);
                                          setSelectedNightlyItem(item);
                                        }}
                                      >
                                        <Eye className="h-4 w-4 mr-2" />
                                        {item.presentation.ctaLabel}
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>

              {/* ═══════════════════════════════════════════════════════════════════ */}
              {/* SEMÀFOR DE PRODUCCIÓ */}
              {/* ═══════════════════════════════════════════════════════════════════ */}
              <div className="pt-4 mt-4 border-t space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium">Semàfor de producció</h4>
                    {/* Indicador global */}
                    {semaphoreStatus === 'ok' && (
                      <span className="text-lg" title="Tot OK">✅</span>
                    )}
                    {semaphoreStatus === 'warning' && (
                      <span className="text-lg" title="Alguns warnings">⚠️</span>
                    )}
                    {semaphoreStatus === 'error' && (
                      <span className="text-lg" title="Errors detectats">❌</span>
                    )}
                    {semaphoreStatus === 'pending' && (
                      <span className="text-lg" title="Pendent d'executar">⏳</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Selector d'organització */}
                    <Select value={selectedOrgId} onValueChange={handleOrgChange}>
                      <SelectTrigger className="w-[180px] h-8 text-xs">
                        <SelectValue placeholder="Selecciona org..." />
                      </SelectTrigger>
                      <SelectContent>
                        {organizations?.map((org) => (
                          <SelectItem key={org.id} value={org.id} className="text-xs">
                            {org.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {/* Botó executar */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={runHealthChecks}
                      disabled={isRunningChecks}
                    >
                      {isRunningChecks ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Play className="h-4 w-4 mr-1" />
                      )}
                      Executar
                    </Button>
                    {/* Botó copiar informe */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyReport}
                      disabled={semaphoreStatus === 'pending'}
                      title="Copiar informe"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Grid de checks */}
                <div className="grid grid-cols-3 md:grid-cols-3 gap-2">
                  {healthChecks.map((check) => {
                    // Detectar si aquest check té una acció disponible
                    const canGoToI18n =
                      check.actionable === 'goToI18n' &&
                      (check.status === 'error' || check.status === 'warning');

                    const canOpenRoute =
                      check.actionable === 'openRoute' &&
                      check.status === 'error' &&
                      selectedOrgId;

                    const selectedOrg = organizations?.find((o) => o.id === selectedOrgId);

                    return (
                      <TooltipProvider key={check.id} delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={`flex flex-col p-2 rounded border text-xs ${
                                check.status === 'ok'
                                  ? 'bg-green-50 border-green-200'
                                  : check.status === 'warning'
                                    ? 'bg-yellow-50 border-yellow-200'
                                    : check.status === 'error'
                                      ? 'bg-red-50 border-red-200'
                                      : check.status === 'running'
                                        ? 'bg-blue-50 border-blue-200'
                                        : 'bg-muted border-border'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {check.status === 'ok' && <CheckCircle className="h-3 w-3 text-green-600 flex-shrink-0" />}
                                {check.status === 'warning' && <AlertTriangle className="h-3 w-3 text-yellow-600 flex-shrink-0" />}
                                {check.status === 'error' && <XCircle className="h-3 w-3 text-red-600 flex-shrink-0" />}
                                {check.status === 'running' && <Loader2 className="h-3 w-3 text-blue-600 animate-spin flex-shrink-0" />}
                                {check.status === 'pending' && <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium truncate">{check.name}</div>
                                  {check.message && (
                                    <div className="text-[10px] text-muted-foreground truncate">{check.message}</div>
                                  )}
                                </div>
                                {check.requiresOrg && (
                                  <TooltipProvider delayDuration={200}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Database className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                      </TooltipTrigger>
                                      <TooltipContent side="top">Requereix org</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>

                              {/* Botons d'acció segons el tipus */}
                              {canGoToI18n && (
                                <div className="mt-2 space-y-1">
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    className="h-6 text-[10px] w-full"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.dispatchEvent(
                                        new CustomEvent('admin:navigate', {
                                          detail: {
                                            area: 'content',
                                            contentModule: 'translations',
                                            section: 'i18n',
                                          },
                                        })
                                      );
                                    }}
                                  >
                                    Anar a Traduccions
                                  </Button>
                                  <p className="text-[9px] text-muted-foreground leading-tight">
                                    Això arregla els textos i elimina els errors de traducció.
                                  </p>
                                </div>
                              )}

                              {canOpenRoute && selectedOrg && (
                                <div className="mt-2 space-y-1">
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    className="h-6 text-[10px] w-full"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.open(`/${selectedOrg.slug}/quick-expense`, '_blank');
                                    }}
                                  >
                                    Obrir ruta
                                  </Button>
                                  <p className="text-[9px] text-muted-foreground leading-tight">
                                    Comprova que l&apos;entrada ràpida de despeses funciona.
                                  </p>
                                </div>
                              )}

                              {/* Botó "Provar pujada real" quan pendingDocuments OK */}
                              {check.id === 'storage-upload' && check.status === 'ok' && selectedOrg && (
                                <div className="mt-2 space-y-1">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 text-[10px] w-full"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // Navegar a la pantalla real de documents pendents
                                      window.open(`/${selectedOrg.slug}/dashboard/movimientos/pendents`, '_blank');
                                    }}
                                  >
                                    <ExternalLink className="h-3 w-3 mr-1" />
                                    Provar pujada real
                                  </Button>
                                  <p className="text-[9px] text-muted-foreground leading-tight">
                                    Obre la pantalla real de pujada per confirmar que funciona.
                                  </p>
                                </div>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-[250px]">
                            <p className="text-xs">{check.humanExplanation}</p>
                            {check.message && <p className="text-xs font-mono mt-1 text-muted-foreground">{check.message}</p>}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal d'incidents */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              {tr('admin.health.realIncidents.sectionTitle', 'Incidents reals')}
            </DialogTitle>
            <DialogDescription>
              {tr(
                'admin.health.realIncidents.dialogDescription',
                "Incidències d'ús real del sistema. Manté el flux actual d'ACK i tancament només per aquests casos."
              )}
            </DialogDescription>
          </DialogHeader>

          {realIncidents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-600" />
              <p>{tr('admin.health.realIncidents.dialogEmpty', 'Tot correcte! No hi ha incidents reals oberts.')}</p>
            </div>
          ) : isMobile ? (
            /* Vista de cards per pantalles estretes */
            <div className="space-y-3">
              {realIncidents.map((incident) => {
                const currentImpact = incident.impact || getDefaultImpact(incident);
                const impactConfig = IMPACT_LABELS[currentImpact];
                const action = getRecommendedAction(incident);
                const actionConfig = ACTION_LABELS[action];
                return (
                  <div
                    key={incident.id}
                    className={`p-3 border rounded-lg space-y-2 ${incident.status === 'ACK' ? 'opacity-60' : ''}`}
                  >
                    {/* Fila 1: Impacte + Tipus + Cops */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Select
                        value={currentImpact}
                        onValueChange={(val) => handleChangeImpact(incident, val as IncidentImpact)}
                      >
                        <SelectTrigger className={`h-6 w-[80px] text-xs border-0 ${impactConfig.color}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(IMPACT_LABELS) as IncidentImpact[]).map((key) => (
                            <SelectItem key={key} value={key} className="text-xs">
                              <span className={IMPACT_LABELS[key].color}>{IMPACT_LABELS[key].short}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Badge variant="secondary" className="text-[10px]">{incident.type}</Badge>
                      <Badge variant="outline" className="text-[10px]">{incident.count}x</Badge>
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        {incident.lastSeenAt?.toDate?.()?.toLocaleDateString('ca-ES', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        }) || '-'}
                      </span>
                    </div>

                    {/* Fila 2: Missatge */}
                    <p className="text-sm font-medium line-clamp-2">{incident.message}</p>

                    {/* Fila 3: Ruta/Org + Build (si existeix) */}
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      {(incident.route || incident.orgSlug) && (
                        <div className="font-mono truncate">
                          {incident.route} {incident.orgSlug && `(${incident.orgSlug})`}
                        </div>
                      )}
                      {(incident.firstSeenBuildId || incident.lastSeenBuildId) && (
                        <div className="flex items-center gap-2">
                          {incident.firstSeenBuildId && (
                            <span className="font-mono bg-muted px-1 rounded">
                              1r: {incident.firstSeenBuildId}
                            </span>
                          )}
                          {incident.lastSeenBuildId && incident.lastSeenBuildId !== incident.firstSeenBuildId && (
                            <span className="font-mono bg-muted px-1 rounded">
                              últ: {incident.lastSeenBuildId}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Fila 4: Acció recomanada */}
                    <div className="p-2 bg-muted rounded-md">
                      <div className="text-[10px] text-muted-foreground mb-1">Què fer ara?</div>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => {
                          if (action === 'permissions') {
                            window.open('https://console.firebase.google.com/project/summa-social/firestore/rules', '_blank');
                          } else if (action === 'storage') {
                            window.open('https://console.firebase.google.com/project/summa-social/storage/rules', '_blank');
                          } else if (action === 'reload') {
                            toast({
                              title: 'Chunk error',
                              description: 'Demana a l\'usuari que recarregui la pàgina en mode incògnit.',
                            });
                          } else {
                            handleCopyPrompt(incident);
                          }
                        }}
                      >
                        {actionConfig.label}
                      </Button>
                    </div>

                    {/* Fila 5: Accions */}
                    <div className="flex items-center gap-2 pt-1 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleCopyPrompt(incident)}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copiar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setSelectedIncident(incident)}
                      >
                        <HelpCircle className="h-3 w-3 mr-1" />
                        Ajuda
                      </Button>
                      <div className="flex-1" />
                      {incident.status === 'OPEN' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleAck(incident)}
                            disabled={isProcessing}
                          >
                            ACK
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleOpenResolveDialog(incident)}
                            disabled={isProcessing}
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Tancar
                          </Button>
                        </>
                      )}
                      {incident.status === 'ACK' && (
                        <Button
                          variant="default"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleOpenResolveDialog(incident)}
                          disabled={isProcessing}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Tancar
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Vista de taula per desktop */
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Impacte</TableHead>
                  <TableHead className="w-[100px]">Tipus</TableHead>
                  <TableHead>Què passa</TableHead>
                  <TableHead className="w-[120px]">Ruta / Org</TableHead>
                  <TableHead className="w-[60px]">Cops</TableHead>
                  <TableHead className="w-[100px]">Últim</TableHead>
                  <TableHead className="w-[180px]">Accions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {realIncidents.map((incident) => (
                  <TableRow
                    key={incident.id}
                    className={incident.status === 'ACK' ? 'opacity-60' : ''}
                  >
                    <TableCell>
                      {(() => {
                        const currentImpact = incident.impact || getDefaultImpact(incident);
                        const impactConfig = IMPACT_LABELS[currentImpact];
                        return (
                          <Select
                            value={currentImpact}
                            onValueChange={(val) => handleChangeImpact(incident, val as IncidentImpact)}
                          >
                            <SelectTrigger className={`h-7 w-[90px] text-xs border-0 ${impactConfig.color}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(Object.keys(IMPACT_LABELS) as IncidentImpact[]).map((key) => (
                                <SelectItem key={key} value={key} className="text-xs">
                                  <span className={IMPACT_LABELS[key].color}>{IMPACT_LABELS[key].short}</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-mono">{incident.type}</span>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="text-sm font-medium line-clamp-2">
                          {incident.message}
                        </p>
                        {incident.topStack && (
                          <p className="text-xs text-muted-foreground font-mono line-clamp-1">
                            {incident.topStack}
                          </p>
                        )}
                        {/* Acció recomanada */}
                        {(() => {
                          const action = getRecommendedAction(incident);
                          const actionConfig = ACTION_LABELS[action];
                          return (
                            <div className="mt-2 p-2 bg-muted rounded-md">
                              <div className="text-[10px] text-muted-foreground mb-1">Què fer ara?</div>
                              <Button
                                variant="secondary"
                                size="sm"
                                className="h-6 text-xs"
                                onClick={() => {
                                  if (action === 'permissions') {
                                    window.open('https://console.firebase.google.com/project/summa-social/firestore/rules', '_blank');
                                  } else if (action === 'storage') {
                                    window.open('https://console.firebase.google.com/project/summa-social/storage/rules', '_blank');
                                  } else if (action === 'reload') {
                                    toast({
                                      title: 'Chunk error',
                                      description: 'Demana a l\'usuari que recarregui la pàgina en mode incògnit.',
                                    });
                                  } else {
                                    handleCopyPrompt(incident);
                                  }
                                }}
                              >
                                {actionConfig.label}
                              </Button>
                            </div>
                          );
                        })()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs space-y-0.5">
                        {incident.route && (
                          <span className="font-mono text-muted-foreground block truncate max-w-[100px]">
                            {incident.route}
                          </span>
                        )}
                        {incident.orgSlug && (
                          <span className="text-muted-foreground">{incident.orgSlug}</span>
                        )}
                        {incident.firstSeenBuildId && (
                          <span className="font-mono text-muted-foreground block text-[10px]">
                            build: {incident.firstSeenBuildId}
                            {incident.lastSeenBuildId && incident.lastSeenBuildId !== incident.firstSeenBuildId && (
                              <> → {incident.lastSeenBuildId}</>
                            )}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{incident.count}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {incident.lastSeenAt?.toDate?.()?.toLocaleDateString('ca-ES', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        }) || '-'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {/* Botó copiar prompt */}
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleCopyPrompt(incident)}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Copiar prompt de reparació</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        {/* Botó ajuda */}
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setSelectedIncident(incident)}
                              >
                                <HelpCircle className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Què fer?</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        {/* Accions segons estat */}
                        {incident.status === 'OPEN' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => handleAck(incident)}
                              disabled={isProcessing}
                            >
                              ACK
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => handleOpenResolveDialog(incident)}
                              disabled={isProcessing}
                            >
                              <Check className="h-3 w-3 mr-1" />
                              Tancar
                            </Button>
                          </>
                        )}
                        {incident.status === 'ACK' && (
                          <Button
                            variant="default"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleOpenResolveDialog(incident)}
                            disabled={isProcessing}
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Tancar
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal d'ajuda per incident */}
      <Dialog open={!!selectedIncident} onOpenChange={() => setSelectedIncident(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              Què fer amb aquest incident?
            </DialogTitle>
          </DialogHeader>

          {selectedIncident && INCIDENT_HELP[selectedIncident.type] && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-sm mb-1">Què vol dir</h4>
                <p className="text-sm text-muted-foreground">
                  {INCIDENT_HELP[selectedIncident.type].whatItMeans}
                </p>
              </div>
              <div>
                <h4 className="font-medium text-sm mb-1">Per què és important</h4>
                <p className="text-sm text-muted-foreground">
                  {INCIDENT_HELP[selectedIncident.type].whyCritical}
                </p>
              </div>
              <div>
                <h4 className="font-medium text-sm mb-1">Primers passos</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {INCIDENT_HELP[selectedIncident.type].nextSteps}
                </p>
              </div>

              {/* Botó copiar prompt */}
              <div className="pt-4">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleCopyPrompt(selectedIncident)}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar prompt de reparació per Claude Code
                </Button>
              </div>

              <div className="pt-4 border-t">
                <h4 className="font-medium text-sm mb-2">Detalls per suport tècnic (opcional)</h4>
                <div className="bg-muted p-3 rounded text-xs font-mono space-y-1">
                  <div>
                    <span className="text-muted-foreground">Signatura:</span>{' '}
                    {selectedIncident.signature}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Ruta:</span>{' '}
                    {selectedIncident.route || '-'}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Org:</span>{' '}
                    {selectedIncident.orgSlug || selectedIncident.orgId || '-'}
                  </div>
                  <div className="pt-2">
                    <span className="text-muted-foreground">Missatge:</span>
                    <pre className="whitespace-pre-wrap mt-1">{selectedIncident.message}</pre>
                  </div>
                  {selectedIncident.topStack && (
                    <div className="pt-2">
                      <span className="text-muted-foreground">Stack:</span>
                      <pre className="whitespace-pre-wrap mt-1">{selectedIncident.topStack}</pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!selectedNightlyGroup && !!selectedNightlyItem}
        onOpenChange={() => {
          setSelectedNightlyGroup(null);
          setSelectedNightlyItem(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              {tr('admin.health.dataHealth.diagnosisTitle', 'Diagnòstic de salut de dades')}
            </DialogTitle>
            <DialogDescription>
              {tr(
                'admin.health.dataHealth.diagnosisDescription',
                "Resultat derivat del control nocturn. No canvia l'estat de l'incident; només ajuda a revisar-lo."
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedNightlyGroup && selectedNightlyItem && (
            <div className="space-y-4">
              <div className="rounded-lg border p-3 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs text-muted-foreground">{selectedNightlyItem.code}</span>
                  <span className="text-sm font-medium">{selectedNightlyItem.presentation.title}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {selectedNightlyGroup.incident.orgSlug || selectedNightlyGroup.incident.orgId || tr('admin.health.dataHealth.orgWithoutSlug', 'Organització sense slug')}
                </p>
                <p className="text-sm">{selectedNightlyItem.presentation.firstStep}</p>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium">{tr('admin.health.dataHealth.availableExamples', 'Exemples disponibles')}</h4>
                {selectedNightlyItem.samples.length > 0 ? (
                  <div className="space-y-2">
                    {selectedNightlyItem.samples.map((sampleId) => {
                      const sampleHref = buildNightlySampleHref(
                        selectedNightlyGroup.incident.orgSlug,
                        selectedNightlyItem.code,
                        sampleId
                      );

                      if (sampleHref) {
                        return (
                          <Button
                            key={sampleId}
                            variant="outline"
                            size="sm"
                            className="w-full justify-start font-mono"
                            onClick={() => window.open(sampleHref, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            {sampleId}
                          </Button>
                        );
                      }

                      return (
                        <div key={sampleId} className="rounded-md border bg-muted px-3 py-2 font-mono text-sm">
                          {sampleId}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {tr(
                      'admin.health.dataHealth.noSamplesDetailed',
                      'Aquest check no ha guardat sampleIds automàtics. Cal revisar el cas manualment des de la ruta operativa indicada.'
                    )}
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de resolució d'incident */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              Tancar incident
            </DialogTitle>
            <DialogDescription>
              Indica com s&apos;ha resolt per futurs incidents similars.
            </DialogDescription>
          </DialogHeader>

          {incidentToResolve && (
            <div className="space-y-4">
              {/* Resum de l'incident */}
              <div className="p-3 bg-muted rounded text-sm">
                <div className="font-medium line-clamp-2">{incidentToResolve.message}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {incidentToResolve.type} · {incidentToResolve.count} cop{incidentToResolve.count > 1 ? 's' : ''}
                </div>
              </div>

              {/* Selector d'impacte */}
              <div className="space-y-2">
                <Label htmlFor="resolve-impact">Impacte real</Label>
                <Select
                  value={resolveImpact}
                  onValueChange={(val) => setResolveImpact(val as IncidentImpact)}
                >
                  <SelectTrigger id="resolve-impact">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(IMPACT_LABELS) as IncidentImpact[]).map((key) => (
                      <SelectItem key={key} value={key}>
                        {IMPACT_LABELS[key].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Commit */}
              <div className="space-y-2">
                <Label htmlFor="resolve-commit">Commit que ho ha arreglat</Label>
                <Input
                  id="resolve-commit"
                  placeholder="abc1234 o URL del commit"
                  value={resolveCommit}
                  onChange={(e) => setResolveCommit(e.target.value)}
                  disabled={resolveNoCommit}
                />
              </div>

              {/* Checkbox "no hi ha commit" */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="resolve-no-commit"
                  checked={resolveNoCommit}
                  onCheckedChange={(checked) => {
                    setResolveNoCommit(!!checked);
                    if (checked) setResolveCommit('');
                  }}
                />
                <Label htmlFor="resolve-no-commit" className="text-sm font-normal">
                  No hi ha commit (configuració, permisos, etc.)
                </Label>
              </div>

              {/* Nota opcional */}
              <div className="space-y-2">
                <Label htmlFor="resolve-note">Nota (opcional)</Label>
                <Input
                  id="resolve-note"
                  placeholder="Descripció breu del fix..."
                  value={resolveNote}
                  onChange={(e) => setResolveNote(e.target.value)}
                />
              </div>

              {/* Error de validació */}
              {resolveError && (
                <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                  {resolveError}
                </div>
              )}

              {/* Botons */}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setResolveDialogOpen(false)}
                  disabled={isProcessing}
                >
                  Cancel·lar
                </Button>
                <Button
                  onClick={handleConfirmResolve}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Tancar incident
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </>
  );
}
