"use client";

import { getAnalytics, logEvent, isSupported } from "firebase/analytics";
import { clientFirebaseApp } from "@/src/lib/firebase/client";

let analyticsInstance: ReturnType<typeof getAnalytics> | null = null;
let initPromise: Promise<void> | null = null;

function init(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = isSupported().then((supported) => {
    if (supported) {
      analyticsInstance = getAnalytics(clientFirebaseApp);
    }
  });
  return initPromise;
}

export function trackEvent(name: string, params?: Record<string, string | number>) {
  if (typeof window === "undefined") return;
  init().then(() => {
    if (analyticsInstance) {
      logEvent(analyticsInstance, name, params);
    }
  }).catch(() => {});
}
