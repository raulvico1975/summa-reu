import { ca } from "@/src/i18n/ca";
import { es } from "@/src/i18n/es";

export const i18n = {
  ca,
  es,
} as const;

export type I18nLocale = keyof typeof i18n;
export const defaultLocale: I18nLocale = "ca";
