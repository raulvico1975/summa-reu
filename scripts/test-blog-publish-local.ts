import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

type PublishResponse =
  | {
      success: true
      url: string
    }
  | {
      success: false
      error: string
      details?: string[]
    }

type LocalStore = {
  organizations?: Record<string, { id: string; createdAt: string }>
  posts?: Record<string, Record<string, Record<string, unknown>>>
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const baseUrl = 'http://127.0.0.1:9002'
const localPublishSecret = 'local-blog-publish-secret'
const localBlogOrgId = 'local-blog-org'
const storeFile = path.join(repoRoot, 'tmp', 'blog-publish-local-store.json')
const npmCliPath = '/usr/local/lib/node_modules/npm/bin/npm-cli.js'

function buildSlug(label: string) {
  const random = Math.random().toString(36).slice(2, 8)
  return `${label}-${Date.now()}-${random}`
}

function captureLogs(server: ReturnType<typeof spawn>, output: string[]) {
  const append = (chunk: Buffer) => {
    output.push(chunk.toString())
    if (output.length > 40) {
      output.shift()
    }
  }

  server.stdout?.on('data', append)
  server.stderr?.on('data', append)
}

async function waitForServer(logs: string[]) {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const res = await fetch(`${baseUrl}/api/blog/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: '{}',
      })

      if (res.status > 0) {
        return
      }
    } catch {
      await delay(1000)
    }
  }

  throw new Error(`Next dev no ha arrencat a temps.\n${logs.join('')}`)
}

async function readStore(): Promise<LocalStore> {
  try {
    const raw = await readFile(storeFile, 'utf8')
    return JSON.parse(raw) as LocalStore
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {}
    }

    throw error
  }
}

async function publish(payload: Record<string, unknown>, publishSecret: string) {
  const res = await fetch(`${baseUrl}/api/blog/publish`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${publishSecret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const data = await res.json() as PublishResponse
  return { status: res.status, data }
}

async function stopServer(server: ReturnType<typeof spawn>) {
  if (server.exitCode !== null) return

  server.kill('SIGTERM')
  const exitResult = await Promise.race([
    once(server, 'exit'),
    delay(5000).then(() => 'timeout'),
  ])

  if (exitResult === 'timeout' && server.exitCode === null) {
    server.kill('SIGKILL')
    await once(server, 'exit')
  }
}

async function run() {
  await rm(storeFile, { force: true })

  const logs: string[] = []
  const server = spawn(process.execPath, [npmCliPath, 'run', 'dev'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      BLOG_ORG_ID: localBlogOrgId,
      BLOG_PUBLISH_BASE_URL: baseUrl,
      BLOG_PUBLISH_LOCAL_STORE_FILE: storeFile,
      BLOG_PUBLISH_LOCAL_SECRET: localPublishSecret,
      BLOG_PUBLISH_SECRET: localPublishSecret,
      BLOG_PUBLISH_STORAGE_MODE: 'local-file',
      GOOGLE_APPLICATION_CREDENTIALS: '',
      NEXT_PUBLIC_FIREBASE_API_KEY: 'local-api-key',
      NEXT_PUBLIC_FIREBASE_APP_ID: '1:000000000000:web:blogpublishlocal',
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'blog-publish-local.firebaseapp.com',
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'blog-publish-local',
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'blog-publish-local.appspot.com',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  captureLogs(server, logs)

  try {
    await waitForServer(logs)

    const withImageSlug = buildSlug('post-prova-amb-imatge')
    const withoutImageSlug = buildSlug('post-prova-sense-imatge')

    const withImagePayload = {
      title: 'Post prova amb imatge',
      slug: withImageSlug,
      seoTitle: 'Post prova amb imatge | Summa Social',
      metaDescription: 'Post de prova amb portada',
      excerpt: 'Resum de prova amb imatge',
      contentHtml: '<p>Contingut mínim de prova</p>',
      tags: ['test', 'blog'],
      category: 'Producte',
      publishedAt: new Date().toISOString(),
      coverImageUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee',
      coverImageAlt: 'Portada test',
    }

    const withoutImagePayload = {
      title: 'Post prova sense imatge',
      slug: withoutImageSlug,
      seoTitle: 'Post prova sense imatge | Summa Social',
      metaDescription: 'Post de prova sense portada',
      excerpt: 'Resum de prova sense imatge',
      contentHtml: '<p>Contingut mínim de prova</p>',
      tags: ['test', 'blog'],
      category: 'Producte',
      publishedAt: new Date().toISOString(),
    }

    const withImage = await publish(withImagePayload, localPublishSecret)
    const withoutImage = await publish(withoutImagePayload, localPublishSecret)
    const store = await readStore()
    const availableOrgIds = Object.keys(store.posts ?? {})
    const effectiveOrgId =
      store.posts?.[localBlogOrgId] ? localBlogOrgId : availableOrgIds[0] ?? localBlogOrgId
    const withImagePost = store.posts?.[effectiveOrgId]?.[withImageSlug]
    const withoutImagePost = store.posts?.[effectiveOrgId]?.[withoutImageSlug]

    const summary = {
      authorizedWithImageStatus: withImage.status,
      authorizedWithoutImageStatus: withoutImage.status,
      withImageSuccess: withImage.status === 200 && withImage.data.success === true,
      withoutImageSuccess: withoutImage.status === 200 && withoutImage.data.success === true,
      withImageCoverImageUrlValid:
        withImagePost?.coverImageUrl === withImagePayload.coverImageUrl,
      withImageCoverImageAltValid:
        withImagePost?.coverImageAlt === withImagePayload.coverImageAlt,
      withoutImageHasNoCoverImageUrl:
        Boolean(withoutImagePost) &&
        !Object.prototype.hasOwnProperty.call(withoutImagePost, 'coverImageUrl'),
      withoutImageHasNoCoverImageAlt:
        Boolean(withoutImagePost) &&
        !Object.prototype.hasOwnProperty.call(withoutImagePost, 'coverImageAlt'),
      withImageResponse: withImage.data,
      withoutImageResponse: withoutImage.data,
      effectiveOrgId,
      availableOrgIds,
      availablePostSlugs: availableOrgIds.flatMap((orgId) => Object.keys(store.posts?.[orgId] ?? {})),
      serverLogs: logs.join('').slice(-4000),
    }

    console.log(JSON.stringify(summary, null, 2))

    const ok =
      summary.withImageSuccess &&
      summary.withoutImageSuccess &&
      summary.withImageCoverImageUrlValid &&
      summary.withImageCoverImageAltValid &&
      summary.withoutImageHasNoCoverImageUrl &&
      summary.withoutImageHasNoCoverImageAlt

    if (!ok) {
      process.exitCode = 1
    }
  } finally {
    await stopServer(server)
    await rm(storeFile, { force: true })
  }
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
