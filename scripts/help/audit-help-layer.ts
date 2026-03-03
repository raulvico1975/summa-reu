import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadTopicPairs } from './topic-utils'

type GuideLink = {
  id: string
  href: string
}

type FlatJson = Record<string, string>

type LocaleDiff = {
  language: string
  missingInStorage: string[]
  extraInStorage: string[]
  differentValues: string[]
}

function parseGuidesPageLinks(): GuideLink[] {
  const pagePath = resolve(process.cwd(), 'src/app/[orgSlug]/dashboard/guides/page.tsx')
  const content = readFileSync(pagePath, 'utf8')
  const links: GuideLink[] = []

  const objectRe = /\{\s*id:\s*'([^']+)'[\s\S]*?href:\s*'([^']+)'[\s\S]*?\}/g
  let match: RegExpExecArray | null = objectRe.exec(content)

  while (match) {
    links.push({ id: match[1], href: match[2] })
    match = objectRe.exec(content)
  }

  return links
}

function pickGuidesOnly(flat: FlatJson): FlatJson {
  const out: FlatJson = {}
  for (const [key, value] of Object.entries(flat)) {
    if (key.startsWith('guides.') && typeof value === 'string') {
      out[key] = value
    }
  }
  return out
}

function readLocalGuides(lang: 'ca' | 'es' | 'fr' | 'pt'): FlatJson {
  const path = resolve(process.cwd(), 'src/i18n/locales', `${lang}.json`)
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as FlatJson
  return pickGuidesOnly(parsed)
}

async function readStorageGuides(lang: 'ca' | 'es' | 'fr' | 'pt'): Promise<FlatJson> {
  const bucketName =
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET

  if (!bucketName) {
    throw new Error('Missing FIREBASE_STORAGE_BUCKET or NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET')
  }

  const [{ getStorage }, { getAdminApp }] = await Promise.all([
    import('firebase-admin/storage'),
    import('../../src/lib/api/admin-sdk'),
  ])

  const file = getStorage(getAdminApp()).bucket(bucketName).file(`i18n/${lang}.json`)
  const [exists] = await file.exists()
  if (!exists) {
    throw new Error(`Storage file not found: i18n/${lang}.json`)
  }

  const [data] = await file.download()
  const parsed = JSON.parse(data.toString('utf8')) as FlatJson
  return pickGuidesOnly(parsed)
}

function diffGuides(language: string, local: FlatJson, storage: FlatJson): LocaleDiff {
  const localKeys = Object.keys(local)
  const storageKeys = Object.keys(storage)
  const localSet = new Set(localKeys)
  const storageSet = new Set(storageKeys)

  const missingInStorage = localKeys.filter(key => !storageSet.has(key)).sort()
  const extraInStorage = storageKeys.filter(key => !localSet.has(key)).sort()
  const differentValues = localKeys
    .filter(key => storageSet.has(key) && local[key] !== storage[key])
    .sort()

  return {
    language,
    missingInStorage,
    extraInStorage,
    differentValues,
  }
}

function sampleList(items: string[], limit = 5): string {
  if (items.length === 0) return '-'
  const picked = items.slice(0, limit).join(', ')
  if (items.length <= limit) return picked
  return `${picked} ... (+${items.length - limit})`
}

async function main(): Promise<void> {
  const withStorageAudit =
    process.argv.includes('--with-storage') || process.env.HELP_AUDIT_STORAGE === '1'

  const pairs = loadTopicPairs('help/topics')
  const guideLinks = parseGuidesPageLinks()

  const topicByGuideId = new Map<string, string>()
  for (const pair of pairs) {
    const guideId = pair.ca.frontmatter.guideId ?? pair.id
    topicByGuideId.set(guideId, pair.id)
  }

  const rows = guideLinks.map(link => {
    const topicId = topicByGuideId.get(link.id)
    return {
      guideId: link.id,
      route: link.href,
      topicId: topicId ?? '',
      status: topicId ? 'covered' : 'missing-topic',
    }
  })

  const orphanTopics = pairs
    .filter(pair => {
      const guideId = pair.ca.frontmatter.guideId ?? pair.id
      return !guideLinks.some(link => link.id === guideId)
    })
    .map(pair => ({
      topicId: pair.id,
      guideId: pair.ca.frontmatter.guideId ?? pair.id,
    }))

  const missing = rows.filter(row => row.status === 'missing-topic')
  const outPath = resolve(process.cwd(), 'help/audit-report.md')

  const localByLang = {
    ca: readLocalGuides('ca'),
    es: readLocalGuides('es'),
    fr: readLocalGuides('fr'),
    pt: readLocalGuides('pt'),
  }

  const storageDiffs: LocaleDiff[] = []
  const storageErrors: string[] = []

  if (withStorageAudit) {
    for (const lang of ['ca', 'es', 'fr', 'pt'] as const) {
      try {
        const storageGuides = await readStorageGuides(lang)
        storageDiffs.push(diffGuides(lang, localByLang[lang], storageGuides))
      } catch (error) {
        storageErrors.push(`${lang}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }

  const output: string[] = []
  output.push('# Audit capa Help (guies + bot)')
  output.push('')
  output.push(`- Data: ${new Date().toISOString()}`)
  output.push(`- Guies detectades UI: ${rows.length}`)
  output.push(`- Topics operatius: ${pairs.length}`)
  output.push(`- Guies sense topic: ${missing.length}`)
  output.push(`- Topics sense guia UI: ${orphanTopics.length}`)
  output.push('')
  output.push('## Cobertura guies')
  output.push('')
  output.push('| Guide ID | Ruta UI | Topic operatiu | Estat |')
  output.push('|---|---|---|---|')

  for (const row of rows) {
    output.push(`| ${row.guideId} | ${row.route} | ${row.topicId || '-'} | ${row.status} |`)
  }

  if (orphanTopics.length > 0) {
    output.push('')
    output.push('## Topics sense guia UI')
    output.push('')
    output.push('| Topic ID | Guide ID mapejat |')
    output.push('|---|---|')
    for (const item of orphanTopics) {
      output.push(`| ${item.topicId} | ${item.guideId} |`)
    }
  }

  output.push('')
  output.push('## Divergencia Storage')
  output.push('')
  if (!withStorageAudit) {
    output.push('- No executat (activa amb `HELP_AUDIT_STORAGE=1 npm run help:audit`).')
  } else if (storageErrors.length > 0 && storageDiffs.length === 0) {
    output.push('- No s ha pogut llegir Storage.')
    output.push('')
    output.push('| Lang | Error |')
    output.push('|---|---|')
    for (const err of storageErrors) {
      const [lang, ...rest] = err.split(':')
      output.push(`| ${lang.trim()} | ${rest.join(':').trim()} |`)
    }
  } else {
    output.push('| Lang | Missing a Storage | Extra a Storage | Valor diferent | Exemple diferencies |')
    output.push('|---|---:|---:|---:|---|')
    for (const row of storageDiffs) {
      const totalDiff = row.missingInStorage.length + row.extraInStorage.length + row.differentValues.length
      const sample = sampleList(
        [...row.missingInStorage, ...row.extraInStorage, ...row.differentValues],
        4
      )
      output.push(`| ${row.language} | ${row.missingInStorage.length} | ${row.extraInStorage.length} | ${row.differentValues.length} | ${sample} |`)
      if (totalDiff > 0) {
        output.push(`| ${row.language} alerta | - | - | - | Divergencia detectada entre local i Storage |`)
      }
    }

    if (storageErrors.length > 0) {
      output.push('')
      output.push('### Errors parcials Storage')
      output.push('')
      for (const err of storageErrors) {
        output.push(`- ${err}`)
      }
    }
  }

  writeFileSync(outPath, `${output.join('\n')}\n`, 'utf8')

  console.log(`[help:audit] Report generated: ${outPath}`)
  console.log(`[help:audit] Missing guide topics: ${missing.length}`)
  if (withStorageAudit) {
    const totalDiffs = storageDiffs.reduce(
      (sum, row) => sum + row.missingInStorage.length + row.extraInStorage.length + row.differentValues.length,
      0
    )
    console.log(`[help:audit] Storage divergence keys: ${totalDiffs}`)
    if (storageErrors.length > 0) {
      console.warn('[help:audit] Storage read warnings:')
      for (const err of storageErrors) {
        console.warn(`  - ${err}`)
      }
    }
  }
}

main().catch(error => {
  console.error('[help:audit] Unexpected error:', error)
  process.exit(1)
})
