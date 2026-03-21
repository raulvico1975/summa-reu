import type { BlogPost } from '@/lib/blog/types'

export type BlogPostPublishInput = Omit<BlogPost, 'id' | 'createdAt' | 'updatedAt'>

export type BlogPostValidationResult =
  | {
      ok: true
      value: BlogPostPublishInput
    }
  | {
      ok: false
      errors: string[]
    }

const URL_SAFE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeRequiredString(
  value: unknown,
  field: string,
  errors: string[]
): string {
  if (typeof value !== 'string') {
    errors.push(`${field} must be a string`)
    return ''
  }

  const normalized = value.trim()
  if (!normalized) {
    errors.push(`${field} is required`)
    return ''
  }

  return normalized
}

function normalizeOptionalCoverImageUrl(
  value: unknown,
  errors: string[]
): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null

  if (typeof value !== 'string') {
    errors.push('coverImageUrl must be a string, null or undefined')
    return undefined
  }

  const normalized = value.trim()
  if (!normalized) return null

  try {
    const url = new URL(normalized)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      errors.push('coverImageUrl must use http or https')
      return undefined
    }
    return normalized
  } catch {
    errors.push('coverImageUrl must be a valid absolute URL')
    return undefined
  }
}

function normalizeOptionalCoverImageAlt(
  value: unknown,
  errors: string[]
): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null

  if (typeof value !== 'string') {
    errors.push('coverImageAlt must be a string, null or undefined')
    return undefined
  }

  const normalized = value.trim()
  if (!normalized) return null

  return normalized
}

function normalizeTags(value: unknown, errors: string[]): string[] {
  if (!Array.isArray(value)) {
    errors.push('tags must be an array')
    return []
  }

  const normalizedTags: string[] = []
  value.forEach((tag, index) => {
    if (typeof tag !== 'string') {
      errors.push(`tags[${index}] must be a string`)
      return
    }

    const normalized = tag.trim()
    if (!normalized) {
      errors.push(`tags[${index}] must not be empty`)
      return
    }

    normalizedTags.push(normalized)
  })

  return normalizedTags
}

function normalizeIsoDate(value: unknown, field: string, errors: string[]): string {
  if (typeof value !== 'string') {
    errors.push(`${field} must be a string`)
    return ''
  }

  const normalized = value.trim()
  if (!normalized) {
    errors.push(`${field} is required`)
    return ''
  }

  if (!ISO_DATE_PATTERN.test(normalized)) {
    errors.push(`${field} must be a valid ISO datetime`)
    return ''
  }

  const parsed = new Date(normalized)
  if (!Number.isFinite(parsed.getTime())) {
    errors.push(`${field} must be a valid ISO datetime`)
    return ''
  }

  return parsed.toISOString()
}

export function validateBlogPost(payload: unknown): BlogPostValidationResult {
  if (!isRecord(payload)) {
    return { ok: false, errors: ['payload must be an object'] }
  }

  const errors: string[] = []

  if ('orgId' in payload) {
    errors.push('orgId is not accepted')
  }
  if ('id' in payload) {
    errors.push('id is generated server-side')
  }
  if ('createdAt' in payload) {
    errors.push('createdAt is generated server-side')
  }
  if ('updatedAt' in payload) {
    errors.push('updatedAt is generated server-side')
  }

  const title = normalizeRequiredString(payload.title, 'title', errors)
  const slug = normalizeRequiredString(payload.slug, 'slug', errors)
  const seoTitle = normalizeRequiredString(payload.seoTitle, 'seoTitle', errors)
  const metaDescription = normalizeRequiredString(payload.metaDescription, 'metaDescription', errors)
  const excerpt = normalizeRequiredString(payload.excerpt, 'excerpt', errors)
  const contentHtml = normalizeRequiredString(payload.contentHtml, 'contentHtml', errors)
  const category = normalizeRequiredString(payload.category, 'category', errors)
  const tags = normalizeTags(payload.tags, errors)
  const coverImageUrl = normalizeOptionalCoverImageUrl(payload.coverImageUrl, errors)
  const coverImageAlt = normalizeOptionalCoverImageAlt(payload.coverImageAlt, errors)
  const publishedAt = normalizeIsoDate(payload.publishedAt, 'publishedAt', errors)

  if (slug && !URL_SAFE_SLUG_PATTERN.test(slug)) {
    errors.push('slug must be URL-safe')
  }

  if (coverImageAlt && !coverImageUrl) {
    errors.push('coverImageAlt requires coverImageUrl')
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  const value: BlogPostPublishInput = {
    title,
    slug,
    seoTitle,
    metaDescription,
    excerpt,
    contentHtml,
    tags,
    category,
    publishedAt,
  }

  if (coverImageUrl !== undefined) {
    value.coverImageUrl = coverImageUrl
  }

  if (coverImageAlt !== undefined) {
    value.coverImageAlt = coverImageAlt
  }

  return {
    ok: true,
    value,
  }
}
