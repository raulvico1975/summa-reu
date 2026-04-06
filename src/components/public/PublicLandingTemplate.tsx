import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Clock3, PlayCircle } from 'lucide-react';
import { PublicDirectContact } from '@/components/public/PublicDirectContact';
import { PublicEditorialMark } from '@/components/public/PublicEditorialMark';
import { PublicLandingVideo } from '@/components/public/PublicLandingVideo';
import { PUBLIC_SHELL_X } from '@/components/public/public-shell';
import { Button } from '@/components/ui/button';
import { RelatedLandings } from '@/components/public/RelatedLandings';
import type { PublicLocale } from '@/lib/public-locale';
import type { PublicLandingContent } from '@/lib/public-landings';
import { getPublicTranslations } from '@/i18n/public';

interface PublicLandingTemplateProps {
  locale: PublicLocale;
  content: PublicLandingContent;
  labels: {
    backToHome: string;
    contact: string;
    privacy: string;
    appName: string;
  };
}

const DEMO_PLACEHOLDER_COPY: Record<
  PublicLocale,
  {
    eyebrow: string;
    title: string;
    description: string;
    teaserLabel: string;
    teaserBody: string;
    fullDemoLabel: string;
    fullDemoBody: string;
    footer: string;
  }
> = {
  ca: {
    eyebrow: 'Demo de la funcionalitat',
    title: 'Espai reservat per al vídeo d’aquesta pàgina',
    description:
      'Quan la demo estigui a punt, quedarà incrustada aquí mateix sense haver de tocar l’estructura ni el relat de la landing.',
    teaserLabel: 'Teaser curt',
    teaserBody: 'Per entendre el flux en menys d’un minut.',
    fullDemoLabel: 'Demo completa',
    fullDemoBody: 'Per ensenyar el recorregut real de la funcionalitat.',
    footer: 'Vídeo en preparació. Aquesta landing ja queda preparada per allotjar-lo.',
  },
  es: {
    eyebrow: 'Demo de la funcionalidad',
    title: 'Espacio reservado para el vídeo de esta página',
    description:
      'Cuando la demo esté lista, quedará incrustada aquí sin tener que rehacer la estructura ni el relato de la landing.',
    teaserLabel: 'Teaser corto',
    teaserBody: 'Para entender el flujo en menos de un minuto.',
    fullDemoLabel: 'Demo completa',
    fullDemoBody: 'Para enseñar el recorrido real de la funcionalidad.',
    footer: 'Vídeo en preparación. Esta landing ya queda lista para alojarlo.',
  },
  fr: {
    eyebrow: 'Démo de la fonctionnalité',
    title: 'Espace réservé à la vidéo de cette page',
    description:
      'Quand la démo sera prête, elle sera intégrée ici sans devoir refaire la structure ni le récit de la landing.',
    teaserLabel: 'Teaser court',
    teaserBody: 'Pour comprendre le flux en moins d’une minute.',
    fullDemoLabel: 'Démo complète',
    fullDemoBody: 'Pour montrer le parcours réel de la fonctionnalité.',
    footer: 'Vidéo en préparation. Cette landing est déjà prête à l’accueillir.',
  },
  pt: {
    eyebrow: 'Demo da funcionalidade',
    title: 'Espaço reservado para o vídeo desta página',
    description:
      'Quando a demo estiver pronta, ficará embutida aqui sem ser preciso mexer na estrutura nem no relato da landing.',
    teaserLabel: 'Teaser curto',
    teaserBody: 'Para perceber o fluxo em menos de um minuto.',
    fullDemoLabel: 'Demo completa',
    fullDemoBody: 'Para mostrar o percurso real da funcionalidade.',
    footer: 'Vídeo em preparação. Esta landing já fica pronta para o receber.',
  },
};

export function PublicLandingTemplate({ locale, content, labels }: PublicLandingTemplateProps) {
  const t = getPublicTranslations(locale);
  const demoCopy = DEMO_PLACEHOLDER_COPY[locale];
  const heroMedia = content.hero.media;
  const isVideo = heroMedia?.type === 'video';
  const prefersMp4AsPrimary = isVideo ? heroMedia.src.toLowerCase().endsWith('.mp4') : false;
  const shouldAutoPlay = isVideo ? (heroMedia.autoPlay ?? true) : false;
  const shouldLoop = isVideo ? (heroMedia.loop ?? shouldAutoPlay) : false;
  const shouldMute = isVideo ? (heroMedia.muted ?? shouldAutoPlay) : false;
  const shouldShowControls = isVideo ? (heroMedia.controls ?? false) : false;
  const hasFeaturedDemo = isVideo && shouldShowControls;
  const articleClassName = hasFeaturedDemo
    ? `${PUBLIC_SHELL_X} mx-auto max-w-6xl py-12`
    : `${PUBLIC_SHELL_X} mx-auto max-w-4xl py-12`;
  const headerShellClass = hasFeaturedDemo
    ? 'rounded-[2rem] border border-sky-200/70 bg-[linear-gradient(135deg,rgba(14,165,233,0.08),rgba(255,255,255,0.98)_52%,rgba(240,249,255,0.94))] p-6 shadow-[0_30px_90px_-56px_rgba(14,165,233,0.34)] sm:p-8 lg:p-10'
    : 'rounded-[1.7rem] border border-border/50 bg-background/95 p-4 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.2)]';
  const mediaClassName = hasFeaturedDemo
    ? 'w-full aspect-video rounded-[1.5rem] bg-black object-cover'
    : 'w-full h-auto';

  const mediaBlock = heroMedia ? (
    <div className={headerShellClass}>
      {hasFeaturedDemo ? (
        <div className="mb-5 flex flex-wrap justify-end gap-2">
          {heroMedia.durationLabel ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/92 px-3 py-1 text-[12px] font-medium text-slate-700 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.45)]">
              <Clock3 className="h-3.5 w-3.5 text-slate-500" />
              {heroMedia.durationLabel}
            </span>
          ) : null}
          {heroMedia.captionsSrc ? (
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white/92 px-3 py-1 text-[12px] font-semibold tracking-[0.08em] text-slate-700 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.45)]">
              CC
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[1.5rem] border border-border/50 bg-background shadow-[0_24px_70px_-52px_rgba(15,23,42,0.35)]">
        {heroMedia.type === 'image' ? (
          <Image
            src={heroMedia.src}
            alt={heroMedia.alt}
            width={1600}
            height={900}
            sizes={hasFeaturedDemo ? '(min-width: 1024px) 1100px, 100vw' : '(min-width: 1024px) 560px, 100vw'}
            className="w-full h-auto"
          />
        ) : (
          <PublicLandingVideo
            src={heroMedia.src}
            alt={heroMedia.alt}
            poster={heroMedia.poster}
            mp4FallbackSrc={heroMedia.mp4FallbackSrc}
            captionsSrc={heroMedia.captionsSrc}
            captionsLang={heroMedia.captionsLang ?? locale}
            captionsLabel={heroMedia.captionsLabel ?? labels.appName}
            captionsDefault={heroMedia.captionsDefault ?? false}
            captionsDisplay={heroMedia.captionsDisplay ?? 'native'}
            autoPlay={shouldAutoPlay}
            muted={shouldMute}
            loop={shouldLoop}
            controls={shouldShowControls}
            preload={shouldShowControls ? 'metadata' : 'auto'}
            className={mediaClassName}
            prefersMp4AsPrimary={prefersMp4AsPrimary}
          />
        )}
      </div>
    </div>
  ) : null;

  return (
    <main className="min-h-screen bg-background">
      <div className="border-b">
        <div className={`${PUBLIC_SHELL_X} mx-auto max-w-4xl py-4`}>
          <Button asChild variant="ghost" size="sm">
            <Link href={`/${locale}`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {labels.backToHome}
            </Link>
          </Button>
        </div>
      </div>

      <article className={articleClassName}>
        <header className="mb-16">
          {hasFeaturedDemo ? (
            <div className="space-y-8">
              <div className="max-w-4xl">
                <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-[3.4rem]">
                  {content.hero.title}
                </h1>
                <PublicEditorialMark size="sm" className="mt-3 opacity-70" />
                <p className="mt-4 max-w-3xl text-xl leading-8 text-muted-foreground">
                  {content.hero.subtitle}
                </p>
              </div>

              {mediaBlock}

              <div className="max-w-4xl space-y-4 text-base leading-8 text-muted-foreground sm:text-lg">
                {content.hero.introParagraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-start lg:gap-10">
              <div>
                <h1 className="text-3xl font-bold tracking-tight mb-4">{content.hero.title}</h1>
                <PublicEditorialMark size="sm" className="-mt-1 mb-4 opacity-70" />
                <p className="text-lg text-muted-foreground mb-6">{content.hero.subtitle}</p>
                <div className="space-y-4 text-muted-foreground">
                  {content.hero.introParagraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </div>

              {mediaBlock ?? (
                <div className="rounded-[1.35rem] border border-dashed border-sky-200 bg-[linear-gradient(135deg,rgba(14,165,233,0.08),rgba(255,255,255,0.96)_45%,rgba(240,249,255,0.9))] p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-primary shadow-sm">
                      <PlayCircle className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/85">
                        {demoCopy.eyebrow}
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                        {demoCopy.title}
                      </h2>
                    </div>
                  </div>

                  <p className="mt-5 text-sm leading-6 text-muted-foreground">{demoCopy.description}</p>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[1.15rem] border border-white/90 bg-white/92 p-4 shadow-sm">
                      <p className="text-sm font-semibold text-foreground">{demoCopy.teaserLabel}</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{demoCopy.teaserBody}</p>
                    </div>
                    <div className="rounded-[1.15rem] border border-white/90 bg-white/92 p-4 shadow-sm">
                      <p className="text-sm font-semibold text-foreground">{demoCopy.fullDemoLabel}</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{demoCopy.fullDemoBody}</p>
                    </div>
                  </div>

                  <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/88 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-primary/85">
                    <Clock3 className="h-3.5 w-3.5" />
                    <span>{demoCopy.footer}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </header>

        <div className="space-y-12">
          <section>
            <h2 className="text-2xl font-bold mb-3">{content.problem.title}</h2>
            <p className="text-muted-foreground mb-4">{content.problem.intro}</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              {content.problem.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
            {content.problem.outroParagraphs?.map((paragraph) => (
              <p key={paragraph} className="text-muted-foreground mt-4">
                {paragraph}
              </p>
            ))}
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-3">{content.solution.title}</h2>
            <p className="text-muted-foreground mb-4">{content.solution.intro}</p>
            <ol className="space-y-4">
              {content.solution.steps.map((step, index) => (
                <li key={step.title} className="flex gap-3">
                  <span className="text-sm font-semibold text-primary mt-0.5">{index + 1}.</span>
                  <div>
                    <p className="font-medium">{step.title}</p>
                    <p className="text-muted-foreground">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-3">{content.includes.title}</h2>
            <p className="text-muted-foreground mb-4">{content.includes.intro}</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              {content.includes.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {content.includes.outroParagraphs?.map((paragraph) => (
              <p key={paragraph} className="text-muted-foreground mt-4">
                {paragraph}
              </p>
            ))}
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-3">{content.operationalBenefits.title}</h2>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              {content.operationalBenefits.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-3">{content.forSmallAndMidEntities.title}</h2>
            <div className="space-y-4 text-muted-foreground">
              {content.forSmallAndMidEntities.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </section>

          {content.relatedLandings && (
            <RelatedLandings section={content.relatedLandings} />
          )}

          <section className="border-t pt-10">
            <h2 className="text-2xl font-bold mb-3">{t.cta.secondary}</h2>
            <p className="text-muted-foreground mb-4">{t.contact.description}</p>
            <Button asChild size="lg">
              <Link href={`/${locale}/contact`}>{t.cta.primary}</Link>
            </Button>
            <PublicDirectContact locale={locale} className="mt-6" />
          </section>
        </div>
      </article>

      <footer className={`border-t py-6 ${PUBLIC_SHELL_X}`}>
        <div className="mx-auto flex max-w-lg items-center justify-center gap-6 text-sm text-muted-foreground">
          <Link href={`/${locale}/privacy`} className="hover:underline">
            {labels.privacy}
          </Link>
          <span>-</span>
          <Link href={`/${locale}/contact`} className="hover:underline">
            {labels.contact}
          </Link>
          <span>-</span>
          <span>{labels.appName}</span>
        </div>
      </footer>
    </main>
  );
}
