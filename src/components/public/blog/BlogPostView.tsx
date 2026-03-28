import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { PublicSiteFooter } from '@/components/public/PublicSiteFooter'
import { PublicSiteHeader } from '@/components/public/PublicSiteHeader'
import { Button } from '@/components/ui/button'
import { getBlogCopy } from '@/lib/blog/copy'
import { formatBlogDate, getLocalizedBlogPostBySlug } from '@/lib/blog/firestore'
import { getBlogCategoryLabel } from '@/lib/blog/presentation'
import {
  estimateBlogReadingTimeMinutes,
  formatBlogReadingTime,
} from '@/lib/blog/reading-time'
import type { PublicLocale } from '@/lib/public-locale'
import { getPublicTranslations } from '@/i18n/public'

const pageShellClass =
  'min-h-screen bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.12),transparent_32%),linear-gradient(180deg,#f8fbff_0%,#ffffff_28%,#f8fbff_100%)]'

function isBlogConfigured() {
  return Boolean(process.env.BLOG_ORG_ID?.trim())
}

function buildArticleMeta(
  categoryLabel: string,
  publishedAt: string,
  readingTime: string,
  locale: PublicLocale
) {
  return [categoryLabel, formatBlogDate(publishedAt, locale), readingTime].join(' · ')
}

interface BlogPostViewProps {
  locale: PublicLocale
  slug: string
  blogBasePath: string
}

export async function BlogPostView({
  locale,
  slug,
  blogBasePath,
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
  const featuresHref = `/${locale}#capabilities`
  const readingTime = formatBlogReadingTime(
    estimateBlogReadingTimeMinutes(post.contentHtml),
    locale
  )
  const articleMeta = buildArticleMeta(
    categoryLabel,
    post.publishedAt,
    readingTime,
    locale
  )

  return (
    <main className={pageShellClass}>
      <PublicSiteHeader locale={locale} currentSection="blog" />

      <section className="px-6 pb-12 pt-10 lg:pt-14">
        <div className="mx-auto max-w-5xl">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="rounded-full px-4 text-muted-foreground hover:text-foreground"
          >
            <Link href={blogBasePath}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {copy.browseBlog}
            </Link>
          </Button>

          <div className="mt-7 overflow-hidden rounded-[2.35rem] border border-white/75 bg-white/94 shadow-[0_34px_100px_-64px_rgba(15,23,42,0.28)]">
            <div className="grid gap-0 lg:grid-cols-[1.02fr_0.98fr]">
              <div className="flex flex-col justify-between p-7 sm:p-9 lg:p-10">
                <div className="space-y-5">
                  <p className="text-sm font-medium text-foreground/46">
                    {articleMeta}
                  </p>
                  <h1 className="max-w-4xl text-[2.6rem] font-semibold leading-[1] tracking-[-0.06em] text-foreground sm:text-[3.6rem] lg:text-[4.4rem]">
                    {post.title}
                  </h1>
                  <p className="max-w-2xl text-[1.05rem] leading-8 text-foreground/68 sm:text-[1.12rem]">
                    {post.excerpt}
                  </p>
                </div>
              </div>

              <div className="bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(241,245,249,0.76))] p-5 lg:p-6">
                <div className="relative overflow-hidden rounded-[1.85rem] border border-white/80 bg-[linear-gradient(140deg,rgba(255,255,255,0.94),rgba(244,249,255,0.96))] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.08),transparent_20%)]" />

                  {post.coverImageUrl ? (
                    <div className="relative aspect-[1.02/0.92] min-h-[300px]">
                      <Image
                        src={post.coverImageUrl}
                        alt={post.coverImageAlt || post.title}
                        fill
                        unoptimized
                        sizes="(min-width: 1024px) 40vw, 100vw"
                        className="object-contain p-7 sm:p-8"
                      />
                    </div>
                  ) : (
                    <div className="relative aspect-[1.02/0.92] min-h-[300px]">
                      <div className="absolute right-[-2.25rem] top-[-2.25rem] h-32 w-32 rounded-full bg-sky-100/80" />
                      <div className="absolute bottom-[-1.4rem] left-[-1.1rem] h-24 w-24 rounded-full bg-sky-50/90" />
                      <div className="absolute inset-x-8 bottom-9 space-y-3">
                        <div className="h-3 rounded-full bg-slate-200/75" />
                        <div className="h-3 w-3/4 rounded-full bg-slate-200/65" />
                        <div className="h-3 w-1/2 rounded-full bg-slate-200/55" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 pb-14">
        <article className="mx-auto max-w-[54rem] rounded-[2.25rem] border border-white/75 bg-white/96 px-6 py-8 shadow-[0_36px_110px_-72px_rgba(15,23,42,0.24)] sm:px-10 sm:py-12 lg:px-14">
          <div
            className="blog-rich-text"
            dangerouslySetInnerHTML={{ __html: post.contentHtml }}
          />
        </article>
      </section>

      <section className="px-6 pb-20">
        <div className="mx-auto flex max-w-[54rem] flex-wrap items-center justify-between gap-4 rounded-[1.8rem] border border-white/75 bg-white/90 px-5 py-4 shadow-[0_28px_90px_-70px_rgba(15,23,42,0.24)] sm:px-6">
          <Button asChild variant="outline" className="rounded-full">
            <Link href={blogBasePath}>{copy.browseBlog}</Link>
          </Button>
          <Button asChild className="rounded-full">
            <Link href={featuresHref}>
              {t.common.features}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <PublicSiteFooter locale={locale} />
    </main>
  )
}
