import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { constants } from 'node:fs'
import { parse } from 'yaml'
import type {
  CriteriaSourceSnapshot,
  EditorialCalendar,
  EditorialCriteriaContext,
  EditorialLogEntry,
  QueueState,
} from './types'

const BASE_TERMS = [
  'entitats',
  'associacions',
  'fundacions',
  'donants',
  'socis',
  'remeses',
  'conciliació bancària',
  'tresoreria',
  'fiscalitat',
  'subvencions',
  'justificació',
  'Model 182',
  'Model 347',
]

export const editorialPaths = {
  root: path.join(process.cwd(), 'octavi', 'summa', 'editorial'),
  calendar: path.join(
    process.cwd(),
    'octavi',
    'summa',
    'editorial',
    'calendar',
    'editorial-calendar.yaml'
  ),
  queue: path.join(
    process.cwd(),
    'octavi',
    'summa',
    'editorial',
    'runtime',
    'queue-state.json'
  ),
  logs: path.join(
    process.cwd(),
    'octavi',
    'summa',
    'editorial',
    'runtime',
    'logs',
    'editorial-actions.jsonl'
  ),
  approvalsDir: path.join(
    process.cwd(),
    'octavi',
    'summa',
    'editorial',
    'runtime',
    'approvals'
  ),
  blogArtifactsDir: path.join(
    process.cwd(),
    'octavi',
    'summa',
    'editorial',
    'artifacts',
    'blog'
  ),
  linkedInArtifactsDir: path.join(
    process.cwd(),
    'octavi',
    'summa',
    'editorial',
    'artifacts',
    'linkedin'
  ),
}

function isAbsolutePath(value: string) {
  return path.isAbsolute(value)
}

export function getEditorialKbPath(configuredPath: string) {
  return process.env.SUMMA_ENTITATS_KB_PATH?.trim() || configuredPath
}

export function resolveWorkspacePath(inputPath: string) {
  if (isAbsolutePath(inputPath)) {
    return inputPath
  }

  return path.join(process.cwd(), inputPath)
}

export function toWorkspaceRelativePath(inputPath: string) {
  const resolvedPath = resolveWorkspacePath(inputPath)
  const relativePath = path.relative(process.cwd(), resolvedPath)

  if (
    !relativePath ||
    relativePath.startsWith('..') ||
    path.isAbsolute(relativePath)
  ) {
    return resolvedPath
  }

  return relativePath
}

export function nowIso() {
  return new Date().toISOString()
}

async function fileExists(targetPath: string) {
  try {
    await access(targetPath, constants.F_OK)
    return true
  } catch {
    return false
  }
}

export async function hasEditorialQueueState() {
  return fileExists(editorialPaths.queue)
}

async function loadTextSnapshot(inputPath: string): Promise<CriteriaSourceSnapshot> {
  const resolvedPath = resolveWorkspacePath(inputPath)
  try {
    const content = await readFile(resolvedPath, 'utf8')
    return {
      path: resolvedPath,
      exists: true,
      content,
    }
  } catch (error) {
    return {
      path: resolvedPath,
      exists: false,
      content: null,
      error: error instanceof Error ? error.message : 'unknown_error',
    }
  }
}

function extractTermsFromMarkdown(content: string | null) {
  const terms = new Set<string>(BASE_TERMS)

  if (!content) {
    return Array.from(terms)
  }

  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  for (const line of lines) {
    if (!line.startsWith('#') && !line.startsWith('-') && !line.startsWith('*')) {
      continue
    }

    const normalized = line
      .replace(/^#+\s*/, '')
      .replace(/^[-*]\s*/, '')
      .replace(/[`*_]/g, '')
      .trim()

    if (!normalized) {
      continue
    }

    if (normalized.length <= 80) {
      terms.add(normalized)
    }
  }

  return Array.from(terms)
}

export async function ensureEditorialDirs() {
  await mkdir(path.dirname(editorialPaths.calendar), { recursive: true })
  await mkdir(path.dirname(editorialPaths.queue), { recursive: true })
  await mkdir(path.dirname(editorialPaths.logs), { recursive: true })
  await mkdir(editorialPaths.approvalsDir, { recursive: true })
  await mkdir(editorialPaths.blogArtifactsDir, { recursive: true })
  await mkdir(editorialPaths.linkedInArtifactsDir, { recursive: true })
}

export async function loadCalendar(): Promise<EditorialCalendar> {
  const raw = await readFile(editorialPaths.calendar, 'utf8')
  const parsed = parse(raw) as EditorialCalendar

  if (!parsed || !Array.isArray(parsed.posts)) {
    throw new Error('Editorial calendar YAML is invalid or missing posts[]')
  }

  return parsed
}

export async function loadCriteriaContext(calendar: EditorialCalendar): Promise<EditorialCriteriaContext> {
  const sectorKnowledgeBase = await loadTextSnapshot(
    getEditorialKbPath(calendar.criteriaSources.sectorKnowledgeBasePath)
  )
  const blogPublishContract = await loadTextSnapshot(calendar.criteriaSources.blogPublishContractPath)
  const octaviStructure = await Promise.all(
    calendar.criteriaSources.octaviStructurePaths.map((inputPath) => loadTextSnapshot(inputPath))
  )

  const warnings: string[] = []
  if (!sectorKnowledgeBase.exists) {
    warnings.push(
      `No s'ha trobat la KB sectorial obligatòria a ${sectorKnowledgeBase.path}. El sistema continua amb lèxic base del repo.`
    )
  }
  if (!blogPublishContract.exists) {
    warnings.push(
      `No s'ha trobat el contracte del pipeline blog a ${blogPublishContract.path}.`
    )
  }

  const missingOctaviSources = octaviStructure.filter((entry) => !entry.exists)
  if (missingOctaviSources.length > 0) {
    warnings.push(
      `Falten ${missingOctaviSources.length} fonts d'estructura Octavi/Subagents.`
    )
  }

  return {
    sources: {
      sectorKnowledgeBase,
      blogPublishContract,
      octaviStructure,
    },
    kbTerms: extractTermsFromMarkdown(sectorKnowledgeBase.content),
    warnings,
  }
}

export async function loadQueueState(calendarId: string, kbPath: string): Promise<QueueState> {
  if (!(await fileExists(editorialPaths.queue))) {
    return {
      version: 1,
      calendarId,
      updatedAt: nowIso(),
      kbPath,
      kbAvailable: false,
      warnings: [],
      items: [],
    }
  }

  const raw = await readFile(editorialPaths.queue, 'utf8')
  return JSON.parse(raw) as QueueState
}

export async function saveQueueState(queueState: QueueState) {
  await ensureEditorialDirs()
  await writeFile(editorialPaths.queue, `${JSON.stringify(queueState, null, 2)}\n`, 'utf8')
}

export async function appendEditorialLog(entry: EditorialLogEntry) {
  await ensureEditorialDirs()
  const line = `${JSON.stringify(entry)}\n`
  const current = (await fileExists(editorialPaths.logs))
    ? await readFile(editorialPaths.logs, 'utf8')
    : ''
  await writeFile(editorialPaths.logs, `${current}${line}`, 'utf8')
}

export async function writeJsonArtifact(targetPath: string, data: unknown) {
  await mkdir(path.dirname(targetPath), { recursive: true })
  await writeFile(targetPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

export async function writeTextArtifact(targetPath: string, content: string) {
  await mkdir(path.dirname(targetPath), { recursive: true })
  await writeFile(targetPath, content.endsWith('\n') ? content : `${content}\n`, 'utf8')
}
