'use client';

import Image from 'next/image';
import { Clock3, Play } from 'lucide-react';
import { useState } from 'react';
import { PublicLandingVideo } from '@/components/public/PublicLandingVideo';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import type { PublicLandingHeroMedia } from '@/lib/public-landings';
import type { PublicLocale } from '@/lib/public-locale';
import { cn } from '@/lib/utils';

const DEMO_LABELS: Record<
  PublicLocale,
  {
    demo: string;
    captions: string;
    open: string;
    modalDescription: string;
  }
> = {
  ca: {
    demo: 'Demo guiada',
    captions: 'CC',
    open: 'Obrir demo',
    modalDescription: 'Vista ampliada de la demo perquè es pugui seguir millor el flux.',
  },
  es: {
    demo: 'Demo guiada',
    captions: 'CC',
    open: 'Abrir demo',
    modalDescription: 'Vista ampliada de la demo para seguir mejor el flujo.',
  },
  fr: {
    demo: 'Démo guidée',
    captions: 'CC',
    open: 'Ouvrir la démo',
    modalDescription: 'Vue agrandie de la démo pour mieux suivre le flux.',
  },
  pt: {
    demo: 'Demo guiada',
    captions: 'CC',
    open: 'Abrir demo',
    modalDescription: 'Vista ampliada da demo para acompanhar melhor o fluxo.',
  },
};

interface PublicFeatureDemoProps {
  locale: PublicLocale;
  media: PublicLandingHeroMedia;
  className?: string;
  mediaClassName?: string;
  showDemoBadge?: boolean;
  showCaptionsBadge?: boolean;
  expandOnPlay?: boolean;
  dialogTitle?: string;
  dialogDescription?: string;
}

export function PublicFeatureDemo({
  locale,
  media,
  className,
  mediaClassName,
  showDemoBadge = true,
  showCaptionsBadge = true,
  expandOnPlay = false,
  dialogTitle,
  dialogDescription,
}: PublicFeatureDemoProps) {
  const labels = DEMO_LABELS[locale];
  const prefersMp4AsPrimary = media.type === 'video' ? media.src.toLowerCase().endsWith('.mp4') : false;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const showMetaRow = showDemoBadge || Boolean(media.durationLabel) || (showCaptionsBadge && Boolean(media.captionsSrc));
  const canExpandVideo = expandOnPlay && media.type === 'video';

  const previewFrame = canExpandVideo ? (
    <button
      type="button"
      onClick={() => setIsModalOpen(true)}
      className="group relative block w-full overflow-hidden rounded-[1.3rem] border border-border/60 bg-slate-950 shadow-[0_24px_65px_-48px_rgba(15,23,42,0.45)]"
      aria-label={labels.open}
    >
      {media.poster ? (
        <Image
          src={media.poster}
          alt={media.alt}
          width={1600}
          height={900}
          sizes="(min-width: 1024px) 42vw, 100vw"
          className={cn('aspect-video w-full object-cover transition-transform duration-300 group-hover:scale-[1.01]', mediaClassName)}
        />
      ) : (
        <PublicLandingVideo
          src={media.src}
          alt={media.alt}
          poster={media.poster}
          mp4FallbackSrc={media.mp4FallbackSrc}
          captionsSrc={media.captionsSrc}
          captionsLang={media.captionsLang ?? locale}
          captionsLabel={media.captionsLabel ?? labels.demo}
          captionsDefault={media.captionsDefault ?? false}
          captionsDisplay="native"
          autoPlay={false}
          muted
          loop={false}
          controls={false}
          preload="none"
          className={cn('aspect-video w-full bg-black object-cover', mediaClassName)}
          prefersMp4AsPrimary={prefersMp4AsPrimary}
        />
      )}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.05),rgba(15,23,42,0.22))]" />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[linear-gradient(135deg,#0ea5e9,#38bdf8)] p-[2px] shadow-[0_20px_40px_-24px_rgba(14,165,233,0.9)] transition-transform duration-300 group-hover:scale-105">
          <span className="flex h-full w-full items-center justify-center rounded-full bg-white/95 backdrop-blur">
            <Play className="ml-1 h-8 w-8 fill-sky-500 text-sky-500" strokeWidth={2.1} />
          </span>
        </span>
      </div>
    </button>
  ) : (
    <div className="overflow-hidden rounded-[1.3rem] border border-border/60 bg-slate-950 shadow-[0_24px_65px_-48px_rgba(15,23,42,0.45)]">
      {media.type === 'image' ? (
        <Image
          src={media.src}
          alt={media.alt}
          width={1600}
          height={900}
          sizes="(min-width: 1024px) 42vw, 100vw"
          className={cn('aspect-video w-full object-cover', mediaClassName)}
        />
      ) : (
        <PublicLandingVideo
          src={media.src}
          alt={media.alt}
          poster={media.poster}
          mp4FallbackSrc={media.mp4FallbackSrc}
          captionsSrc={media.captionsSrc}
          captionsLang={media.captionsLang ?? locale}
          captionsLabel={media.captionsLabel ?? labels.demo}
          captionsDefault={media.captionsDefault ?? false}
          captionsDisplay="native"
          autoPlay={false}
          muted={media.muted ?? false}
          loop={media.loop ?? false}
          controls={media.controls ?? true}
          preload="none"
          className={cn('aspect-video w-full bg-black object-cover', mediaClassName)}
          prefersMp4AsPrimary={prefersMp4AsPrimary}
        />
      )}
    </div>
  );

  return (
    <>
      <div
        className={cn(
          'rounded-[1.55rem] border border-white/80 bg-white/94 p-3 shadow-[0_24px_70px_-46px_rgba(15,23,42,0.3)] backdrop-blur sm:p-4',
          className
        )}
      >
        {showMetaRow ? (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {showDemoBadge ? (
                <span className="inline-flex items-center rounded-full border border-sky-200/80 bg-sky-50/85 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/90">
                  {labels.demo}
                </span>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {media.durationLabel ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/95 px-3 py-1 text-[11px] font-medium text-slate-700">
                  <Clock3 className="h-3.5 w-3.5 text-slate-500" />
                  {media.durationLabel}
                </span>
              ) : null}
              {showCaptionsBadge && media.captionsSrc ? (
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white/95 px-3 py-1 text-[11px] font-semibold tracking-[0.14em] text-slate-700">
                  {labels.captions}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        {previewFrame}
      </div>

      {canExpandVideo ? (
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-h-[92vh] w-[min(92vw,1100px)] overflow-hidden border-sky-100 bg-white p-0 shadow-[0_32px_100px_-56px_rgba(15,23,42,0.48)]">
            <div className="border-b border-border/60 bg-white px-5 py-4 sm:px-6">
              <DialogTitle className="pr-8 text-base font-semibold tracking-tight text-slate-950 sm:text-lg">
                {dialogTitle ?? media.alt}
              </DialogTitle>
              <DialogDescription className="mt-1 pr-8 text-sm leading-6 text-slate-600">
                {dialogDescription ?? labels.modalDescription}
              </DialogDescription>
            </div>
            <div className="bg-white p-4 sm:p-6">
              <div className="overflow-hidden rounded-[1.4rem] border border-border/60 bg-slate-950">
                <PublicLandingVideo
                  src={media.src}
                  alt={media.alt}
                  poster={media.poster}
                  mp4FallbackSrc={media.mp4FallbackSrc}
                  captionsSrc={media.captionsSrc}
                  captionsLang={media.captionsLang ?? locale}
                  captionsLabel={media.captionsLabel ?? labels.demo}
                  captionsDefault={media.captionsDefault ?? false}
                  captionsDisplay="native"
                  autoPlay
                  muted
                  loop={false}
                  controls
                  preload="metadata"
                  className="aspect-video w-full bg-black object-cover"
                  prefersMp4AsPrimary={prefersMp4AsPrimary}
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
