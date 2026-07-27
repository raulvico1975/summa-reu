import Link from 'next/link'
import { PUBLIC_WIDE_SHELL } from '@/components/public/public-shell'
import { getPublicTranslations } from '@/i18n/public'
import { SUPPORT_EMAIL } from '@/lib/constants'
import type { PublicLocale } from '@/lib/public-locale'
import { getPublicFeaturesHref } from '@/lib/public-site-paths'

const FOOTER_COPY: Record<
  PublicLocale,
  {
    sitemap: string
    manual: string
    caseStudy: string
    trust: string
    socials: string
    socialsNote: string
    bankTemplate: string
  }
> = {
  ca: {
    sitemap: 'Mapa del web',
    manual: 'Manual',
    caseStudy: 'Cas real: Flores de Kiskeya',
    trust: 'Confiança i dades',
    socials: 'Xarxes',
    socialsNote: 'LinkedIn i Instagram ben aviat.',
    bankTemplate: 'Plantilla de conciliació bancària',
  },
  es: {
    sitemap: 'Mapa del sitio',
    manual: 'Manual',
    caseStudy: 'Caso real: Flores de Kiskeya',
    trust: 'Confianza y datos',
    socials: 'Redes',
    socialsNote: 'LinkedIn e Instagram, muy pronto.',
    bankTemplate: 'Plantilla de conciliación bancaria',
  },
  fr: {
    sitemap: 'Plan du site',
    manual: 'Manuel',
    caseStudy: 'Cas réel : Flores de Kiskeya',
    trust: 'Confiance et données',
    socials: 'Réseaux',
    socialsNote: 'LinkedIn et Instagram arrivent bientôt.',
    bankTemplate: 'Modèle de rapprochement bancaire',
  },
  pt: {
    sitemap: 'Mapa do site',
    manual: 'Manual',
    caseStudy: 'Caso real: Flores de Kiskeya',
    trust: 'Confiança e dados',
    socials: 'Redes',
    socialsNote: 'LinkedIn e Instagram em breve.',
    bankTemplate: 'Modelo de conciliação bancária',
  },
}

interface PublicSiteFooterProps {
  locale: PublicLocale
}

export function PublicSiteFooter({ locale }: PublicSiteFooterProps) {
  const t = getPublicTranslations(locale)
  const featuresHref = getPublicFeaturesHref(locale)
  const howWeWorkHref = `/${locale}#how-we-work`
  const updatesHref = `/${locale}/novetats`
  const blogHref = `/${locale}/blog`
  const hasPublicManual = locale === 'ca' || locale === 'es'
  const hasPublicProofPages = locale === 'ca' || locale === 'es'
  const bankTemplateHref =
    locale === 'ca'
      ? '/ca/recursos/plantilla-conciliacio-bancaria'
      : '/es/recursos/plantilla-conciliacion-bancaria'

  return (
    <footer className="border-t bg-muted/20 py-12">
      <div className={`${PUBLIC_WIDE_SHELL} grid gap-10 md:grid-cols-3`}>
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
            <Link href={featuresHref} className="hover:text-foreground hover:underline">
              {t.common.features}
            </Link>
            <Link href={howWeWorkHref} className="hover:text-foreground hover:underline">
              {t.home.howWeWork.title}
            </Link>
            <Link href={updatesHref} className="hover:text-foreground hover:underline">
              {t.updates.navLabel}
            </Link>
            <Link href={blogHref} className="hover:text-foreground hover:underline">
              {t.common.blog}
            </Link>
            {hasPublicManual && (
              <>
                <Link href={`/${locale}/manual`} className="hover:text-foreground hover:underline">
                  {FOOTER_COPY[locale].manual}
                </Link>
                <Link href={bankTemplateHref} className="hover:text-foreground hover:underline">
                  {FOOTER_COPY[locale].bankTemplate}
                </Link>
              </>
            )}
            {hasPublicProofPages && (
              <>
                <Link
                  href={`/${locale}/casos/flores-de-kiskeya`}
                  className="hover:text-foreground hover:underline"
                >
                  {FOOTER_COPY[locale].caseStudy}
                </Link>
                <Link href={`/${locale}/confianza`} className="hover:text-foreground hover:underline">
                  {FOOTER_COPY[locale].trust}
                </Link>
              </>
            )}
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
