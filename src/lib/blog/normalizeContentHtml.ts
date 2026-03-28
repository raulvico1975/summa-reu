const PROTECTED_TAGS = new Set(['code', 'pre', 'script', 'style'])
const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, codePoint) => {
      const parsed = Number.parseInt(codePoint, 10)
      return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : _
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => {
      const parsed = Number.parseInt(codePoint, 16)
      return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : _
    })
}

function normalizeComparableText(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, ' '))
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .toLowerCase()
}

function normalizeMarkdownStrong(text: string): string {
  return text
    .replace(/\*\*([^*\n][\s\S]*?[^*\n])\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_\n][\s\S]*?[^_\n])__/g, '<strong>$1</strong>')
}

function normalizeMarkdownEmphasis(text: string): string {
  return text
    .replace(/(^|[^\w*])\*([^*\n][\s\S]*?[^*\n])\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/(^|[^\w_])_([^_\n][\s\S]*?[^_\n])_(?!_)/g, '$1<em>$2</em>')
}

function normalizeInlineMarkdownInHtml(contentHtml: string): string {
  const tokens = contentHtml.split(/(<[^>]+>)/g)
  let protectedDepth = 0

  return tokens
    .map((token) => {
      if (!token) return token

      if (!token.startsWith('<')) {
        if (protectedDepth > 0) {
          return token
        }

        const strongNormalized = normalizeMarkdownStrong(token)
        return normalizeMarkdownEmphasis(strongNormalized)
      }

      if (token.startsWith('<!--') || token.startsWith('<!')) {
        return token
      }

      const match = token.match(/^<\s*(\/)?\s*([a-z0-9:-]+)/i)
      if (!match) return token

      const isClosingTag = match[1] === '/'
      const tagName = match[2].toLowerCase()
      const isSelfClosing = !isClosingTag && (VOID_TAGS.has(tagName) || /\/\s*>$/.test(token))

      if (PROTECTED_TAGS.has(tagName)) {
        if (isClosingTag) {
          protectedDepth = Math.max(0, protectedDepth - 1)
        } else if (!isSelfClosing) {
          protectedDepth += 1
        }
      }

      return token
    })
    .join('')
}

function stripDuplicateLeadHeading(contentHtml: string, title?: string): string {
  if (!title) return contentHtml

  const match = contentHtml.match(/^\s*<h1\b[^>]*>([\s\S]*?)<\/h1>\s*/i)
  if (!match) return contentHtml

  if (normalizeComparableText(match[1]) !== normalizeComparableText(title)) {
    return contentHtml
  }

  const withoutHeading = contentHtml.slice(match[0].length).trimStart()
  return withoutHeading || contentHtml
}

export function normalizeBlogContentHtml(contentHtml: string, title?: string): string {
  const trimmed = contentHtml.trim()
  if (!trimmed) return trimmed

  const normalizedInlineMarkdown = normalizeInlineMarkdownInHtml(trimmed)
  return stripDuplicateLeadHeading(normalizedInlineMarkdown, title).trim()
}
