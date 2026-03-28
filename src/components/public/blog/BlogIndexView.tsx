import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { PublicSiteFooter } from '@/components/public/PublicSiteFooter'
import { PublicSiteHeader } from '@/components/public/PublicSiteHeader'
import { getBlogCopy } from '@/lib/blog/copy'
import { listLocalizedBlogPosts } from '@/lib/blog/firestore'
import type { LocalizedBlogPost } from '@/lib/blog/localized'
import type { PublicLocale } from '@/lib/public-locale'
import { cn } from '@/lib/utils'

const pageShellClass =
  'min-h-screen bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.12),transparent_32%),linear-gradient(180deg,#f8fbff_0%,#ffffff_28%,#f8fbff_100%)]'
const cardClass =
  'group overflow-hidden rounded-[2.2rem] border border-white/75 bg-white/94 shadow-[0_28px_90px_-62px_rgba(15,23,42,0.24)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_36px_100px_-58px_rgba(15,23,42,0.28)]'

function isBlogConfigured() {
  return Boolean(process.env.BLOG_ORG_ID?.trim())
}

function stripHtmlTags(value: string) {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function normalizePreviewText(value: string) {
  return value
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/\s+\./g, '.')
    .replace(/\.\s+,/g, '. ')
    .trim()
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength).replace(/\s+\S*$/, '')}…`
}

function getPostPreview(post: LocalizedBlogPost) {
  const excerpt = normalizePreviewText(post.excerpt)
  if (excerpt.length >= 96) {
    return truncateText(excerpt, 180)
  }

  return truncateText(normalizePreviewText(stripHtmlTags(post.contentHtml)), 180)
}

function formatCompactBlogDate(iso: string, locale: PublicLocale = 'ca') {
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return iso

  const localeMap: Record<PublicLocale, string> = {
    ca: 'ca-ES',
    es: 'es-ES',
    fr: 'fr-FR',
    pt: 'pt-PT',
  }

  return date.toLocaleDateString(localeMap[locale], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function BlogPostMedia({
  post,
  featured = false,
}: {
  post: LocalizedBlogPost
  featured?: boolean
}) {
  const shellClass = featured
    ? 'p-5 lg:p-6'
    : 'border-b border-border/40 p-4'
  const frameClass = featured
    ? 'aspect-[1.05/0.8] rounded-[1.8rem]'
    : 'aspect-[1.18/0.82] rounded-[1.4rem]'

  return (
    <div className={cn('bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(241,245,249,0.74))]', shellClass)}>
      <div
        className={cn(
          'relative overflow-hidden border border-white/80 bg-[linear-gradient(140deg,rgba(255,255,255,0.94),rgba(244,249,255,0.96))] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]',
          frameClass
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.08),transparent_20%)]" />

        {post.coverImageUrl ? (
          <div className="absolute inset-0">
            <Image
              src={post.coverImageUrl}
              alt={post.coverImageAlt || post.title}
              fill
              unoptimized
              sizes={featured ? '(min-width: 1024px) 42vw, 100vw' : '(min-width: 768px) 38vw, 100vw'}
              className="object-contain p-6 sm:p-7"
            />
          </div>
        ) : (
          <div className="absolute inset-0">
            <div className="absolute right-[-2.25rem] top-[-2.25rem] h-32 w-32 rounded-full bg-sky-100/80" />
            <div className="absolute bottom-[-1.4rem] left-[-1.1rem] h-24 w-24 rounded-full bg-sky-50/90" />
            <div className="absolute inset-x-7 bottom-8 space-y-3">
              <div className="h-3 rounded-full bg-slate-200/75" />
              <div className="h-3 w-3/4 rounded-full bg-slate-200/65" />
              <div className="h-3 w-1/2 rounded-full bg-slate-200/55" />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

interface BlogIndexViewProps {
  locale: PublicLocale
  blogBasePath: string
}

export async function BlogIndexView({
  locale,
  blogBasePath,
}: BlogIndexViewProps) {
  const copy = getBlogCopy(locale)

  if (!isBlogConfigured()) {
    return (
      <main className={pageShellClass}>
        <PublicSiteHeader locale={locale} currentSection="blog" />

        <section className="px-6 pb-20 pt-12 lg:pt-16">
          <div className="mx-auto max-w-5xl">
            <div className="max-w-[43rem] space-y-3">
              <h1 className="text-[2.45rem] font-semibold tracking-[-0.05em] text-foreground sm:text-[3.2rem]">
                {copy.title}
              </h1>
              <p className="text-base leading-7 text-muted-foreground sm:text-[1.04rem]">
                {copy.description}
              </p>
              <p className="text-sm text-muted-foreground">{copy.notConfigured}</p>
            </div>
          </div>
        </section>

        <PublicSiteFooter locale={locale} />
      </main>
    )
  }

  const posts = await listLocalizedBlogPosts(locale)
  const [featuredPost, ...otherPosts] = posts

  return (
    <main className={pageShellClass}>
      <PublicSiteHeader locale={locale} currentSection="blog" />

      <section className="px-6 pb-10 pt-12 lg:pt-16">
        <div className="mx-auto max-w-5xl">
          <div className="max-w-[43rem] space-y-3">
            <h1 className="text-[2.45rem] font-semibold tracking-[-0.05em] text-foreground sm:text-[3.2rem]">
              {copy.title}
            </h1>
            <p className="text-base leading-7 text-muted-foreground sm:text-[1.04rem]">
              {copy.description}
            </p>
          </div>
        </div>
      </section>

      <section className="px-6 pb-20">
        <div className="mx-auto max-w-5xl space-y-7">
          {featuredPost ? (
            <article className={cardClass}>
              <Link
                href={`${blogBasePath}/${featuredPost.slug}`}
                className="grid gap-0 lg:grid-cols-[0.92fr_1.08fr]"
              >
                <BlogPostMedia post={featuredPost} featured />

                <div className="flex flex-col justify-between p-7 sm:p-9">
                  <div className="space-y-4">
                    <p className="text-sm font-medium text-foreground/46">
                      {formatCompactBlogDate(featuredPost.publishedAt, locale)}
                    </p>
                    <h2 className="max-w-3xl text-[2.2rem] font-semibold leading-[1.02] tracking-[-0.055em] text-foreground sm:text-[3rem]">
                      {featuredPost.title}
                    </h2>
                    <p className="max-w-3xl text-[1.02rem] leading-8 text-foreground/68">
                      {getPostPreview(featuredPost)}
                    </p>
                  </div>

                  <span className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                    {copy.readArticle}
                    <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            </article>
          ) : (
            <div className="rounded-[2rem] border border-dashed border-border/70 bg-white/82 px-6 py-16 text-center shadow-[0_22px_70px_-50px_rgba(15,23,42,0.18)]">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                {copy.emptyTitle}
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
                {copy.emptyDescription}
              </p>
            </div>
          )}

          {otherPosts.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2">
              {otherPosts.map((post) => (
                <article key={post.id} className={cn(cardClass, 'h-full')}>
                  <Link href={`${blogBasePath}/${post.slug}`} className="block h-full">
                    <BlogPostMedia post={post} />

                    <div className="space-y-4 p-6 sm:p-7">
                      <p className="text-sm font-medium text-foreground/46">
                        {formatCompactBlogDate(post.publishedAt, locale)}
                      </p>
                      <h2 className="text-[1.9rem] font-semibold leading-[1.08] tracking-[-0.045em] text-foreground">
                        {post.title}
                      </h2>
                      <p className="text-[0.98rem] leading-7 text-foreground/68 line-clamp-4">
                        {getPostPreview(post)}
                      </p>
                      <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
                        {copy.readArticle}
                        <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </Link>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <PublicSiteFooter locale={locale} />
    </main>
  )
}
