import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import {
  getEditorialKbPath,
  loadCriteriaContext,
  resolveWorkspacePath,
  toWorkspaceRelativePath,
} from '../openclaw-editorial/files'
import type { EditorialCalendar } from '../openclaw-editorial/types'

test('toWorkspaceRelativePath converteix rutes absolutes del repo a relatives', () => {
  const absolutePath = path.join(
    process.cwd(),
    'octavi',
    'summa',
    'editorial',
    'artifacts',
    'blog',
    '2026-04-control-model-347.json'
  )

  assert.equal(
    toWorkspaceRelativePath(absolutePath),
    'octavi/summa/editorial/artifacts/blog/2026-04-control-model-347.json'
  )
})

test('toWorkspaceRelativePath conserva rutes fora del workspace', () => {
  const externalPath = '/mnt/data/KNOWLEDGE_BASE_Entitats.md'

  assert.equal(toWorkspaceRelativePath(externalPath), externalPath)
})

test('resolveWorkspacePath resol rutes relatives respecte al repo', () => {
  const relativePath = 'octavi/summa/editorial/runtime/queue-state.json'

  assert.equal(
    resolveWorkspacePath(relativePath),
    path.join(process.cwd(), relativePath)
  )
})

test('getEditorialKbPath prioritza SUMMA_ENTITATS_KB_PATH quan existeix', () => {
  const original = process.env.SUMMA_ENTITATS_KB_PATH
  process.env.SUMMA_ENTITATS_KB_PATH = '/tmp/kb-test.md'

  try {
    assert.equal(
      getEditorialKbPath('/mnt/data/KNOWLEDGE_BASE_Entitats.md'),
      '/tmp/kb-test.md'
    )
  } finally {
    if (original === undefined) {
      delete process.env.SUMMA_ENTITATS_KB_PATH
    } else {
      process.env.SUMMA_ENTITATS_KB_PATH = original
    }
  }
})

test('loadCriteriaContext carrega la KB des de SUMMA_ENTITATS_KB_PATH', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'openclaw-editorial-'))
  const kbPath = path.join(tempDir, 'kb.md')
  const contractPath = path.join(tempDir, 'contract.md')
  const structurePath = path.join(tempDir, 'structure.md')
  const original = process.env.SUMMA_ENTITATS_KB_PATH

  await writeFile(kbPath, '# Fiscalitat\n- Model 347\n', 'utf8')
  await writeFile(contractPath, '# Contracte\n', 'utf8')
  await writeFile(structurePath, '# Estructura\n', 'utf8')
  process.env.SUMMA_ENTITATS_KB_PATH = kbPath

  const calendar: EditorialCalendar = {
    version: 1,
    calendarId: 'test-calendar',
    calendarOrigin: 'test',
    criteriaSources: {
      sectorKnowledgeBasePath: '/mnt/data/KNOWLEDGE_BASE_Entitats.md',
      blogPublishContractPath: contractPath,
      octaviStructurePaths: [structurePath],
    },
    defaults: {
      blogLocale: 'ca',
      approvalChannel: 'telegram',
      linkedinMode: 'mock',
      derivativesPerPost: 3,
      requiresHumanApproval: true,
    },
    posts: [],
  }

  try {
    const result = await loadCriteriaContext(calendar)
    assert.equal(result.sources.sectorKnowledgeBase.path, kbPath)
    assert.equal(result.sources.sectorKnowledgeBase.exists, true)
    assert.ok(result.kbTerms.includes('Fiscalitat'))
  } finally {
    if (original === undefined) {
      delete process.env.SUMMA_ENTITATS_KB_PATH
    } else {
      process.env.SUMMA_ENTITATS_KB_PATH = original
    }
    await rm(tempDir, { recursive: true, force: true })
  }
})
