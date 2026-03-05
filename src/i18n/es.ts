import type { DeepPartial, I18nCa } from "@/src/i18n/ca";
import { esCore } from "@/src/i18n/es.core";
import { esExtra } from "@/src/i18n/es.extra";

export const es: DeepPartial<I18nCa> = {
  ...esCore,
  ...esExtra,
};
