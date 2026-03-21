import type { Metadata } from 'next'
import Link from 'next/link'
import { getBlogCopy } from '@/lib/blog/copy'
import { formatBlogDate, listBlogPosts } from '@/lib/blog/firestore'

export const revalidate = 60

function isBlogConfigured() {
  return Boolean(process.env.BLOG_ORG_ID?.trim())
}

export async function generateMetadata(): Promise<Metadata> {
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

  return {
    title: copy.metaTitle,
    description: copy.metaDescription,
  }
}

export default async function BlogPage() {
  const copy = getBlogCopy()

  if (!isBlogConfigured()) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <header className="mb-6 space-y-3">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
              {copy.eyebrow}
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-foreground">{copy.title}</h1>
          </header>

          <p className="max-w-2xl text-base leading-7 text-muted-foreground">
            {copy.notConfigured}
          </p>
        </div>
      </main>
    )
  }

  const posts = await listBlogPosts()

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <header className="mb-10 space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
            {copy.eyebrow}
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">{copy.title}</h1>
        </header>

        <div className="space-y-6">
          {posts.map((post) => (
            <article
              key={post.id}
              className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
            >
              <Link href={`/blog/${post.slug}`} className="grid gap-0 md:grid-cols-[240px_1fr]">
                {post.coverImageUrl ? (
                  <img
                    src={post.coverImageUrl}
                    alt={post.coverImageAlt || post.title}
                    className="h-56 w-full object-cover"
                  />
                ) : (
                  <div className="h-56 w-full bg-stone-200" aria-hidden="true" />
                )}

                <div className="space-y-4 p-6">
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span>{post.category}</span>
                    <span>·</span>
                    <time dateTime={post.publishedAt}>{formatBlogDate(post.publishedAt)}</time>
                  </div>

                  <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                    {post.title}
                  </h2>

                  <p className="text-base leading-7 text-muted-foreground">{post.excerpt}</p>
                </div>
              </Link>
            </article>
          ))}
        </div>
      </div>
    </main>
  )
}
