import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { BlogPostView } from '@/components/public/blog/BlogPostView'
import { getBlogCopy } from '@/lib/blog/copy'
import { getLocalizedBlogPostBySlug } from '@/lib/blog/firestore'

export const revalidate = 60

const locale = 'ca' as const

type PageProps = {
  params: Promise<{ slug: string }>
}

function isBlogConfigured() {
  return Boolean(process.env.BLOG_ORG_ID?.trim())
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const copy = getBlogCopy(locale)

  if (!isBlogConfigured()) {
    return {
      title: copy.metaTitle,
      description: copy.metaDescription,
      robots: {
        index: false,
        follow: false,
      },
    }
  }

  const { slug } = await params
  const post = await getLocalizedBlogPostBySlug(slug, locale)

  if (!post) {
    return {
      title: copy.metaTitle,
      description: copy.metaDescription,
    }
  }

  return {
    title: post.seoTitle,
    description: post.metaDescription,
  }
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params
  const post = await getLocalizedBlogPostBySlug(slug, locale)

  if (!post) {
    notFound()
  }

  return (
    <BlogPostView
      locale={locale}
      slug={slug}
      blogBasePath="/blog"
    />
  )
}
