import type { EngineCard, IntentType } from './types'
import type { KbLang } from '../bot-retrieval'
import { CONTEXT_HELP_UI_PATHS, DEFAULT_MANUAL_UI_PATHS } from '@/help/help-manual-links'

const OPERATIONAL_HINT_RE =
  /\b(com|como|on|donde|dónde|pujo|pujar|subir|imputo|imputar|dividir|enviar|configurar|crear|editar|esborrar|eliminar|generar|adjuntar|vincular|processar|procesar|pas\s*a\s*paso|pas\s*a\s*pas)\b/i

const PROCEDURAL_FREEFORM_RE = /\b(ves a|fes clic a|navega a|ve a|haz clic en|navega a)\b/i

const OPERATIONAL_PLACEHOLDER_RE =
  /revisa la gu[ií]a d['’]?aquest proc[eé]s dins de l['’]app|revisa la gu[ií]a de este proceso dentro de la app/i

const OFFICIAL_UI_PATH_PREFIXES = [
  'Dashboard',
  'Movimientos',
  'Moviments',
  'Donantes',
  'Donants',
  'Informes',
  'Proyectos',
  'Projectes',
  'Manual',
  'Configuración',
  'Configuració',
  'Header',
  'Liquidaciones',
  'Liquidacions',
  'Página de login',
  'Pàgina de login',
  'Login',
] as const

const DASHBOARD_ROUTE_UI_PATHS = [
  { prefix: '/dashboard/manual', uiPath: 'Manual' },
  { prefix: '/dashboard/movimientos', uiPath: 'Moviments' },
  { prefix: '/dashboard/donants', uiPath: 'Donants' },
  { prefix: '/dashboard/informes', uiPath: 'Informes' },
  { prefix: '/dashboard/configuracion', uiPath: 'Configuració' },
  { prefix: '/dashboard/project-module', uiPath: 'Projectes' },
  { prefix: '/dashboard/proveidors', uiPath: 'Proveïdors' },
  { prefix: '/dashboard/treballadors', uiPath: 'Treballadors' },
  { prefix: '/dashboard', uiPath: 'Dashboard' },
] as const

export const SAFE_FALLBACK_PATHS: Record<KbLang, string[]> = {
  ca: [CONTEXT_HELP_UI_PATHS.ca, DEFAULT_MANUAL_UI_PATHS.ca],
  es: [CONTEXT_HELP_UI_PATHS.es, DEFAULT_MANUAL_UI_PATHS.es],
}

export function isOperationalIntent(message: string): boolean {
  const normalized = message.trim().toLowerCase()
  if (!normalized) return false
  return OPERATIONAL_HINT_RE.test(normalized)
}

function isCatalogPath(path: string): boolean {
  const cleaned = path.trim()
  if (!cleaned) return false
  return OFFICIAL_UI_PATH_PREFIXES.some(prefix => cleaned === prefix || cleaned.startsWith(`${prefix} > `))
}

function mapDashboardRouteToCatalogPath(path: string): string | null {
  const cleaned = path
    .trim()
    .split('?')[0]
    .split('#')[0]
    .replace(/\/+$/, '')

  if (!cleaned.startsWith('/')) return null

  const match = DASHBOARD_ROUTE_UI_PATHS.find(entry => cleaned === entry.prefix || cleaned.startsWith(`${entry.prefix}/`))
  return match?.uiPath ?? null
}

function normalizeUiPath(path: string): string {
  const mappedPath = mapDashboardRouteToCatalogPath(path)
  if (mappedPath) return mappedPath

  return path
    .trim()
    .replace(/\s*(->|→)\s*/g, ' > ')
    .replace(/\s+/g, ' ')
}

export function normalizeUiPathsAgainstCatalog(paths: string[] | null | undefined): string[] {
  if (!Array.isArray(paths)) return []
  const unique = Array.from(new Set(paths.map(path => normalizeUiPath(path)).filter(Boolean)))
  return unique.filter(isCatalogPath)
}

export function extractOperationalSteps(answer: string): string[] {
  if (!answer) return []
  return answer
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => /^\d+\.\s+/.test(line))
    .filter(line => !OPERATIONAL_PLACEHOLDER_RE.test(line))
}

// Required by product guardrail spec (P0)
export function canRenderOperational(card: EngineCard | null): boolean {
  return !!card && card.steps?.length > 0
}

export function containsProceduralFreeform(text: string): boolean {
  return PROCEDURAL_FREEFORM_RE.test(text)
}

export function isTrustedOperationalCard(card: EngineCard | null): boolean {
  return !!(
    card &&
    card.source === 'validated-kb' &&
    canRenderOperational(card) &&
    card.uiPathsAllowed.length > 0
  )
}

export function enforceNonProceduralIfUntrusted(answer: string, card: EngineCard | null): string {
  if (!answer) return answer
  if (isTrustedOperationalCard(card)) return answer

  const filteredLines = answer
    .split(/\r?\n/)
    .filter(line => !PROCEDURAL_FREEFORM_RE.test(line))

  const sanitized = filteredLines.join('\n').trim()
  if (sanitized) return sanitized

  return answer
}
