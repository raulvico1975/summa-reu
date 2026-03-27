import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { PublicSiteFooter } from '@/components/public/PublicSiteFooter'
import { PublicSiteHeader } from '@/components/public/PublicSiteHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getBlogCopy } from '@/lib/blog/copy'
import { formatBlogDate, getLocalizedBlogPostBySlug } from '@/lib/blog/firestore'
import { getBlogCategoryLabel } from '@/lib/blog/presentation'
import type { PublicLocale } from '@/lib/public-locale'
import { getPublicTranslations } from '@/i18n/public'

const pageShellClass =
  'min-h-screen bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.12),transparent_32%),linear-gradient(180deg,#f8fbff_0%,#ffffff_26%,#ffffff_100%)]'

function isBlogConfigured() {
  return Boolean(process.env.BLOG_ORG_ID?.trim())
}

interface BlogPostViewProps {
  locale: PublicLocale
  slug: string
  blogBasePath: string
  homeHref: string
}

export async function BlogPostView({
  locale,
  slug,
  blogBasePath,
  homeHref,
}: BlogPostViewProps) {
  if (!isBlogConfigured()) {
    notFound()
  }

  const post = await getLocalizedBlogPostBySlug(slug, locale)

  if (!post) {
    notFound()
  }

  const copy = getBlogCopy(locale)
  const t = getPublicTranslations(locale)
  const categoryLabel = getBlogCategoryLabel(post.category, locale)

  return (
    <main className={pageShellClass}>
      <PublicSiteHeader locale={locale} currentSection="blog" />

      <section className="px-6 pb-10 pt-8 lg:pt-12">
        <div className="mx-auto max-w-5xl">
          <Button asChild variant="ghost" size="sm" className="rounded-full px-4 text-muted-foreground hover:text-foreground">
            <Link href={blogBasePath}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {copy.browseBlog}
            </Link>
          </Button>

          <div className="mt-6 grid gap-6 lg:grid-cols-[0.34fr_0.66fr] lg:items-start">
            <aside className="rounded-[1.9rem] border border-border/60 bg-white/92 p-6 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.18)]">
              <Badge variant="outline" className="border-sky-200 bg-sky-50 text-primary">
                {categoryLabel}
              </Badge>
              <p className="mt-4 text-sm text-muted-foreground">
                <time dateTime={post.publishedAt}>{formatBlogDate(post.publishedAt, locale)}</time>
              </p>
              <div className="mt-6 rounded-[1.35rem] border border-sky-100 bg-sky-50/70 p-4 text-sm leading-6 text-muted-foreground">
                {copy.detailAside}
              </div>
            </aside>

            <div className="space-y-5">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                {post.title}
              </h1>
              <p className="max-w-3xl text-lg leading-8 text-muted-foreground">{post.excerpt}</p>
            </div>
          </div>
        </div>
      </section>

      {post.coverImageUrl ? (
        <section className="px-6 pb-10">
          <div className="mx-auto max-w-5xl rounded-[2rem] border border-border/60 bg-white/95 p-5 shadow-[0_28px_80px_-56px_rgba(15,23,42,0.22)] sm:p-6">
            <div className="flex min-h-[280px] items-center justify-center rounded-[1.6rem] border border-sky-100 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(241,245,249,0.8))] p-6 sm:min-h-[360px]">
              <img
                src={post.coverImageUrl}
                alt={post.coverImageAlt || post.title}
                className="h-full min-h-[240px] w-full object-contain object-center sm:min-h-[320px]"
              />
            </div>
          </div>
        </section>
      ) : null}

      <section className="px-6 pb-12">
        <article className="mx-auto max-w-4xl rounded-[2rem] border border-border/60 bg-white/95 p-6 shadow-[0_28px_80px_-56px_rgba(15,23,42,0.22)] sm:p-10">
          <div
            className="blog-rich-text"
            dangerouslySetInnerHTML={{ __html: post.contentHtml }}
          />
        </article>
      </section>

      <section className="px-6 pb-20">
        <div className="mx-auto max-w-5xl rounded-[2rem] border border-border/60 bg-white/90 p-6 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.18)] sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/85">
            {copy.continueTitle}
          </p>
          <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
            {copy.continueDescription}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href={blogBasePath}>{copy.browseBlog}</Link>
            </Button>
            <Button asChild>
              <Link href={`${homeHref}#capabilities`}>
                {t.common.features}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <PublicSiteFooter locale={locale} />
    </main>
  )
}
