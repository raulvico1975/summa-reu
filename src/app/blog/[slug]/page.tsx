import { notFound } from 'next/navigation'
import { formatBlogDate, getBlogPostBySlug } from '@/lib/blog/firestore'

export const revalidate = 60

type PageProps = {
  params: Promise<{ slug: string }>
}

export default async function BlogPostPage({ params }: PageProps) {
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
            alt={post.title}
            className="mb-10 h-auto w-full rounded-2xl border border-border object-cover"
          />
        ) : null}

        <div
          className="prose prose-neutral max-w-none"
          dangerouslySetInnerHTML={{ __html: post.contentHtml }}
        />
      </article>
    </main>
  )
}
