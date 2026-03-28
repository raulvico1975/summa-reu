import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { BlogPostView } from '@/components/public/blog/BlogPostView'
import { getBlogCopy } from '@/lib/blog/copy'
import { getLocalizedBlogPostBySlug } from '@/lib/blog/firestore'
import {
  generatePublicPageMetadata,
  isValidPublicLocale,
  type PublicLocale,
} from '@/lib/public-locale'

export const revalidate = 60

type PageProps = {
  params: Promise<{ lang: string; slug: string }>
}

function isBlogConfigured() {
  return Boolean(process.env.BLOG_ORG_ID?.trim())
}

export function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang, slug } = await params
  if (!isValidPublicLocale(lang)) return {}

  const locale = lang as PublicLocale
  const copy = getBlogCopy(locale)
  const seoMeta = generatePublicPageMetadata(locale, `/blog/${slug}`)

  if (!isBlogConfigured()) {
    return {
      title: copy.metaTitle,
      description: copy.metaDescription,
      robots: {
        index: false,
        follow: false,
      },
      ...seoMeta,
    }
  }

  const post = await getLocalizedBlogPostBySlug(slug, locale)
  if (!post) return {}

  return {
    title: post.seoTitle,
    description: post.metaDescription,
    ...seoMeta,
  }
}

export default async function PublicBlogPostPage({ params }: PageProps) {
  const { lang, slug } = await params

  if (!isValidPublicLocale(lang)) {
    notFound()
  }

  const locale = lang as PublicLocale
  const post = await getLocalizedBlogPostBySlug(slug, locale)

  if (!post) {
    notFound()
  }

  return (
    <BlogPostView
      locale={locale}
      slug={slug}
      blogBasePath={`/${locale}/blog`}
    />
  )
}
