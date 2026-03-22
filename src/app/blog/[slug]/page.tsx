import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getBlogCopy } from '@/lib/blog/copy'
import { formatBlogDate, getBlogPostBySlug } from '@/lib/blog/firestore'

export const revalidate = 60

const categoryLabels: Record<string, string> = {
  'criteri-operatiu': 'Gestió econòmica',
  fiscal: 'Fiscalitat',
  operativa: 'Operativa',
}

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

  const categoryLabel = categoryLabels[post.category] ?? post.category

  return (
    <main className="min-h-screen bg-background">
      <article className="mx-auto max-w-4xl px-6 py-16">
        <header className="mb-10 space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <time dateTime={post.publishedAt}>{formatBlogDate(post.publishedAt)}</time>
            <span>·</span>
            <span>{categoryLabel}</span>
          </div>

          <h1 className="text-4xl font-bold tracking-tight text-foreground">{post.title}</h1>
        </header>

        {post.coverImageUrl ? (
          <div className="mb-10 min-h-[280px] overflow-hidden rounded-2xl border border-border bg-muted/30 sm:min-h-[360px]">
            <img
              src={post.coverImageUrl}
              alt={post.coverImageAlt || post.title}
              className="h-full min-h-[280px] w-full object-cover object-center sm:min-h-[360px]"
            />
          </div>
        ) : null}

        <div
          className="blog-rich-text"
          dangerouslySetInnerHTML={{ __html: post.contentHtml }}
        />

        <div className="mt-16 border-t border-border pt-10">
          <p className="max-w-2xl text-base leading-7 text-muted-foreground">
            Summa Social gestiona donants, remeses i fiscalitat per a ONGs i associacions.
          </p>
          <Link
            href="https://summasocial.app"
            className="mt-5 inline-flex items-center rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Descobreix com funciona
          </Link>
        </div>
      </article>
    </main>
  )
}
