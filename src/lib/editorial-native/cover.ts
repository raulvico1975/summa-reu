import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { getStorage } from 'firebase-admin/storage'

import { handleBlogCoverUpload, type UploadBlogCoverResponse } from '@/app/api/blog/upload-cover/handler'
import { resolveGoogleGenAiApiKey } from '@/ai/config'
import { getAdminApp } from '@/lib/api/admin-sdk'
import { buildBlogUrl } from '@/lib/blog/firestore'
import { isLocalBlogPublishStorageEnabled } from '@/lib/blog/publish-local-store'
import type { NativeBlogPost } from '@/lib/editorial-native/types'

const DEFAULT_IMAGE_MODEL = 'gemini-3-pro-image-preview'
const GEMINI_INTERACTIONS_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions'

type GeneratedImageAsset = {
  base64: string
  mimeType: string
}

type StoredCoverAsset = {
  coverImageUrl: string
  path: string
  storage: 'local' | 'firebase'
}

function getImageModel(): string {
  return process.env.GOOGLE_GENAI_IMAGE_MODEL?.trim() || DEFAULT_IMAGE_MODEL
}

function getUploadSecret(): string {
  const secret = isLocalBlogPublishStorageEnabled()
    ? process.env.BLOG_PUBLISH_LOCAL_SECRET?.trim() || process.env.BLOG_PUBLISH_SECRET?.trim()
    : process.env.BLOG_PUBLISH_SECRET?.trim()

  if (!secret) {
    throw new Error('Falta BLOG_PUBLISH_SECRET per pujar la portada del blog.')
  }

  return secret
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function deriveImagePrompt(post: NativeBlogPost): string {
  return (
    post.draft.imagePrompt?.trim() ||
    `Editorial illustration, sober nonprofit operations scene, ${post.draft.title || post.idea.prompt || 'Summa Social blog article'}`
  )
}

function deriveCoverAlt(post: NativeBlogPost): string {
  return (
    post.draft.coverImageAlt?.trim() ||
    `Portada editorial per a: ${post.draft.title || post.idea.prompt || 'article del blog'}`
  )
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function splitTextForSvg(value: string, maxChars = 30): string[] {
  const words = value.trim().split(/\s+/)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length <= maxChars) {
      current = candidate
      continue
    }

    if (current) lines.push(current)
    current = word
  }

  if (current) lines.push(current)
  return lines.slice(0, 4)
}

function buildAssetBaseUrl(): string {
  const blogPostUrl = buildBlogUrl('placeholder')
  return blogPostUrl.replace(/\/blog\/placeholder$/, '')
}

function buildFallbackCoverSvg(post: NativeBlogPost): string {
  const title = escapeXml(post.draft.title || post.idea.prompt || 'Article del blog')
  const category = escapeXml(post.draft.category || 'criteri-operatiu')
  const lines = splitTextForSvg(title)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900" fill="none">
  <rect width="1600" height="900" fill="#F8FAFC"/>
  <rect x="48" y="48" width="1504" height="804" rx="36" fill="url(#bg)"/>
  <circle cx="1340" cy="180" r="180" fill="#E0F2FE" fill-opacity="0.85"/>
  <circle cx="220" cy="760" r="140" fill="#FFF7ED" fill-opacity="0.95"/>
  <rect x="120" y="124" width="180" height="38" rx="19" fill="#FFF7ED"/>
  <text x="210" y="149" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#C2410C">SUMMA SOCIAL</text>
  <rect x="120" y="214" width="260" height="40" rx="20" fill="#FFFFFF" fill-opacity="0.84"/>
  <text x="250" y="239" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="600" fill="#0F172A">${category}</text>
  ${lines.map((line, index) => `<text x="120" y="${338 + index * 86}" font-family="Arial, sans-serif" font-size="64" font-weight="700" fill="#0F172A">${escapeXml(line)}</text>`).join('')}
  <text x="120" y="748" font-family="Arial, sans-serif" font-size="24" font-weight="500" fill="#475569">Coberta editorial generada automàticament</text>
  <defs>
    <linearGradient id="bg" x1="110" y1="80" x2="1490" y2="820" gradientUnits="userSpaceOnUse">
      <stop stop-color="#FFFFFF"/>
      <stop offset="1" stop-color="#EFF6FF"/>
    </linearGradient>
  </defs>
</svg>`
}

async function saveSvgCoverLocal(slug: string, svg: string): Promise<StoredCoverAsset> {
  const fileName = `${slug}-${Date.now()}-${randomUUID().slice(0, 8)}.svg`
  const relativePath = `blog-covers/${fileName}`
  const absolutePath = path.join(process.cwd(), 'public', relativePath)

  await mkdir(path.dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, svg, 'utf8')

  return {
    coverImageUrl: `${buildAssetBaseUrl()}/${relativePath}`,
    path: relativePath,
    storage: 'local',
  }
}

async function saveSvgCoverFirebase(slug: string, svg: string): Promise<StoredCoverAsset> {
  const bucket = getStorage(getAdminApp()).bucket()
  const objectPath = `blog/covers/${slug}-${Date.now()}-${randomUUID().slice(0, 8)}.svg`
  const file = bucket.file(objectPath)

  await file.save(Buffer.from(svg, 'utf8'), {
    resumable: false,
    metadata: {
      contentType: 'image/svg+xml',
      cacheControl: 'public, max-age=31536000, immutable',
    },
  })

  return {
    coverImageUrl: `https://storage.googleapis.com/${bucket.name}/${objectPath}`,
    path: objectPath,
    storage: 'firebase',
  }
}

async function saveFallbackSvgCover(post: NativeBlogPost): Promise<StoredCoverAsset> {
  const slug = post.draft.slug || post.id
  const svg = buildFallbackCoverSvg(post)

  if (isLocalBlogPublishStorageEnabled()) {
    return saveSvgCoverLocal(slug, svg)
  }

  return saveSvgCoverFirebase(slug, svg)
}

function extractImageFromOutputs(outputs: unknown): GeneratedImageAsset | null {
  if (!Array.isArray(outputs)) return null

  for (const output of outputs) {
    if (!isRecord(output)) continue

    const type = asString(output.type)?.toLowerCase()
    const data = asString(output.data)
    const mimeType =
      asString(output.mime_type) ||
      asString(output.mimeType) ||
      'image/png'

    if ((type === 'image' || data) && data) {
      return { base64: data, mimeType }
    }
  }

  return null
}

function extractImageFromCandidates(candidates: unknown): GeneratedImageAsset | null {
  if (!Array.isArray(candidates)) return null

  for (const candidate of candidates) {
    if (!isRecord(candidate)) continue
    const content = isRecord(candidate.content) ? candidate.content : null
    const parts = Array.isArray(content?.parts) ? content.parts : []

    for (const part of parts) {
      if (!isRecord(part)) continue
      const inlineData = isRecord(part.inlineData)
        ? part.inlineData
        : isRecord(part.inline_data)
          ? part.inline_data
          : null

      if (!inlineData) continue

      const data = asString(inlineData.data)
      const mimeType =
        asString(inlineData.mimeType) ||
        asString(inlineData.mime_type) ||
        'image/png'

      if (data) {
        return { base64: data, mimeType }
      }
    }
  }

  return null
}

function extractGeneratedImage(payload: unknown): GeneratedImageAsset {
  if (!isRecord(payload)) {
    throw new Error("El motor d'imatge no ha retornat una resposta usable.")
  }

  const direct = extractImageFromOutputs(payload.outputs)
  if (direct) return direct

  const nested = isRecord(payload.response) ? extractImageFromOutputs(payload.response.outputs) : null
  if (nested) return nested

  const candidateImage = extractImageFromCandidates(payload.candidates)
  if (candidateImage) return candidateImage

  throw new Error("La resposta del model d'imatge no inclou cap imatge.")
}

export async function generateNativeBlogCover(post: NativeBlogPost): Promise<{
  coverImageUrl: string
  path: string
  storage: 'local' | 'firebase'
  coverImageAlt: string
  kind: 'generated' | 'fallback'
}> {
  const apiKey = resolveGoogleGenAiApiKey()
  if (!apiKey) {
    const fallback = await saveFallbackSvgCover(post)
    return {
      ...fallback,
      coverImageAlt: deriveCoverAlt(post),
      kind: 'fallback',
    }
  }

  try {
    const prompt = deriveImagePrompt(post)
    const response = await fetch(GEMINI_INTERACTIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        model: getImageModel(),
        input: prompt,
        response_modalities: ['IMAGE'],
        generation_config: {
          image_config: {
            aspect_ratio: '16:9',
          },
        },
      }),
    })

    const raw = (await response.json().catch(() => null)) as unknown
    if (!response.ok) {
      const rawError = isRecord(raw) && isRecord(raw.error) ? raw.error : null
      const detail =
        rawError && Array.isArray(rawError.details)
          ? JSON.stringify(rawError.details)
          : rawError && asString(rawError.message)
            ? asString(rawError.message)
            : null

      throw new Error(detail || "El motor d'imatge ha fallat.")
    }

    const image = extractGeneratedImage(raw)
    const uploadSecret = getUploadSecret()
    const uploadResponse = await handleBlogCoverUpload({
      headers: new Headers({
        Authorization: `Bearer ${uploadSecret}`,
      }) as unknown as Request['headers'],
      json: async () => ({
        slug: post.draft.slug || post.id,
        imageBase64: image.base64,
        mimeType: image.mimeType,
      }),
    } as never)

    const uploadBody = (await uploadResponse.json()) as UploadBlogCoverResponse
    if (!uploadResponse.ok || !uploadBody.success) {
      throw new Error(uploadBody.success ? "No s'ha pogut pujar la portada generada." : uploadBody.error)
    }

    return {
      coverImageUrl: uploadBody.coverImageUrl,
      path: uploadBody.path,
      storage: uploadBody.storage,
      coverImageAlt: deriveCoverAlt(post),
      kind: 'generated',
    }
  } catch {
    const fallback = await saveFallbackSvgCover(post)
    return {
      ...fallback,
      coverImageAlt: deriveCoverAlt(post),
      kind: 'fallback',
    }
  }
}
