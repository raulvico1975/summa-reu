import Link from 'next/link'
import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import { getPublicTranslations } from '@/i18n/public'
import type { PublicLocale } from '@/lib/public-locale'

const FEATURES_PATH: Record<PublicLocale, string> = {
  ca: 'funcionalitats',
  es: 'funcionalitats',
  fr: 'fonctionnalites',
  pt: 'funcionalidades',
}

interface PublicSiteHeaderProps {
  locale: PublicLocale
}

export function PublicSiteHeader({ locale }: PublicSiteHeaderProps) {
  const t = getPublicTranslations(locale)
  const featuresPath = FEATURES_PATH[locale]

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center justify-between gap-4">
          <Link
            href={`/${locale}`}
            className="flex items-center gap-3 text-foreground transition-opacity hover:opacity-90"
          >
            <Logo className="h-10 w-10 text-primary" />
            <span className="text-base font-semibold">{t.common.appName}</span>
          </Link>

          <Button asChild variant="ghost" size="sm" className="lg:hidden">
            <Link href="/blog">{t.common.blog}</Link>
          </Button>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
          <nav className="hidden flex-wrap items-center gap-5 text-sm text-muted-foreground lg:flex">
            <Link
              href={`/${locale}/${featuresPath}`}
              className="transition-colors hover:text-foreground"
            >
              {t.common.features}
            </Link>
            <Link href="/blog" className="transition-colors hover:text-foreground">
              {t.common.blog}
            </Link>
            <Link href={`/${locale}/contact`} className="transition-colors hover:text-foreground">
              {t.common.contact}
            </Link>
          </nav>

          <div className="flex flex-wrap items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">{t.common.enter}</Link>
            </Button>
            <Button asChild size="sm">
              <Link href={`/${locale}/contact`}>{t.cta.primary}</Link>
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
