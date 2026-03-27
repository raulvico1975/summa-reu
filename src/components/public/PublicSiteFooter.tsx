import Link from 'next/link'
import { getPublicTranslations } from '@/i18n/public'
import { SUPPORT_EMAIL } from '@/lib/constants'
import type { PublicLocale } from '@/lib/public-locale'

const FOOTER_COPY: Record<
  PublicLocale,
  {
    sitemap: string
    socials: string
    socialsNote: string
  }
> = {
  ca: {
    sitemap: 'Mapa del web',
    socials: 'Xarxes',
    socialsNote: 'LinkedIn i Instagram ben aviat.',
  },
  es: {
    sitemap: 'Mapa del sitio',
    socials: 'Redes',
    socialsNote: 'LinkedIn e Instagram, muy pronto.',
  },
  fr: {
    sitemap: 'Plan du site',
    socials: 'Réseaux',
    socialsNote: 'LinkedIn et Instagram arrivent bientôt.',
  },
  pt: {
    sitemap: 'Mapa do site',
    socials: 'Redes',
    socialsNote: 'LinkedIn e Instagram em breve.',
  },
}

interface PublicSiteFooterProps {
  locale: PublicLocale
}

export function PublicSiteFooter({ locale }: PublicSiteFooterProps) {
  const t = getPublicTranslations(locale)
  const capabilitiesHref = `/${locale}#capabilities`
  const howWeWorkHref = `/${locale}#how-we-work`
  const updatesHref = `/${locale}/novetats`
  const blogHref = `/${locale}/blog`

  return (
    <footer className="border-t bg-muted/20 px-6 py-12">
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-3">
        <div className="space-y-4">
          <Link
            href={`/${locale}`}
            className="inline-flex items-center text-lg font-semibold tracking-tight text-foreground transition-opacity hover:opacity-90"
          >
            {t.common.appName}
          </Link>
          <p className="max-w-sm text-sm leading-6 text-muted-foreground">{t.common.tagline}</p>
        </div>

        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/85">
            {FOOTER_COPY[locale].sitemap}
          </p>
          <nav className="grid gap-3 text-sm text-muted-foreground">
            <Link href={capabilitiesHref} className="hover:text-foreground hover:underline">
              {t.common.features}
            </Link>
            <Link href={howWeWorkHref} className="hover:text-foreground hover:underline">
              {t.home.howWeWork.title}
            </Link>
            <Link href={updatesHref} className="hover:text-foreground hover:underline">
              {t.updates.title}
            </Link>
            <Link href={blogHref} className="hover:text-foreground hover:underline">
              {t.common.blog}
            </Link>
            <Link href={`/${locale}/privacy`} className="hover:text-foreground hover:underline">
              {t.common.privacy}
            </Link>
          </nav>
        </div>

        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/85">
            {t.common.contact}
          </p>
          <p className="text-sm leading-6 text-muted-foreground">{t.contact.responseTime}</p>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex text-sm font-medium text-primary hover:underline">
            {SUPPORT_EMAIL}
          </a>
          <div className="pt-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/85">
              {FOOTER_COPY[locale].socials}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{FOOTER_COPY[locale].socialsNote}</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
