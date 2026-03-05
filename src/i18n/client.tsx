"use client";

import { createContext, useContext } from "react";
import type { I18nCa } from "@/src/i18n/ca";
import type { I18nLocale } from "@/src/i18n/config";

type I18nContextValue = {
  locale: I18nLocale;
  i18n: I18nCa;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  children,
  locale,
  i18n,
}: {
  children: React.ReactNode;
  locale: I18nLocale;
  i18n: I18nCa;
}) {
  return <I18nContext.Provider value={{ locale, i18n }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error("I18nProvider missing in React tree");
  }

  return value;
}
