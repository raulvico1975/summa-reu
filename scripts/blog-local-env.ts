import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { loadEnvConfig } from '@next/env'

const ENV_LOCAL_PATH = path.resolve(process.cwd(), '.env.local')

type ParsedEnv = {
  entries: Map<string, string>
  lines: string[]
}

function parseEnvFile(filePath: string): ParsedEnv {
  if (!existsSync(filePath)) {
    return { entries: new Map(), lines: [] }
  }

  const raw = readFileSync(filePath, 'utf8')
  const lines = raw.split(/\r?\n/)
  const entries = new Map<string, string>()

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const separatorIndex = line.indexOf('=')
    if (separatorIndex <= 0) continue

    const key = line.slice(0, separatorIndex).trim()
    let value = line.slice(separatorIndex + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    entries.set(key, value)
  }

  return { entries, lines }
}

function upsertEnvLine(lines: string[], key: string, value: string) {
  const index = lines.findIndex((line) => line.trim().startsWith(`${key}=`))
  const nextLine = `${key}=${value}`

  if (index >= 0) {
    lines[index] = nextLine
    return
  }

  if (lines.length > 0 && lines[lines.length - 1].trim() !== '') {
    lines.push('')
  }

  lines.push(nextLine)
}

function ensureEnvLocalFile(updates: Record<string, string>) {
  const parsed = parseEnvFile(ENV_LOCAL_PATH)
  const nextLines = [...parsed.lines]

  for (const [key, value] of Object.entries(updates)) {
    upsertEnvLine(nextLines, key, value)
  }

  writeFileSync(ENV_LOCAL_PATH, `${nextLines.join('\n').replace(/\n*$/, '\n')}`, 'utf8')
}

export function ensureLocalBlogEnv(): {
  BLOG_PUBLISH_SECRET: string
  BLOG_PUBLISH_BASE_URL: string
  BLOG_ORG_ID: string
} {
  loadEnvConfig(process.cwd())

  const parsed = parseEnvFile(ENV_LOCAL_PATH)

  const publishSecret =
    process.env.BLOG_PUBLISH_SECRET?.trim() ||
    parsed.entries.get('BLOG_PUBLISH_SECRET')?.trim() ||
    randomBytes(32).toString('hex')

  const publishBaseUrl =
    process.env.BLOG_PUBLISH_BASE_URL?.trim() ||
    parsed.entries.get('BLOG_PUBLISH_BASE_URL')?.trim() ||
    'http://localhost:9002'

  const blogOrgId =
    process.env.BLOG_ORG_ID?.trim() ||
    parsed.entries.get('BLOG_ORG_ID')?.trim() ||
    'local-blog'

  ensureEnvLocalFile({
    BLOG_PUBLISH_SECRET: publishSecret,
    BLOG_PUBLISH_BASE_URL: publishBaseUrl,
    BLOG_ORG_ID: blogOrgId,
  })

  process.env.BLOG_PUBLISH_SECRET = publishSecret
  process.env.BLOG_PUBLISH_BASE_URL = publishBaseUrl
  process.env.BLOG_ORG_ID = blogOrgId

  return {
    BLOG_PUBLISH_SECRET: publishSecret,
    BLOG_PUBLISH_BASE_URL: publishBaseUrl,
    BLOG_ORG_ID: blogOrgId,
  }
}
