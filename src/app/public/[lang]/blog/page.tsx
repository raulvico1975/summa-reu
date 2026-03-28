import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { BlogIndexView } from '@/components/public/blog/BlogIndexView'
import { getBlogCopy } from '@/lib/blog/copy'
import {
  PUBLIC_LOCALES,
  generatePublicPageMetadata,
  isValidPublicLocale,
  type PublicLocale,
} from '@/lib/public-locale'

export const revalidate = 60

type PageProps = {
  params: Promise<{ lang: string }>
}

function isBlogConfigured() {
  return Boolean(process.env.BLOG_ORG_ID?.trim())
}

export function generateStaticParams() {
  return PUBLIC_LOCALES.map((lang) => ({ lang }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params
  if (!isValidPublicLocale(lang)) return {}

  const locale = lang as PublicLocale
  const copy = getBlogCopy(locale)
  const seoMeta = generatePublicPageMetadata(locale, '/blog')

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

  return {
    title: copy.metaTitle,
    description: copy.metaDescription,
    ...seoMeta,
  }
}

export default async function PublicBlogPage({ params }: PageProps) {
  const { lang } = await params

  if (!isValidPublicLocale(lang)) {
    notFound()
  }

  const locale = lang as PublicLocale

  return (
    <BlogIndexView
      locale={locale}
      blogBasePath={`/${locale}/blog`}
    />
  )
}
