export type BlogPost = {
  id: string
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
  publishedAt: string
  createdAt: string
  updatedAt: string
}
