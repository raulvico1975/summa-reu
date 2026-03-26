import Link from 'next/link'
import { ArrowRight, ChevronDown, Menu } from 'lucide-react'
import { Logo } from '@/components/logo'
import { Button, buttonVariants } from '@/components/ui/button'
import { getPublicTranslations } from '@/i18n/public'
import type { PublicLocale } from '@/lib/public-locale'
import { cn } from '@/lib/utils'

interface PublicSiteHeaderProps {
  locale: PublicLocale
}

export function PublicSiteHeader({ locale }: PublicSiteHeaderProps) {
  const t = getPublicTranslations(locale)
  const capabilitiesHref = `/${locale}#capabilities`
  const aboutHref = `/${locale}/qui-som`
  const updatesHref = `/${locale}/novetats`

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto max-w-6xl px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <Link
            href={`/${locale}`}
            className="flex items-center gap-3 text-foreground transition-opacity hover:opacity-90"
          >
            <Logo className="h-10 w-10 text-primary" />
            <span className="text-base font-semibold">{t.common.appName}</span>
          </Link>

          <div className="hidden lg:flex lg:items-center lg:gap-6">
            <nav className="hidden flex-wrap items-center gap-5 text-sm text-muted-foreground lg:flex">
              <Link href={capabilitiesHref} className="transition-colors hover:text-foreground">
                {t.common.features}
              </Link>
              <Link href={aboutHref} className="transition-colors hover:text-foreground">
                {t.common.about}
              </Link>
              <Link href={updatesHref} className="transition-colors hover:text-foreground">
                {t.updates.navLabel}
              </Link>
              <Link href="/blog" className="transition-colors hover:text-foreground">
                {t.common.blog}
              </Link>
            </nav>

            <Button asChild size="sm">
              <Link href={`/${locale}/contact`}>{t.cta.primary}</Link>
            </Button>
          </div>
        </div>

        <details className="group mt-4 lg:hidden">
          <summary
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'ml-auto flex w-fit list-none items-center gap-2 rounded-full border-border/70 bg-white/90 px-4 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.4)] marker:hidden [&::-webkit-details-marker]:hidden'
            )}
          >
            <Menu className="h-4 w-4" />
            <span>{t.common.menu}</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
          </summary>

          <div className="relative mt-3 overflow-hidden rounded-[1.5rem] border border-border/60 bg-white/95 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.35)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-200 to-transparent" />

            <nav className="relative px-3 py-3">
              <Link
                href={capabilitiesHref}
                className="group/item flex items-center justify-between rounded-[1.15rem] px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-sky-50"
              >
                <span>{t.common.features}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover/item:translate-x-0.5" />
              </Link>

              <Link
                href={aboutHref}
                className="group/item flex items-center justify-between rounded-[1.15rem] px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-sky-50"
              >
                <span>{t.common.about}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover/item:translate-x-0.5" />
              </Link>

              <Link
                href={updatesHref}
                className="group/item flex items-center justify-between rounded-[1.15rem] px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-sky-50"
              >
                <span>{t.updates.navLabel}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover/item:translate-x-0.5" />
              </Link>

              <Link
                href="/blog"
                className="group/item flex items-center justify-between rounded-[1.15rem] px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-sky-50"
              >
                <span>{t.common.blog}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover/item:translate-x-0.5" />
              </Link>
            </nav>

            <div className="border-t border-border/50 px-4 py-4">
              <Link
                href={`/${locale}/contact`}
                className={cn(
                  buttonVariants({ size: 'lg' }),
                  'w-full justify-center rounded-2xl shadow-[0_24px_60px_-28px_rgba(14,165,233,0.55)]'
                )}
              >
                {t.cta.primary}
              </Link>
            </div>
          </div>
        </details>
      </div>
    </header>
  )
}
