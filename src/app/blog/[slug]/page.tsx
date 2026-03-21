import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getBlogCopy } from '@/lib/blog/copy'
import { formatBlogDate, getBlogPostBySlug } from '@/lib/blog/firestore'

export const revalidate = 60

type PageProps = {
  params: Promise<{ slug: string }>
}

function isBlogConfigured() {
  return Boolean(process.env.BLOG_ORG_ID?.trim())
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const copy = getBlogCopy()

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
  const post = await getBlogPostBySlug(slug)

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
  if (!isBlogConfigured()) {
    notFound()
  }

  const { slug } = await params
  const post = await getBlogPostBySlug(slug)

  if (!post) {
    notFound()
  }

  return (
    <main className="min-h-screen bg-background">
      <article className="mx-auto max-w-4xl px-6 py-16">
        <header className="mb-10 space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <time dateTime={post.publishedAt}>{formatBlogDate(post.publishedAt)}</time>
            <span>·</span>
            <span>{post.category}</span>
          </div>

          <h1 className="text-4xl font-bold tracking-tight text-foreground">{post.title}</h1>
        </header>

        {post.coverImageUrl ? (
          <img
            src={post.coverImageUrl}
            alt={post.coverImageAlt || post.title}
            className="mb-10 h-auto w-full rounded-2xl border border-border object-cover"
          />
        ) : null}

        <div
          className="blog-rich-text"
          dangerouslySetInnerHTML={{ __html: post.contentHtml }}
        />
      </article>
    </main>
  )
}
