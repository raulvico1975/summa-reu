import type { I18nCa } from "@/src/i18n/ca";
import { ca } from "@/src/i18n/ca";
import type { I18nLocale } from "@/src/i18n/config";
import { getLocaleOverlay } from "@/src/i18n/index";
import type { I18nSection } from "@/src/i18n/quality";
import { noFallbackRouteRules } from "@/src/i18n/quality";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasCompleteCoverage(base: unknown, candidate: unknown): boolean {
  if (Array.isArray(base)) {
    return Array.isArray(candidate);
  }

  if (isPlainObject(base)) {
    if (!isPlainObject(candidate)) return false;
    return Object.keys(base).every((key) =>
      hasCompleteCoverage((base as Record<string, unknown>)[key], candidate[key])
    );
  }

  return candidate !== undefined;
}

export function isSectionComplete(locale: I18nLocale, section: I18nSection): boolean {
  if (locale === "ca") return true;
  const overlay = getLocaleOverlay(locale) as Record<string, unknown>;
  return hasCompleteCoverage((ca as unknown as Record<string, unknown>)[section], overlay[section]);
}

export function areSectionsComplete(locale: I18nLocale, sections: I18nSection[]): boolean {
  return sections.every((section) => isSectionComplete(locale, section));
}

export function getNoFallbackSectionsForPath(pathname: string): I18nSection[] | null {
  const matched = noFallbackRouteRules.find((rule) => rule.pattern.test(pathname));
  return matched ? matched.sections : null;
}

export function getMissingKeysForSections(locale: I18nLocale, sections: I18nSection[]): string[] {
  if (locale === "ca") return [];
  const overlay = getLocaleOverlay(locale) as Record<string, unknown>;
  const result: string[] = [];

  function walk(base: unknown, candidate: unknown, path: string) {
    if (Array.isArray(base)) {
      if (!Array.isArray(candidate)) result.push(path);
      return;
    }

    if (isPlainObject(base)) {
      if (!isPlainObject(candidate)) {
        result.push(path);
        return;
      }

      for (const key of Object.keys(base)) {
        const nextPath = path ? `${path}.${key}` : key;
        walk((base as Record<string, unknown>)[key], candidate[key], nextPath);
      }
      return;
    }

    if (candidate === undefined) {
      result.push(path);
    }
  }

  for (const section of sections) {
    walk(
      (ca as unknown as Record<string, unknown>)[section],
      overlay[section],
      section as keyof I18nCa as string
    );
  }

  return result;
}
