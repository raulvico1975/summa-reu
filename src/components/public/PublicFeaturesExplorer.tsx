'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { PublicFeatureDemo } from '@/components/public/PublicFeatureDemo';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { PublicLandingHeroMedia } from '@/lib/public-landings';
import type { PublicLocale } from '@/lib/public-locale';
import { cn } from '@/lib/utils';

export interface PublicFeaturesExplorerItem {
  id: string;
  title: string;
  description: string;
  href?: string;
  ctaLabel?: string;
  media: PublicLandingHeroMedia;
  badgeLabel?: string;
}

export interface PublicFeaturesExplorerSection {
  id: string;
  label?: string;
  tabLabel?: string;
  title: string;
  description: string;
  items: PublicFeaturesExplorerItem[];
}

interface PublicFeaturesExplorerProps {
  locale: PublicLocale;
  sections: PublicFeaturesExplorerSection[];
  tabsAlign?: 'left' | 'center';
  showSectionIntro?: boolean;
  resetItemOnSectionChange?: boolean;
  layout?: 'balanced' | 'image-heavy';
  compactCards?: boolean;
  showItemBadges?: boolean;
}

export function PublicFeaturesExplorer({
  locale,
  sections,
  tabsAlign = 'left',
  showSectionIntro = true,
  resetItemOnSectionChange = false,
  layout = 'balanced',
  compactCards = false,
  showItemBadges = true,
}: PublicFeaturesExplorerProps) {
  const firstSectionId = sections[0]?.id ?? '';
  const [activeSectionId, setActiveSectionId] = useState(firstSectionId);
  const [activeItemBySection, setActiveItemBySection] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      sections.map((section) => [section.id, section.items[0]?.id ?? ''])
    )
  );

  useEffect(() => {
    if (!sections.some((section) => section.id === activeSectionId)) {
      setActiveSectionId(firstSectionId);
    }

    setActiveItemBySection((current) => {
      const next = { ...current };

      for (const section of sections) {
        const sectionItemIds = section.items.map((item) => item.id);
        if (!sectionItemIds.includes(next[section.id])) {
          next[section.id] = section.items[0]?.id ?? '';
        }
      }

      return next;
    });
  }, [activeSectionId, firstSectionId, sections]);

  const activeSection = useMemo(
    () => sections.find((section) => section.id === activeSectionId) ?? sections[0],
    [activeSectionId, sections]
  );

  const activeItem = useMemo(() => {
    if (!activeSection) {
      return null;
    }

    const activeItemId = activeItemBySection[activeSection.id];
    return (
      activeSection.items.find((item) => item.id === activeItemId) ??
      activeSection.items[0] ??
      null
    );
  }, [activeItemBySection, activeSection]);

  if (!activeSection || !activeItem) {
    return null;
  }

  return (
    <Tabs
      value={activeSectionId}
      onValueChange={(value) => {
        setActiveSectionId(value);

        if (!resetItemOnSectionChange) {
          return;
        }

        const section = sections.find((entry) => entry.id === value);
        const firstItemId = section?.items[0]?.id;

        if (!firstItemId) {
          return;
        }

        setActiveItemBySection((current) => ({
          ...current,
          [value]: firstItemId,
        }));
      }}
      className="space-y-8"
    >
      <div className="overflow-x-auto lg:overflow-visible">
        <TabsList
          className={cn(
            'flex h-auto min-w-max flex-nowrap gap-3 rounded-[1.8rem] bg-transparent p-0 lg:min-w-0 lg:w-full lg:flex-wrap',
            tabsAlign === 'center' ? 'justify-start lg:justify-center' : 'justify-start'
          )}
        >
          {sections.map((section) => (
            <TabsTrigger
              key={section.id}
              value={section.id}
              className="h-auto rounded-full border border-sky-100/80 bg-white/92 px-5 py-3 text-left text-[13px] font-medium leading-5 text-slate-600 shadow-[0_18px_44px_-42px_rgba(15,23,42,0.16)] transition-all hover:border-sky-200 hover:bg-sky-50/70 hover:text-slate-950 data-[state=active]:border-sky-300 data-[state=active]:bg-[linear-gradient(180deg,rgba(239,246,255,0.98),rgba(255,255,255,0.98))] data-[state=active]:text-[#133c8b] data-[state=active]:shadow-[0_22px_50px_-42px_rgba(37,99,235,0.2)] lg:text-sm"
            >
              {section.tabLabel ?? section.label ?? section.title}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {sections.map((section) => {
        const selectedItemId =
          activeItemBySection[section.id] || section.items[0]?.id || '';
        const selectedItem =
          section.items.find((item) => item.id === selectedItemId) ??
          section.items[0];

        if (!selectedItem) {
          return null;
        }

        return (
          <TabsContent key={section.id} value={section.id} className="mt-0">
            <div
              className={cn(
                'grid gap-8 lg:items-start',
                layout === 'image-heavy'
                  ? 'lg:grid-cols-[0.74fr_1.26fr] lg:gap-10'
                  : 'lg:grid-cols-[0.92fr_1.08fr]'
              )}
            >
              <div className={showSectionIntro ? 'space-y-6' : ''}>
                {showSectionIntro ? (
                  <div className="space-y-4">
                    {section.label ? (
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/85">
                        {section.label}
                      </p>
                    ) : null}
                    <h2 className="max-w-xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-[2.4rem]">
                      {section.title}
                    </h2>
                    <p className="max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
                      {section.description}
                    </p>
                  </div>
                ) : null}
                <Accordion
                  type="single"
                  value={selectedItemId}
                  onValueChange={(value) => {
                    if (!value) {
                      return;
                    }

                    setActiveItemBySection((current) => ({
                      ...current,
                      [section.id]: value,
                    }));
                  }}
                  className={compactCards ? 'space-y-2.5' : 'space-y-3'}
                >
                  {section.items.map((item) => {
                    const isActive = item.id === selectedItemId;

                    return (
                      <AccordionItem
                        key={item.id}
                        value={item.id}
                        className={cn(
                          compactCards
                            ? 'overflow-hidden rounded-[1.45rem] border border-slate-200/80 bg-white/92 px-4 shadow-[0_12px_30px_-32px_rgba(15,23,42,0.12)] transition-all'
                            : 'overflow-hidden rounded-[1.6rem] border border-slate-200/80 bg-white/92 px-5 shadow-[0_14px_36px_-34px_rgba(15,23,42,0.12)] transition-all',
                          isActive &&
                            'border-sky-200/90 bg-[linear-gradient(180deg,rgba(241,248,255,0.9),rgba(255,255,255,0.98))] shadow-[0_20px_48px_-40px_rgba(37,99,235,0.14)]'
                        )}
                      >
                        <AccordionTrigger
                          className={cn(
                            'text-left hover:no-underline',
                            compactCards ? 'gap-5 py-4' : 'gap-6 py-5'
                          )}
                        >
                          <div className="space-y-2">
                            {showItemBadges && item.badgeLabel ? (
                              <span className="inline-flex items-center rounded-full border border-slate-200/90 bg-slate-50/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                {item.badgeLabel}
                              </span>
                            ) : null}
                            <p
                              className={cn(
                                'font-semibold tracking-tight text-slate-950',
                                compactCards ? 'text-[1.02rem] leading-6' : 'text-lg'
                              )}
                            >
                              {item.title}
                            </p>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className={compactCards ? 'pb-4 pt-0' : 'pb-5 pt-0'}>
                          <p
                            className={cn(
                              'max-w-xl text-sm text-slate-600',
                              compactCards ? 'line-clamp-3 leading-6' : 'leading-6'
                            )}
                          >
                            {item.description}
                          </p>
                          {item.href && item.ctaLabel ? (
                            <Link
                              href={item.href}
                              className={cn(
                                'inline-flex items-center text-sm font-semibold text-primary',
                                compactCards ? 'mt-3' : 'mt-4'
                              )}
                            >
                              {item.ctaLabel}
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                          ) : null}
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </div>

              <div className="lg:sticky lg:top-24">
                <div
                  className={cn(
                    'rounded-[2rem] border shadow-[0_24px_60px_-48px_rgba(37,99,235,0.22)]',
                    layout === 'image-heavy'
                      ? 'border-sky-200/90 bg-[radial-gradient(circle_at_top_left,rgba(191,219,254,0.95),rgba(224,242,254,0.98)_42%,rgba(219,234,254,0.96)_100%)] p-3 sm:p-4 lg:min-h-[30rem]'
                      : 'border-sky-100/80 bg-[radial-gradient(circle_at_top_left,rgba(219,234,254,0.65),rgba(255,255,255,0.98)_52%,rgba(239,246,255,0.88)_100%)] p-4 sm:p-5'
                  )}
                >
                  <div>
                    <PublicFeatureDemo
                      locale={locale}
                      media={selectedItem.media}
                      className={cn(
                        'rounded-[1.7rem] shadow-[0_24px_56px_-44px_rgba(15,23,42,0.18)]',
                        layout === 'image-heavy'
                          ? 'border border-sky-100/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(239,246,255,0.92))] p-2 sm:p-3'
                          : 'border border-white/85 bg-white/92 p-3 sm:p-4'
                      )}
                      mediaClassName={cn(
                        'rounded-[1.25rem]',
                        layout === 'image-heavy' ? 'aspect-[16/10]' : ''
                      )}
                      showDemoBadge={false}
                      showCaptionsBadge={false}
                      expandOnPlay={false}
                      dialogTitle={selectedItem.title}
                      dialogDescription={selectedItem.description}
                    />
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
