import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PublicDirectContact } from '@/components/public/PublicDirectContact';
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

export function PublicLandingTemplate({ locale, content, labels }: PublicLandingTemplateProps) {
  const t = getPublicTranslations(locale);

  return (
    <main className="min-h-screen bg-background">
      <div className="border-b">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/${locale}`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {labels.backToHome}
            </Link>
          </Button>
        </div>
      </div>

      <article className="max-w-4xl mx-auto px-6 py-12">
        <header className="mb-16">
          <h1 className="text-3xl font-bold tracking-tight mb-4">{content.hero.title}</h1>
          <p className="text-lg text-muted-foreground mb-6">{content.hero.subtitle}</p>
          <div className="space-y-4 text-muted-foreground">
            {content.hero.introParagraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          {content.hero.media && (
            <div className="mt-8 rounded-xl border border-border/50 shadow-sm overflow-hidden bg-background">
              {content.hero.media.type === 'image' ? (
                <Image
                  src={content.hero.media.src}
                  alt={content.hero.media.alt}
                  width={1200}
                  height={675}
                  sizes="(min-width: 1024px) 896px, 100vw"
                  className="w-full h-auto"
                />
              ) : (
                <video
                  className="w-full h-auto"
                  aria-label={content.hero.media.alt}
                  poster={content.hero.media.poster}
                  autoPlay
                  muted
                  loop
                  playsInline
                >
                  <source src={content.hero.media.src} type="video/webm" />
                  {content.hero.media.mp4FallbackSrc && (
                    <source src={content.hero.media.mp4FallbackSrc} type="video/mp4" />
                  )}
                </video>
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

      <footer className="border-t py-6 px-4">
        <div className="max-w-lg mx-auto flex items-center justify-center gap-6 text-sm text-muted-foreground">
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
