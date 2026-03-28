'use client';

import { useEffect, useRef, useState } from 'react';

type CaptionsDisplayMode = 'native' | 'overlay';

interface LandingCaptionCue {
  id: string;
  start: number;
  end: number;
  text: string;
}

interface PublicLandingVideoProps {
  src: string;
  alt: string;
  poster?: string;
  mp4FallbackSrc?: string;
  captionsSrc?: string;
  captionsLang?: string;
  captionsLabel?: string;
  captionsDefault?: boolean;
  captionsDisplay?: CaptionsDisplayMode;
  autoPlay: boolean;
  muted: boolean;
  loop: boolean;
  controls: boolean;
  preload: 'auto' | 'metadata';
  className: string;
  prefersMp4AsPrimary: boolean;
}

function parseVttTimestamp(value: string) {
  const normalized = value.trim().replace(',', '.');
  const parts = normalized.split(':');

  if (parts.length !== 3) {
    return null;
  }

  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  const seconds = Number(parts[2]);

  if (![hours, minutes, seconds].every(Number.isFinite)) {
    return null;
  }

  return hours * 3600 + minutes * 60 + seconds;
}

function parseWebVtt(content: string): LandingCaptionCue[] {
  return content
    .replace(/^\uFEFF/, '')
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .flatMap((block, index) => {
      const lines = block
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      if (lines.length === 0 || lines[0] === 'WEBVTT') {
        return [];
      }

      const timeLineIndex = lines.findIndex((line) => line.includes('-->'));
      if (timeLineIndex === -1) {
        return [];
      }

      const [rawStart, rawEnd] = lines[timeLineIndex].split('-->').map((part) => part.trim());
      const start = parseVttTimestamp(rawStart);
      const end = parseVttTimestamp(rawEnd);

      if (start === null || end === null || end <= start) {
        return [];
      }

      const text = lines.slice(timeLineIndex + 1).join('\n').trim();
      if (!text) {
        return [];
      }

      return [
        {
          id: `cue-${index + 1}`,
          start,
          end,
          text,
        },
      ];
    });
}

function findActiveCue(cues: LandingCaptionCue[], currentTime: number) {
  return cues.find((cue) => currentTime >= cue.start && currentTime < cue.end) ?? null;
}

export function PublicLandingVideo({
  src,
  alt,
  poster,
  mp4FallbackSrc,
  captionsSrc,
  captionsLang,
  captionsLabel,
  captionsDefault,
  captionsDisplay = 'native',
  autoPlay,
  muted,
  loop,
  controls,
  preload,
  className,
  prefersMp4AsPrimary,
}: PublicLandingVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cues, setCues] = useState<LandingCaptionCue[]>([]);
  const [activeCue, setActiveCue] = useState<LandingCaptionCue | null>(null);

  useEffect(() => {
    if (!captionsSrc || captionsDisplay !== 'overlay') {
      setCues([]);
      return;
    }

    let cancelled = false;

    fetch(captionsSrc)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`No s'han pogut carregar les captions: ${response.status}`);
        }
        return response.text();
      })
      .then((content) => {
        if (!cancelled) {
          setCues(parseWebVtt(content));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCues([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [captionsDisplay, captionsSrc]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || captionsDisplay !== 'overlay' || cues.length === 0) {
      setActiveCue(null);
      return;
    }

    const syncCue = () => {
      const nextCue = findActiveCue(cues, video.currentTime);
      setActiveCue((previousCue) => {
        if (previousCue?.id === nextCue?.id) {
          return previousCue;
        }
        return nextCue;
      });
    };

    syncCue();

    video.addEventListener('timeupdate', syncCue);
    video.addEventListener('seeked', syncCue);
    video.addEventListener('loadedmetadata', syncCue);
    video.addEventListener('ended', syncCue);

    return () => {
      video.removeEventListener('timeupdate', syncCue);
      video.removeEventListener('seeked', syncCue);
      video.removeEventListener('loadedmetadata', syncCue);
      video.removeEventListener('ended', syncCue);
    };
  }, [captionsDisplay, cues]);

  const shouldRenderOverlay = captionsDisplay === 'overlay' && cues.length > 0;

  return (
    <div className="relative">
      <video
        ref={videoRef}
        className={className}
        aria-label={alt}
        poster={poster}
        autoPlay={autoPlay}
        muted={muted}
        loop={loop}
        controls={controls}
        playsInline
        preload={preload}
      >
        <source src={src} type={prefersMp4AsPrimary ? 'video/mp4' : 'video/webm'} />
        {mp4FallbackSrc && mp4FallbackSrc !== src && <source src={mp4FallbackSrc} type="video/mp4" />}
        {captionsSrc && captionsDisplay === 'native' && (
          <track
            kind="subtitles"
            src={captionsSrc}
            srcLang={captionsLang}
            label={captionsLabel}
            default={captionsDefault}
          />
        )}
      </video>

      {shouldRenderOverlay ? (
        <>
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-slate-950/60 via-slate-950/16 to-transparent transition-opacity duration-300 ${
              activeCue ? 'opacity-100' : 'opacity-0'
            }`}
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-5 pb-16 sm:px-10 sm:pb-20 lg:pb-24">
            <p
              aria-hidden="true"
              data-demo-caption="landing-overlay"
              className={`max-w-[30ch] whitespace-pre-line text-center text-lg font-medium leading-tight tracking-[-0.02em] text-white transition-opacity duration-300 sm:text-[1.6rem] lg:text-[1.95rem] ${
                activeCue ? 'opacity-100' : 'opacity-0'
              }`}
              style={{
                textShadow:
                  '0 1px 2px rgba(2,6,23,0.72), 0 6px 18px rgba(2,6,23,0.28)',
              }}
            >
              {activeCue?.text ?? ''}
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
