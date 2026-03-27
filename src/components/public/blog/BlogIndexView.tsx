import Link from 'next/link'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { PublicSiteFooter } from '@/components/public/PublicSiteFooter'
import { PublicSiteHeader } from '@/components/public/PublicSiteHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getBlogCopy } from '@/lib/blog/copy'
import { formatBlogDate, listLocalizedBlogPosts } from '@/lib/blog/firestore'
import { getBlogCategoryLabel } from '@/lib/blog/presentation'
import type { PublicLocale } from '@/lib/public-locale'
import { getPublicTranslations } from '@/i18n/public'
import { cn } from '@/lib/utils'

const pageShellClass =
  'min-h-screen bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.12),transparent_32%),linear-gradient(180deg,#f8fbff_0%,#ffffff_26%,#ffffff_100%)]'
const cardClass =
  'overflow-hidden rounded-[1.9rem] border border-border/60 bg-white/92 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.2)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_32px_90px_-54px_rgba(15,23,42,0.26)]'

function isBlogConfigured() {
  return Boolean(process.env.BLOG_ORG_ID?.trim())
}

interface BlogIndexViewProps {
  locale: PublicLocale
  blogBasePath: string
  homeHref: string
}

export async function BlogIndexView({
  locale,
  blogBasePath,
  homeHref,
}: BlogIndexViewProps) {
  const copy = getBlogCopy(locale)
  const t = getPublicTranslations(locale)

  if (!isBlogConfigured()) {
    return (
      <main className={pageShellClass}>
        <PublicSiteHeader locale={locale} currentSection="blog" />

        <section className="px-6 pb-20 pt-8 lg:pt-12">
          <div className="mx-auto max-w-6xl">
            <Button asChild variant="ghost" size="sm" className="rounded-full px-4 text-muted-foreground hover:text-foreground">
              <Link href={homeHref}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {copy.backToHome}
              </Link>
            </Button>

            <div className="mt-6 grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-end">
              <div className="space-y-5">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/85">
                  {copy.eyebrow}
                </p>
                <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                  {copy.title}
                </h1>
                <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                  {copy.description}
                </p>
              </div>

              <div className="rounded-[2rem] border border-border/60 bg-white/92 p-6 shadow-[0_28px_80px_-56px_rgba(15,23,42,0.22)] sm:p-7">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/85">
                  {copy.panelTitle}
                </p>
                <p className="mt-4 text-base leading-7 text-muted-foreground">
                  {copy.notConfigured}
                </p>
              </div>
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

      <section className="px-6 pb-12 pt-8 lg:pt-12">
        <div className="mx-auto max-w-6xl">
          <Button asChild variant="ghost" size="sm" className="rounded-full px-4 text-muted-foreground hover:text-foreground">
            <Link href={homeHref}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {copy.backToHome}
            </Link>
          </Button>

          <div className="mt-6 grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-end">
            <div className="space-y-5">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/85">
                {copy.eyebrow}
              </p>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                {copy.title}
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                {copy.description}
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link href={`/${locale}#capabilities`}>{copy.discoverFeatures}</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href={`/${locale}/novetats`}>{copy.browseUpdates}</Link>
                </Button>
              </div>
            </div>

            <div className="rounded-[2rem] border border-sky-200/70 bg-white/92 p-6 shadow-[0_30px_90px_-56px_rgba(14,165,233,0.36)] sm:p-7">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/85">
                {copy.panelTitle}
              </p>
              <div className="mt-5 grid gap-4">
                {copy.panelPoints.map((point) => (
                  <div
                    key={point}
                    className="rounded-[1.35rem] border border-sky-100 bg-sky-50/70 px-4 py-3 text-sm leading-6 text-muted-foreground"
                  >
                    {point}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 pb-20">
        <div className="mx-auto max-w-6xl space-y-6">
          {featuredPost ? (
            <article className={cn(cardClass, 'border-sky-200/70 bg-white/95')}>
              <Link href={`${blogBasePath}/${featuredPost.slug}`} className="grid gap-0 lg:grid-cols-[0.92fr_1.08fr]">
                <div className="border-b border-border/60 bg-[linear-gradient(135deg,rgba(14,165,233,0.1),rgba(255,255,255,0.96)_45%,rgba(240,249,255,0.9))] p-6 lg:border-b-0 lg:border-r lg:p-8">
                  {featuredPost.coverImageUrl ? (
                    <div className="flex min-h-[280px] items-center justify-center rounded-[1.6rem] border border-white/80 bg-white/92 p-6 shadow-[0_20px_60px_-44px_rgba(15,23,42,0.2)]">
                      <img
                        src={featuredPost.coverImageUrl}
                        alt={featuredPost.coverImageAlt || featuredPost.title}
                        className="h-full max-h-[320px] w-full object-contain object-center"
                      />
                    </div>
                  ) : (
                    <div className="flex min-h-[280px] items-center justify-center rounded-[1.6rem] border border-dashed border-border/60 bg-white/80 p-6 text-sm text-muted-foreground">
                      {t.common.appName}
                    </div>
                  )}
                </div>

                <div className="flex flex-col justify-between p-6 sm:p-8">
                  <div className="space-y-5">
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge variant="outline" className="border-sky-200 bg-sky-50 text-primary">
                        {getBlogCategoryLabel(featuredPost.category, locale)}
                      </Badge>
                      <time dateTime={featuredPost.publishedAt} className="text-sm text-muted-foreground">
                        {formatBlogDate(featuredPost.publishedAt, locale)}
                      </time>
                    </div>

                    <div className="space-y-3">
                      <h2 className="max-w-3xl text-3xl font-semibold tracking-tight text-foreground sm:text-[2.25rem]">
                        {featuredPost.title}
                      </h2>
                      <p className="max-w-3xl text-base leading-7 text-muted-foreground">
                        {featuredPost.excerpt}
                      </p>
                    </div>
                  </div>

                  <span className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-primary">
                    {copy.readArticle}
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </Link>
            </article>
          ) : (
            <div className="rounded-[2rem] border border-dashed border-border/70 bg-white/75 px-6 py-16 text-center shadow-[0_22px_70px_-50px_rgba(15,23,42,0.18)]">
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
                <article key={post.id} className={cardClass}>
                  <Link href={`${blogBasePath}/${post.slug}`} className="block">
                    {post.coverImageUrl ? (
                      <div className="border-b border-border/60 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(241,245,249,0.8))] p-5">
                        <div className="flex min-h-[220px] items-center justify-center rounded-[1.35rem] border border-white/80 bg-white/92 p-5">
                          <img
                            src={post.coverImageUrl}
                            alt={post.coverImageAlt || post.title}
                            className="h-full max-h-[240px] w-full object-contain object-center"
                          />
                        </div>
                      </div>
                    ) : null}

                    <div className="space-y-4 p-6">
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge variant="outline" className="border-sky-200 bg-sky-50 text-primary">
                          {getBlogCategoryLabel(post.category, locale)}
                        </Badge>
                        <time dateTime={post.publishedAt} className="text-sm text-muted-foreground">
                          {formatBlogDate(post.publishedAt, locale)}
                        </time>
                      </div>

                      <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                        {post.title}
                      </h2>
                      <p className="text-base leading-7 text-muted-foreground">{post.excerpt}</p>

                      <span className="inline-flex items-center gap-2 text-sm font-medium text-primary">
                        {copy.readArticle}
                        <ArrowRight className="h-4 w-4" />
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
