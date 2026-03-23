import type { KBCard } from './load-kb'

export type SupportTurn = {
  role: 'user' | 'bot'
  text: string
  cardId?: string
  mode?: 'card' | 'fallback'
}

export type SupportScreenContext = {
  pathname: string
  routeKey: string
  routeUiPath: string | null
  helpOpen: boolean
}

export type SupportContext = {
  screen: SupportScreenContext | null
  previousCardId?: string
  recentTurns: SupportTurn[]
}

const ROUTE_CATALOG = [
  { prefix: '/dashboard/manual', routeKey: 'manual', routeUiPath: 'Manual' },
  { prefix: '/dashboard/movimientos', routeKey: 'movimientos', routeUiPath: 'Moviments' },
  { prefix: '/dashboard/donants', routeKey: 'donants', routeUiPath: 'Donants' },
  { prefix: '/dashboard/informes', routeKey: 'informes', routeUiPath: 'Informes' },
  { prefix: '/dashboard/configuracion', routeKey: 'configuracion', routeUiPath: 'Configuració' },
  { prefix: '/dashboard/project-module', routeKey: 'project_module', routeUiPath: 'Projectes' },
  { prefix: '/dashboard/proveidors', routeKey: 'proveidors', routeUiPath: 'Proveïdors' },
  { prefix: '/dashboard/treballadors', routeKey: 'treballadors', routeUiPath: 'Treballadors' },
  { prefix: '/dashboard', routeKey: 'dashboard', routeUiPath: 'Dashboard' },
] as const

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeSupportPathname(pathname: string | null | undefined): string {
  const raw = typeof pathname === 'string' ? pathname : ''
  const clean = raw.split('?')[0]?.split('#')[0] ?? ''
  const parts = clean.split('/').filter(Boolean)

  if (parts.length > 0 && parts[0] !== 'dashboard') {
    parts.shift()
  }

  return parts.length > 0 ? `/${parts.join('/')}` : ''
}

function findRouteCatalogEntry(pathname: string) {
  return ROUTE_CATALOG.find(entry => pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`)) ?? null
}

function buildRouteKeyFromPath(pathname: string): string {
  const clean = pathname.replace(/^\/dashboard\//, '').replace(/^\//, '')
  if (!clean || pathname === '/dashboard') return 'dashboard'

  let key = clean
  if (key.startsWith('project-module/')) {
    key = key.replace('project-module/', 'project_')
  }

  key = key.replace(/projects\/[^/]+/g, 'projects/id')
  return key.replace(/-/g, '_').replace(/\//g, '_')
}

type RawScreenContext = {
  pathname?: unknown
  helpOpen?: unknown
}

function normalizeScreenContext(raw: unknown): SupportScreenContext | null {
  if (!raw || typeof raw !== 'object') return null

  const input = raw as RawScreenContext
  const pathname = normalizeSupportPathname(typeof input.pathname === 'string' ? input.pathname : '')
  if (!pathname) return null

  const match = findRouteCatalogEntry(pathname)

  return {
    pathname,
    routeKey: match?.routeKey ?? buildRouteKeyFromPath(pathname),
    routeUiPath: match?.routeUiPath ?? null,
    helpOpen: input.helpOpen === true,
  }
}

function normalizeSupportText(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  return raw.replace(/\s+/g, ' ').trim().slice(0, 240)
}

export function normalizeSupportTurns(raw: unknown, maxTurns = 6): SupportTurn[] {
  if (!Array.isArray(raw)) return []

  const normalized = raw
    .map((entry): SupportTurn | null => {
      if (!entry || typeof entry !== 'object') return null

      const role = (entry as { role?: unknown }).role
      if (role !== 'user' && role !== 'bot') return null

      const text = normalizeSupportText((entry as { text?: unknown }).text)
      if (!text) return null

      const cardIdRaw = (entry as { cardId?: unknown }).cardId
      const modeRaw = (entry as { mode?: unknown }).mode

      return {
        role,
        text,
        cardId: typeof cardIdRaw === 'string' && cardIdRaw.trim()
          ? cardIdRaw.trim().slice(0, 120)
          : undefined,
        mode: modeRaw === 'card' || modeRaw === 'fallback' ? modeRaw : undefined,
      }
    })
    .filter((entry): entry is SupportTurn => Boolean(entry))

  return normalized.slice(-maxTurns)
}

export function normalizeSupportContext(input: {
  screenContext?: unknown
  recentTurns?: unknown
  previousCardId?: string | undefined
}): SupportContext {
  const previousCardId = typeof input.previousCardId === 'string' && input.previousCardId.trim()
    ? input.previousCardId.trim().slice(0, 120)
    : undefined

  return {
    screen: normalizeScreenContext(input.screenContext),
    previousCardId,
    recentTurns: normalizeSupportTurns(input.recentTurns),
  }
}

export function isFollowUpMessage(message: string): boolean {
  const normalized = normalizeText(message)
  if (!normalized) return false

  const tokens = normalized.split(' ').filter(Boolean)
  const hasReferenceToken = tokens.some(token =>
    ['aixo', 'allo', 'eso', 'esto', 'ahi', 'alli', 'ho', 'lo', 'la', 'aqui', 'alla'].includes(token)
  )

  if (/\b(i ara|y ahora|i despres|i despues|y despues|seguent pas|siguiente paso)\b/.test(normalized)) {
    return true
  }

  if (/\b(i si falla|y si falla|i si no funciona|y si no funciona)\b/.test(normalized)) {
    return true
  }

  if (/\b(no ho trobo|no lo encuentro|no ho veig|no lo veo)\b/.test(normalized)) {
    return true
  }

  if (/\b(on|donde)\b/.test(normalized) && hasReferenceToken) {
    return true
  }

  if (/\b(com|como)\b/.test(normalized) && hasReferenceToken && tokens.length <= 6) {
    return true
  }

  return tokens.length <= 4 && hasReferenceToken
}

export function cardMatchesScreenContext(
  card: Pick<KBCard, 'uiPaths'>,
  screen: SupportScreenContext | null | undefined
): boolean {
  const routeUiPath = normalizeText(screen?.routeUiPath ?? '')
  if (!routeUiPath) return false

  return (card.uiPaths ?? []).some(path => {
    const normalizedPath = normalizeText(path.replace(/\s*(->|→)\s*/g, ' > '))
    return normalizedPath === routeUiPath || normalizedPath.startsWith(`${routeUiPath} > `)
  })
}
