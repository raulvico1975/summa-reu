import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { firstSentence, linesFromSection, loadTopicPairs, validateTopicPair, type ParsedTopic } from './topic-utils'

type FlatGuide = Record<string, string>
type LocaleCode = 'ca' | 'es' | 'fr' | 'pt'

function toGuideKey(topic: ParsedTopic): string {
  return topic.frontmatter.guideId?.trim() || topic.frontmatter.id
}

function toCardText(topic: ParsedTopic, lang: 'ca' | 'es'): string {
  const whatMeansLabel = lang === 'es' ? 'Que significa' : 'Que vol dir'
  const stepsLabel = lang === 'es' ? 'Pasos exactos' : 'Passos exactes'
  const helpfulLabel = lang === 'es' ? 'Te ayudara' : 'Et pot ajudar'

  const numberedSteps = topic.sections.steps
    .map((step, index) => `${index + 1}. ${step}`)
    .join('\n')

  return [
    `${whatMeansLabel}: ${firstSentence(topic.sections.problem)}`,
    '',
    `${stepsLabel}:`,
    numberedSteps,
    '',
    `${helpfulLabel}: ${firstSentence(topic.sections.check)}`,
  ].join('\n').trim()
}

function applyTopicToFlat(flat: FlatGuide, topic: ParsedTopic): void {
  const guideKey = toGuideKey(topic)
  const prefix = `guides.${guideKey}`
  const ctaPrefix = `guides.cta.${guideKey}`
  const lang = topic.lang

  const routeCta = lang === 'es'
    ? `Ir a: ${topic.frontmatter.route}`
    : `Ves a: ${topic.frontmatter.route}`

  const checkItems = linesFromSection(topic.sections.check)
  const avoidItems = linesFromSection(topic.sections.error)

  flat[`${prefix}.title`] = topic.frontmatter.title
  flat[`${prefix}.summary`] = firstSentence(topic.sections.problem)
  flat[`${prefix}.intro`] = topic.sections.problem.replace(/\s+/g, ' ').trim()
  flat[`${prefix}.whatIs`] = firstSentence(topic.sections.problem)
  flat[`${prefix}.cardText`] = toCardText(topic, lang)

  flat[`${prefix}.lookFirst.0`] = topic.frontmatter.route
  topic.sections.steps.forEach((step, index) => {
    flat[`${prefix}.steps.${index}`] = step
  })

  checkItems.forEach((item, index) => {
    flat[`${prefix}.checkBeforeExport.${index}`] = item
  })

  avoidItems.forEach((item, index) => {
    flat[`${prefix}.avoid.${index}`] = item
  })

  flat[`${prefix}.costlyError`] = firstSentence(topic.sections.error)
  flat[ctaPrefix] = routeCta
}

function extractGuideIdFromFlatKey(key: string): string | null {
  if (key.startsWith('guides.cta.')) {
    const id = key.slice('guides.cta.'.length).trim()
    return id || null
  }

  if (!key.startsWith('guides.')) return null
  const parts = key.split('.')
  const id = parts[1]
  if (!id || id === 'cta') return null
  return id
}

function groupFlatByGuide(flat: FlatGuide): Map<string, FlatGuide> {
  const grouped = new Map<string, FlatGuide>()
  for (const [key, value] of Object.entries(flat)) {
    const guideId = extractGuideIdFromFlatKey(key)
    if (!guideId) continue
    const row = grouped.get(guideId) ?? {}
    row[key] = value
    grouped.set(guideId, row)
  }
  return grouped
}

function isManagedGuideKey(key: string, guideId: string): boolean {
  const prefix = `guides.${guideId}.`
  if (key === `guides.cta.${guideId}`) return true
  if (key === `${prefix}title`) return true
  if (key === `${prefix}summary`) return true
  if (key === `${prefix}intro`) return true
  if (key === `${prefix}whatIs`) return true
  if (key === `${prefix}cardText`) return true
  if (key === `${prefix}costlyError`) return true
  if (key.startsWith(`${prefix}lookFirst.`)) return true
  if (key.startsWith(`${prefix}steps.`)) return true
  if (key.startsWith(`${prefix}checkBeforeExport.`)) return true
  if (key.startsWith(`${prefix}avoid.`)) return true
  return false
}

function applyGuidePatchToLocale(args: {
  existing: FlatGuide
  patchByGuide: Map<string, FlatGuide>
  keepExistingValues: boolean
}): FlatGuide {
  const { existing, patchByGuide, keepExistingValues } = args
  const original = existing
  const next: FlatGuide = { ...existing }

  for (const [guideId, patch] of patchByGuide.entries()) {
    const patchKeys = new Set(Object.keys(patch))
    for (const key of Object.keys(next)) {
      if (isManagedGuideKey(key, guideId) && !patchKeys.has(key)) {
        delete next[key]
      }
    }

    for (const [key, value] of Object.entries(patch)) {
      if (keepExistingValues) {
        const currentValue = original[key]
        if (typeof currentValue === 'string' && currentValue.trim().length > 0) {
          next[key] = currentValue
          continue
        }
      }
      next[key] = value
    }
  }

  return next
}

function localePath(lang: LocaleCode): string {
  return resolve(process.cwd(), 'src/i18n/locales', `${lang}.json`)
}

function readLocale(lang: LocaleCode): FlatGuide {
  return JSON.parse(readFileSync(localePath(lang), 'utf8')) as FlatGuide
}

function writeLocaleIfChanged(lang: LocaleCode, next: FlatGuide): boolean {
  const file = localePath(lang)
  const previous = readFileSync(file, 'utf8')
  const serialized = `${JSON.stringify(next, null, 2)}\n`
  if (previous === serialized) return false
  writeFileSync(file, serialized, 'utf8')
  return true
}

function main(): void {
  const pairs = loadTopicPairs('help/topics')
  const validationErrors: string[] = []

  for (const pair of pairs) {
    const result = validateTopicPair(pair)
    validationErrors.push(...result.errors)
  }

  if (validationErrors.length > 0) {
    console.error('[help:build-guides-adapter] Validation failed before generation:')
    for (const error of validationErrors) {
      console.error(`  - ${error}`)
    }
    process.exit(1)
  }

  const caFlat: FlatGuide = {}
  const esFlat: FlatGuide = {}
  const seenGuideIds = new Set<string>()

  for (const pair of pairs) {
    const guideKey = toGuideKey(pair.ca)
    if (seenGuideIds.has(guideKey)) {
      console.error(`[help:build-guides-adapter] Duplicate guide key detected: ${guideKey}`)
      process.exit(1)
    }
    seenGuideIds.add(guideKey)

    applyTopicToFlat(caFlat, pair.ca)
    applyTopicToFlat(esFlat, pair.es)
  }

  const caOut = resolve(process.cwd(), 'docs/generated/help-guides.ca.flat.json')
  const esOut = resolve(process.cwd(), 'docs/generated/help-guides.es.flat.json')

  mkdirSync(dirname(caOut), { recursive: true })

  writeFileSync(caOut, `${JSON.stringify(caFlat, null, 2)}\n`, 'utf8')
  writeFileSync(esOut, `${JSON.stringify(esFlat, null, 2)}\n`, 'utf8')

  const caPatchByGuide = groupFlatByGuide(caFlat)
  const esPatchByGuide = groupFlatByGuide(esFlat)
  const caLocale = readLocale('ca')
  const esLocale = readLocale('es')
  const frLocale = readLocale('fr')
  const ptLocale = readLocale('pt')

  const nextCaLocale = applyGuidePatchToLocale({
    existing: caLocale,
    patchByGuide: caPatchByGuide,
    keepExistingValues: false,
  })
  const nextEsLocale = applyGuidePatchToLocale({
    existing: esLocale,
    patchByGuide: esPatchByGuide,
    keepExistingValues: false,
  })
  const nextFrLocale = applyGuidePatchToLocale({
    existing: frLocale,
    patchByGuide: caPatchByGuide,
    keepExistingValues: true,
  })
  const nextPtLocale = applyGuidePatchToLocale({
    existing: ptLocale,
    patchByGuide: caPatchByGuide,
    keepExistingValues: true,
  })

  const caUpdated = writeLocaleIfChanged('ca', nextCaLocale)
  const esUpdated = writeLocaleIfChanged('es', nextEsLocale)
  const frUpdated = writeLocaleIfChanged('fr', nextFrLocale)
  const ptUpdated = writeLocaleIfChanged('pt', nextPtLocale)

  console.log('[help:build-guides-adapter] Generated:')
  console.log(`  - ${caOut} (${Object.keys(caFlat).length} keys)`)
  console.log(`  - ${esOut} (${Object.keys(esFlat).length} keys)`)
  console.log('[help:build-guides-adapter] Updated locales:')
  console.log(`  - ${localePath('ca')} (${caUpdated ? 'updated' : 'unchanged'})`)
  console.log(`  - ${localePath('es')} (${esUpdated ? 'updated' : 'unchanged'})`)
  console.log(`  - ${localePath('fr')} (${frUpdated ? 'updated' : 'unchanged'})`)
  console.log(`  - ${localePath('pt')} (${ptUpdated ? 'updated' : 'unchanged'})`)
}

main()
