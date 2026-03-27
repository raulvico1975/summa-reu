export type BlogContentLocale = 'ca' | 'es'

export type BlogPostTranslation = {
  title: string
  seoTitle: string
  metaDescription: string
  excerpt: string
  contentHtml: string
  coverImageAlt?: string | null
}

export type BlogPost = {
  id: string
  baseLocale?: BlogContentLocale
  title: string
  slug: string
  seoTitle: string
  metaDescription: string
  excerpt: string
  contentHtml: string
  tags: string[]
  category: string
  coverImageUrl?: string | null
  coverImageAlt?: string | null
  translations?: Partial<Record<'es', BlogPostTranslation>>
  publishedAt: string
  createdAt: string
  updatedAt: string
}
