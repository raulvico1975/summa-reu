function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function stripInlineMarkdown(value: string): string {
  return value
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim()
}

function renderInlineMarkdown(value: string): string {
  const escaped = escapeHtml(value)
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}

export function slugifyDraftTitle(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90)
}

export function stripMarkdownToPlainText(markdown: string): string {
  return markdown
    .split('\n')
    .map((line) => line.replace(/^#{1,6}\s+/, '').replace(/^-\s+/, ''))
    .map(stripInlineMarkdown)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function removeLeadingTitle(markdown: string): string {
  const normalized = markdown.replace(/\r\n/g, '\n').trim()
  const lines = normalized.split('\n')

  if (lines.length === 0) return normalized
  if (!/^#\s+/.test(lines[0].trim())) return normalized

  const remaining = lines.slice(1)
  while (remaining.length > 0 && !remaining[0].trim()) {
    remaining.shift()
  }

  return remaining.join('\n').trim() || normalized
}

export function buildExcerptFromMarkdown(markdown: string): string {
  return stripMarkdownToPlainText(removeLeadingTitle(markdown)).slice(0, 220).trim()
}

export function buildMetaDescriptionFromMarkdown(markdown: string): string {
  return stripMarkdownToPlainText(removeLeadingTitle(markdown)).slice(0, 160).trim()
}

export function normalizeTagList(input: string[] | null | undefined): string[] {
  return [...new Set((input ?? [])
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 6))]
}

export function renderEditorialMarkdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const html: string[] = []
  let paragraphLines: string[] = []
  let listItems: string[] = []

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return
    html.push(`<p>${renderInlineMarkdown(paragraphLines.join(' '))}</p>`)
    paragraphLines = []
  }

  const flushList = () => {
    if (listItems.length === 0) return
    html.push(`<ul>${listItems.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join('')}</ul>`)
    listItems = []
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()

    if (!line) {
      flushParagraph()
      flushList()
      continue
    }

    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(line)
    if (headingMatch) {
      flushParagraph()
      flushList()
      const level = headingMatch[1].length
      const safeLevel = Math.max(1, Math.min(3, level))
      html.push(`<h${safeLevel}>${renderInlineMarkdown(headingMatch[2])}</h${safeLevel}>`)
      continue
    }

    const listMatch = /^-\s+(.+)$/.exec(line)
    if (listMatch) {
      flushParagraph()
      listItems.push(listMatch[1])
      continue
    }

    flushList()
    paragraphLines.push(line)
  }

  flushParagraph()
  flushList()

  return html.join('\n').trim()
}
