'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

type RotatingHeroPhraseProps = {
  items: string[];
  className?: string;
  itemClassName?: string;
  underlineClassName?: string;
  intervalMs?: number;
  transitionMs?: number;
};

export function RotatingHeroPhrase({
  items,
  className,
  itemClassName,
  underlineClassName,
  intervalMs = 2200,
  transitionMs = 460,
}: RotatingHeroPhraseProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [leavingIndex, setLeavingIndex] = useState<number | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const activeIndexRef = useRef(0);

  const longestItem = useMemo(
    () => items.reduce((longest, item) => (item.length > longest.length ? item : longest), items[0] ?? ''),
    [items]
  );

  useEffect(() => {
    activeIndexRef.current = 0;
    setActiveIndex(0);
    setLeavingIndex(null);
  }, [items]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = () => setPrefersReducedMotion(mediaQuery.matches);

    handleChange();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    if (items.length < 2 || prefersReducedMotion) {
      return;
    }

    const intervalId = window.setInterval(() => {
      const currentIndex = activeIndexRef.current;
      const nextIndex = (currentIndex + 1) % items.length;

      setLeavingIndex(currentIndex);
      activeIndexRef.current = nextIndex;
      setActiveIndex(nextIndex);
    }, intervalMs);

    return () => window.clearInterval(intervalId);
  }, [intervalMs, items.length, prefersReducedMotion]);

  useEffect(() => {
    if (leavingIndex === null) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setLeavingIndex(null);
    }, transitionMs);

    return () => window.clearTimeout(timeoutId);
  }, [leavingIndex, transitionMs]);

  if (items.length === 0) {
    return null;
  }

  const currentItem = items[activeIndex] ?? '';

  return (
    <span className={cn('relative inline-grid px-1 align-baseline', className)}>
      <span className="sr-only">{currentItem}</span>
      <span aria-hidden="true" className="invisible col-start-1 row-start-1 whitespace-nowrap">
        {longestItem}
      </span>
      <span aria-hidden="true" className="relative col-start-1 row-start-1 inline-grid overflow-hidden whitespace-nowrap">
        {items.map((item, index) => {
          const isActive = index === activeIndex;
          const isLeaving = index === leavingIndex;

          return (
            <span
              key={`${item}-${index}`}
              className={cn(
                'relative z-10 col-start-1 row-start-1 whitespace-nowrap transition-[transform,opacity] duration-500 ease-out',
                isActive
                  ? 'translate-y-0 opacity-100'
                  : isLeaving
                    ? '-translate-y-[0.7em] opacity-0'
                    : 'translate-y-[0.7em] opacity-0',
                itemClassName
              )}
            >
              {item}
            </span>
          );
        })}
        <span className="pointer-events-none absolute inset-0 z-0">
          <span className="summa-hero-focus-wash absolute left-[4%] top-[0.04em] h-[0.92em] w-[84%] rounded-[999px]" />
        </span>
        <span className="pointer-events-none absolute inset-x-0 bottom-[-0.04em] z-0 h-[0.38em]">
          <span className="absolute left-[3%] right-[1%] bottom-[0.04em] h-[0.28em] rounded-full bg-sky-100/50 blur-[6px]" />
          <svg
            viewBox="0 0 240 34"
            className={cn(
              'absolute inset-x-0 bottom-0 h-full w-full overflow-visible',
              underlineClassName
            )}
            preserveAspectRatio="none"
          >
            <path
              d="M6 21C44 23 86 23 126 19C164 15 198 12 236 14"
              className="summa-hero-underline-path"
              pathLength={1}
            />
            <path
              d="M18 24C66 26 122 26 178 21C202 19 220 18 236 18"
              className="summa-hero-underline-path summa-hero-underline-path-secondary"
              pathLength={1}
            />
          </svg>
        </span>
      </span>
    </span>
  );
}
