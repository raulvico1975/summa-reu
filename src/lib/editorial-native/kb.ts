import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'

const DEFAULT_ENTITATS_KB_PATH = '/mnt/data/KNOWLEDGE_BASE_Entitats.md'
const DOWNLOADS_ENTITATS_KB_PATH = path.join(homedir(), 'Downloads', 'KNOWLEDGE_BASE_Entitats.md')

type KbSection = {
  id: string
  heading: string
  body: string
  tags: string[]
  entityTypes: string[]
}

export interface NativeBlogKbContext {
  path: string
  available: boolean
  refs: string[]
  snippets: string[]
}

const TAG_PATTERNS: Array<[string, RegExp]> = [
  ['fundacions', /\bfundaci[oó](ns)?\b/i],
  ['associacions', /\bassociaci[oó](ns)?\b/i],
  ['ong', /\bONG\b/i],
  ['donacions', /\bdonacions?\b/i],
  ['quotes', /\bquotes?\b/i],
  ['subvencions', /\bsubvencions?\b/i],
  ['justificacio', /\bjustificac/i],
  ['model-182', /\bmodel\s*182\b/i],
  ['model-347', /\bmodel\s*347\b/i],
  ['iva', /\bIVA\b/i],
  ['remeses', /\bremeses?\b/i],
  ['tresoreria', /\btresoreria\b/i],
]

function uniquePaths(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])]
}

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

function inferTags(text: string): string[] {
  return TAG_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([tag]) => tag)
}

function inferEntityTypes(text: string): string[] {
  const values = new Set<string>()

  if (/\bfundaci[oó](ns)?\b/i.test(text)) values.add('fundacio')
  if (/\bassociaci[oó](ns)?\b/i.test(text)) values.add('associacio')
  if (/\bONG\b/i.test(text)) values.add('ong')

  return [...values]
}

function normalizeForSearch(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function tokenize(text: string): string[] {
  return normalizeForSearch(text)
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
}

function buildSections(markdown: string): KbSection[] {
  const lines = markdown.split('\n')
  const sections: KbSection[] = []

  let currentHeading = 'Arrel'
  let currentBody: string[] = []

  const flushSection = () => {
    const body = currentBody.join('\n').trim()
    if (!body) {
      currentBody = []
      return
    }

    const text = `${currentHeading}\n${body}`
    sections.push({
      id: `kb:${slugify(currentHeading)}`,
      heading: currentHeading,
      body,
      tags: inferTags(text),
      entityTypes: inferEntityTypes(text),
    })
    currentBody = []
  }

  for (const line of lines) {
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line)
    if (match) {
      flushSection()
      currentHeading = match[2].trim()
      continue
    }

    currentBody.push(line)
  }

  flushSection()
  return sections
}

function scoreSection(section: KbSection, queryText: string): number {
  const tokens = tokenize(queryText)
  if (tokens.length === 0) return 0

  const haystack = `${section.heading}\n${section.body}`
  const sectionTokens = new Set(tokenize(haystack))
  let score = 0

  for (const token of tokens) {
    if (normalizeForSearch(section.heading).includes(token)) {
      score += 5
    } else if (normalizeForSearch(section.body).includes(token)) {
      score += 2
    }
    if (sectionTokens.has(token)) {
      score += 1
    }
  }

  for (const tag of section.tags) {
    if (normalizeForSearch(queryText).includes(tag.toLowerCase())) {
      score += 4
    }
  }

  return score
}

function buildSnippet(section: KbSection): string {
  const firstParagraph = section.body.split('\n\n')[0]?.replace(/\s+/g, ' ').trim() ?? section.body
  return `${section.id} · ${section.heading}: ${firstParagraph.slice(0, 320)}`
}

export function getNativeEditorialKbPath(): string {
  return (
    uniquePaths([
      process.env.SUMMA_ENTITATS_KB_PATH,
      DOWNLOADS_ENTITATS_KB_PATH,
      DEFAULT_ENTITATS_KB_PATH,
    ])[0] ?? DEFAULT_ENTITATS_KB_PATH
  )
}

export async function resolveNativeBlogKbContext(queryText: string): Promise<NativeBlogKbContext> {
  const kbPath = getNativeEditorialKbPath()

  try {
    const raw = await readFile(kbPath, 'utf8')
    const sections = buildSections(raw)
      .map((section) => ({ section, score: scoreSection(section, queryText) }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 4)
      .map((entry) => entry.section)

    return {
      path: kbPath,
      available: true,
      refs: sections.map((section) => section.id),
      snippets: sections.map(buildSnippet),
    }
  } catch {
    return {
      path: kbPath,
      available: false,
      refs: [],
      snippets: [],
    }
  }
}

