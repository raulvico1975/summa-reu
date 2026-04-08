import Image from 'next/image';
import { PublicSiteFooter } from '@/components/public/PublicSiteFooter';
import { PublicSiteHeader } from '@/components/public/PublicSiteHeader';
import type { PublicLocale } from '@/lib/public-locale';
import type { PublicLandingContent } from '@/lib/public-landings';

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

const UI_COPY: Record<
  PublicLocale,
  {
    fullCycle: string;
  }
> = {
  ca: {
    fullCycle: 'El cicle complet',
  },
  es: {
    fullCycle: 'El ciclo completo',
  },
  fr: {
    fullCycle: 'Le cycle complet',
  },
  pt: {
    fullCycle: 'O ciclo completo',
  },
};

export function PublicLandingTemplate({ locale, content, labels }: PublicLandingTemplateProps) {
  const ui = UI_COPY[locale];
  const heroMedia = content.hero.media;
  const cards = content.visualProof?.items.slice(0, 3) ?? [];
  const relatedCases = content.relatedLandings?.items.slice(0, 4) ?? [];
  const videoThumbnailUrl =
    heroMedia?.type === 'video' ? heroMedia.poster ?? heroMedia.src : heroMedia?.src;

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900 selection:bg-blue-100 selection:text-blue-900">
      <PublicSiteHeader locale={locale} currentSection="features" />

      <main className="mx-auto max-w-[1400px] px-6 pb-32 pt-24 lg:px-12">
        <section className="mt-10 mb-32 flex flex-col items-start justify-between gap-12 lg:mb-40 lg:flex-row">
          <div className="max-w-[800px]">
            <h1 className="mb-6 text-[56px] font-medium leading-[1.05] tracking-tighter text-gray-900 lg:text-[72px]">
              {content.hero.title}
            </h1>
            <p className="max-w-2xl text-xl font-light leading-snug text-gray-600 lg:text-2xl">
              {content.hero.subtitle}
            </p>
          </div>
        </section>

        {cards.length > 0 ? (
          <section className="mb-40 grid grid-cols-1 gap-8 md:grid-cols-3">
            {cards.map((card, idx) => (
              <div key={card.title} className="group flex cursor-pointer flex-col">
                <div
                  className={`relative mb-6 flex aspect-[4/5] items-center justify-center rounded-[32px] bg-[#f4f7f9] p-10 transition-transform duration-500 group-hover:-translate-y-2 lg:p-12 ${
                    idx === 0 ? 'overflow-visible' : 'overflow-hidden'
                  }`}
                >
                  <div className="absolute left-1/2 top-1/2 z-0 h-4/5 w-4/5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-300/20 blur-[60px] transition-all duration-700 group-hover:scale-110 group-hover:bg-amber-300/30" />
                  <div
                    className={`relative z-10 overflow-hidden rounded-xl border border-black/5 bg-white shadow-[0_20px_40px_rgba(0,0,0,0.08)] transition-transform duration-500 group-hover:scale-[1.02] ${
                      idx === 0 ? 'ml-0 mr-[-1.5rem] translate-x-1 w-[calc(100%+1.5rem)]' : 'w-full'
                    }`}
                  >
                    <Image
                      src={card.imageSrc}
                      alt={card.imageAlt}
                      width={800}
                      height={800}
                      className="h-auto w-full object-cover object-top"
                    />
                  </div>
                </div>
                <div className="px-2">
                  <h2 className="mb-2 text-[22px] font-medium tracking-tight text-gray-900">{card.title}</h2>
                  <p className="text-[17px] leading-relaxed text-gray-500">{card.description}</p>
                </div>
              </div>
            ))}
          </section>
        ) : null}

        {relatedCases.length > 0 ? (
          <section className="mb-16">
            <h2 className="mb-8 text-[32px] font-medium tracking-tighter text-gray-900 lg:text-[40px]">{ui.fullCycle}</h2>
          </section>
        ) : null}

        {videoThumbnailUrl ? (
          <section className="group relative aspect-[16/9] w-full cursor-pointer overflow-hidden rounded-[32px] bg-black shadow-2xl lg:aspect-[2.4/1]">
            <Image
              src={videoThumbnailUrl}
              alt={heroMedia?.alt ?? `${labels.appName} demo`}
              fill
              className="object-cover opacity-80 transition-opacity duration-500 group-hover:opacity-100"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex h-16 w-20 items-center justify-center rounded-2xl bg-white/95 shadow-2xl backdrop-blur-md transition-transform group-hover:scale-105">
                <svg className="ml-1 h-8 w-8 text-black" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          </section>
        ) : null}
      </main>

      <PublicSiteFooter locale={locale} />
    </div>
  );
}
