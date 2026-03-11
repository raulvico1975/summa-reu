import type { I18nCa } from "@/src/i18n/ca";

export const esCoreSections = [
  "appName",
  "nav",
  "session",
  "status",
  "home",
  "login",
  "signup",
  "errors",
] as const;

export type I18nSection = keyof I18nCa;

export const noFallbackRouteRules: Array<{ pattern: RegExp; sections: I18nSection[] }> = [
  { pattern: /^\/$/, sections: ["home", "nav", "session"] },
  { pattern: /^\/login\/?$/, sections: ["login", "nav", "errors"] },
  { pattern: /^\/signup\/?$/, sections: ["signup", "nav", "errors"] },
  { pattern: /^\/dashboard\/?$/, sections: ["dashboard", "status", "nav", "session", "errors"] },
  { pattern: /^\/polls\/new\/?$/, sections: ["poll", "meeting", "nav", "session", "errors"] },
  { pattern: /^\/polls\/[^/]+\/?$/, sections: ["poll", "status", "nav", "session", "errors"] },
  { pattern: /^\/meetings\/[^/]+\/?$/, sections: ["meeting", "status", "nav", "session", "errors"] },
  { pattern: /^\/p\/[^/]+\/?$/, sections: ["poll", "status", "errors"] },
  { pattern: /^\/p\/[^/]+\/results\/?$/, sections: ["poll", "status", "errors"] },
];
