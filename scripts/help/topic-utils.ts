import { readdirSync, readFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'

export type TopicLang = 'ca' | 'es'

export type TopicArea =
  | 'moviments'
  | 'remeses'
  | 'devolucions'
  | 'stripe'
  | 'fiscal'
  | 'donants'
  | 'sepa'
  | 'config'
  | 'projectes'
  | 'documents'

export type RiskPolicy = 'safe' | 'fiscal' | 'sepa' | 'remittances' | 'danger'

export type TopicFrontmatter = {
  id: string
  title: string
  area: TopicArea
  route: string
  keywords: string[]
  riskPolicy: RiskPolicy
  guideId?: string
  intents?: string[]
}

export type TopicSections = {
  problem: string
  stepsText: string
  steps: string[]
  check: string
  error: string
}

export type ParsedTopic = {
  lang: TopicLang
  filePath: string
  frontmatter: TopicFrontmatter
  sections: TopicSections
  raw: string
}

export type TopicPair = {
  id: string
  ca: ParsedTopic
  es: ParsedTopic
}

const TOPIC_FILE_RE = /^([a-z0-9]+(?:-[a-z0-9]+)*)\.(ca|es)\.md$/

const REQUIRED_SECTIONS: Record<keyof TopicSections, string[]> = {
  problem: ['problema concret', 'problema concreto'],
  stepsText: ['passos exactes', 'pasos exactos'],
  steps: ['passos exactes', 'pasos exactos'],
  check: ['comprovacio final', 'comprobacion final'],
  error: ['error tipic', 'error tipico'],
}

const VALID_AREAS = new Set<TopicArea>([
  'moviments',
  'remeses',
  'devolucions',
  'stripe',
  'fiscal',
  'donants',
  'sepa',
  'config',
  'projectes',
  'documents',
])

const VALID_RISK_POLICIES = new Set<RiskPolicy>([
  'safe',
  'fiscal',
  'sepa',
  'remittances',
  'danger',
])

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

function parseScalar(raw: string): string {
  const value = raw.trim()
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1).trim()
  }
  return value
}

function parseFrontmatter(block: string, filePath: string): TopicFrontmatter {
  const lines = block
    .split(/\r?\n/)
    .map(line => line.replace(/\t/g, '  '))

  const raw: Record<string, string | string[]> = {}
  let currentListKey: string | null = null

  for (const originalLine of lines) {
    const line = originalLine.trimEnd()
    if (!line.trim() || line.trim().startsWith('#')) continue

    const keyMatch = line.match(/^([a-zA-Z][a-zA-Z0-9]*):\s*(.*)$/)
    if (keyMatch) {
      const key = keyMatch[1]
      const value = keyMatch[2].trim()
      if (!value) {
        raw[key] = []
        currentListKey = key
      } else {
        raw[key] = parseScalar(value)
        currentListKey = null
      }
      continue
    }

    const listMatch = line.match(/^\s*-\s+(.+)$/)
    if (listMatch && currentListKey) {
      const list = raw[currentListKey]
      if (!Array.isArray(list)) {
        throw new Error(`[topic-utils] ${filePath}: invalid list key ${currentListKey}`)
      }
      list.push(parseScalar(listMatch[1]))
      continue
    }

    throw new Error(`[topic-utils] ${filePath}: unsupported frontmatter line "${originalLine}"`)
  }

  const keywordsRaw = raw.keywords
  const intentsRaw = raw.intents

  assert(typeof raw.id === 'string' && raw.id.length > 0, `[topic-utils] ${filePath}: missing frontmatter id`)
  assert(typeof raw.title === 'string' && raw.title.length > 0, `[topic-utils] ${filePath}: missing frontmatter title`)
  assert(typeof raw.area === 'string' && raw.area.length > 0, `[topic-utils] ${filePath}: missing frontmatter area`)
  assert(typeof raw.route === 'string' && raw.route.length > 0, `[topic-utils] ${filePath}: missing frontmatter route`)
  assert(typeof raw.riskPolicy === 'string' && raw.riskPolicy.length > 0, `[topic-utils] ${filePath}: missing frontmatter riskPolicy`)

  const topic: TopicFrontmatter = {
    id: String(raw.id).trim(),
    title: String(raw.title).trim(),
    area: String(raw.area).trim() as TopicArea,
    route: String(raw.route).trim(),
    keywords: Array.isArray(keywordsRaw)
      ? keywordsRaw.map(item => item.trim()).filter(Boolean)
      : typeof keywordsRaw === 'string'
        ? keywordsRaw.split(',').map(item => item.trim()).filter(Boolean)
        : [],
    riskPolicy: String(raw.riskPolicy).trim() as RiskPolicy,
  }

  if (typeof raw.guideId === 'string' && raw.guideId.trim()) {
    topic.guideId = raw.guideId.trim()
  }

  if (Array.isArray(intentsRaw)) {
    topic.intents = intentsRaw.map(item => item.trim()).filter(Boolean)
  } else if (typeof intentsRaw === 'string') {
    topic.intents = intentsRaw.split(',').map(item => item.trim()).filter(Boolean)
  }

  if (!VALID_AREAS.has(topic.area)) {
    throw new Error(`[topic-utils] ${filePath}: invalid area "${topic.area}"`)
  }
  if (!VALID_RISK_POLICIES.has(topic.riskPolicy)) {
    throw new Error(`[topic-utils] ${filePath}: invalid riskPolicy "${topic.riskPolicy}"`)
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(topic.id)) {
    throw new Error(`[topic-utils] ${filePath}: id must be kebab-case`)
  }

  return topic
}

function parseMarkdownSections(body: string): Record<string, string> {
  const lines = body.split(/\r?\n/)
  const sections = new Map<string, string[]>()
  let current: string | null = null

  for (const line of lines) {
    const heading = line.match(/^##\s+(.+)$/)
    if (heading) {
      current = normalizeText(heading[1])
      if (!sections.has(current)) {
        sections.set(current, [])
      }
      continue
    }

    if (!current) continue
    sections.get(current)?.push(line)
  }

  const out: Record<string, string> = {}
  for (const [heading, contentLines] of sections.entries()) {
    out[heading] = contentLines.join('\n').trim()
  }
  return out
}

function pickRequiredSection(parsed: Record<string, string>, names: string[], filePath: string): string {
  for (const name of names) {
    if (parsed[name] && parsed[name].trim()) {
      return parsed[name].trim()
    }
  }

  throw new Error(
    `[topic-utils] ${filePath}: missing required section. Expected one of: ${names.join(', ')}`
  )
}

function extractNumberedSteps(section: string): string[] {
  return section
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => /^\d+\.\s+/.test(line))
    .map(line => line.replace(/^\d+\.\s+/, '').trim())
    .filter(Boolean)
}

export function parseTopicFile(filePath: string): ParsedTopic {
  const raw = readFileSync(filePath, 'utf8')
  const name = basename(filePath)
  const match = name.match(TOPIC_FILE_RE)
  const idFromFile = match?.[1]
  const langFromFile = match?.[2]
  if (!idFromFile || !langFromFile) {
    throw new Error(`[topic-utils] Invalid topic filename: ${name}`)
  }

  const lang = langFromFile as TopicLang

  const frontmatterMatch = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!frontmatterMatch) {
    throw new Error(`[topic-utils] ${filePath}: missing or invalid frontmatter block`) 
  }

  const frontmatter = parseFrontmatter(frontmatterMatch[1], filePath)
  if (frontmatter.id !== idFromFile) {
    throw new Error(`[topic-utils] ${filePath}: frontmatter id "${frontmatter.id}" does not match filename id "${idFromFile}"`)
  }

  const sectionMap = parseMarkdownSections(frontmatterMatch[2])
  const problem = pickRequiredSection(sectionMap, REQUIRED_SECTIONS.problem, filePath)
  const stepsText = pickRequiredSection(sectionMap, REQUIRED_SECTIONS.stepsText, filePath)
  const check = pickRequiredSection(sectionMap, REQUIRED_SECTIONS.check, filePath)
  const error = pickRequiredSection(sectionMap, REQUIRED_SECTIONS.error, filePath)
  const steps = extractNumberedSteps(stepsText)

  return {
    lang,
    filePath,
    frontmatter,
    sections: { problem, stepsText, steps, check, error },
    raw,
  }
}

export function listTopicMarkdownFiles(rootDir = 'help/topics'): string[] {
  const absoluteDir = resolve(process.cwd(), rootDir)
  const entries = readdirSync(absoluteDir)
  return entries
    .filter(entry => TOPIC_FILE_RE.test(entry))
    .map(entry => join(absoluteDir, entry))
    .sort((a, b) => a.localeCompare(b))
}

export function loadTopicPairs(rootDir = 'help/topics'): TopicPair[] {
  const parsed = listTopicMarkdownFiles(rootDir).map(filePath => parseTopicFile(filePath))
  const byId = new Map<string, Partial<Record<TopicLang, ParsedTopic>>>()

  for (const topic of parsed) {
    const row = byId.get(topic.frontmatter.id) ?? {}
    row[topic.lang] = topic
    byId.set(topic.frontmatter.id, row)
  }

  const missing: string[] = []
  const pairs: TopicPair[] = []

  for (const [id, row] of Array.from(byId.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    const ca = row.ca
    const es = row.es
    if (!ca || !es) {
      missing.push(`${id}: missing ${ca ? 'es' : 'ca'} pair`)
      continue
    }

    pairs.push({ id, ca, es })
  }

  if (missing.length > 0) {
    throw new Error(`[topic-utils] Missing language pair(s):\n- ${missing.join('\n- ')}`)
  }

  return pairs
}

export type TopicValidationResult = {
  errors: string[]
  warnings: string[]
}

export function validateTopicPair(pair: TopicPair): TopicValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  const variants: ParsedTopic[] = [pair.ca, pair.es]

  for (const topic of variants) {
    const fileLabel = `${topic.frontmatter.id}.${topic.lang}`
    if (topic.frontmatter.keywords.length === 0) {
      errors.push(`${fileLabel}: keywords must include at least one value`)
    }
    if (!topic.frontmatter.route.trim()) {
      errors.push(`${fileLabel}: route is required`)
    }
    if (topic.sections.steps.length === 0) {
      errors.push(`${fileLabel}: section "Passos exactes/Pasos exactos" must include numbered steps (1..n)`)
    }
    if (topic.sections.problem.length < 20) {
      warnings.push(`${fileLabel}: "Problema concret" is very short (<20 chars)`) 
    }
    if (topic.sections.error.length < 15) {
      warnings.push(`${fileLabel}: "Error tipic/tipico" is very short (<15 chars)`) 
    }
  }

  if (pair.ca.frontmatter.area !== pair.es.frontmatter.area) {
    errors.push(`${pair.id}: area mismatch between CA and ES`)
  }
  if (pair.ca.frontmatter.riskPolicy !== pair.es.frontmatter.riskPolicy) {
    errors.push(`${pair.id}: riskPolicy mismatch between CA and ES`)
  }
  if ((pair.ca.frontmatter.guideId ?? '') !== (pair.es.frontmatter.guideId ?? '')) {
    errors.push(`${pair.id}: guideId mismatch between CA and ES`)
  }

  return { errors, warnings }
}

export function linesFromSection(text: string): string[] {
  const stripped = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => line.replace(/^[-*]\s+/, '').trim())

  if (stripped.length > 1) return stripped

  return text
    .split(/[.;]\s+/)
    .map(chunk => chunk.trim())
    .filter(Boolean)
}

export function firstSentence(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  const split = normalized.split(/([.!?])/)
  if (split.length <= 1) return normalized
  return `${split[0]}${split[1] ?? ''}`.trim()
}
