// src/lib/notifications.ts
// Sistema de novetats del producte (Product Updates Inbox)
// Persistència via localStorage per marcar com llegides

export type ProductUpdate = {
  id: string;
  title: string;
  body: string;
  href?: string; // ruta interna sense orgSlug
  ctaLabel?: string;
  createdAt: string; // YYYY-MM-DD
  locale?: 'ca' | 'es';
  locales?: Partial<Record<'es', {
    title?: string;
    body?: string;
    ctaLabel?: string;
    contentLong?: string;
  }>>;
};

export type RoadmapItem = {
  id: string;
  text: string;
};

/**
 * @deprecated Usar Firestore productUpdates. Fallback només.
 * Novetats del producte (màx 5-6 visibles)
 */
export const PRODUCT_UPDATES: ProductUpdate[] = [
  {
    id: 'bulk-categorize-2025-12-26',
    title: 'Categories en bloc',
    body: 'Ara pots seleccionar diversos moviments i assignar categories de cop.',
    href: '/dashboard/movimientos',
    ctaLabel: 'Veure com funciona',
    createdAt: '2025-12-26',
    locale: 'ca',
    locales: {
      es: {
        title: 'Categorías en bloque',
        body: 'Ahora puedes seleccionar varios movimientos y asignar categorías de una sola vez.',
        ctaLabel: 'Ver cómo funciona',
      },
    },
  },
];

// En què estem treballant (no compta per al badge)
export const ROADMAP_ITEMS: RoadmapItem[] = [
  { id: 'roadmap-donors-remittances', text: 'Identificació de donants a remeses' },
  { id: 'roadmap-fiscal-data', text: 'Dades fiscals pendents' },
  { id: 'roadmap-partial-returns', text: 'Devolucions parcials' },
];

// =============================================================================
// LEGACY SUPPORT (per compatibilitat amb codi existent)
// =============================================================================

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  href?: string;
  ctaLabel?: string;
  severity?: 'info' | 'success' | 'warning';
  createdAt: string;
  scope: 'dashboard';
};

// Converteix ProductUpdate a AppNotification per compatibilitat
export const DASHBOARD_NOTIFICATIONS: AppNotification[] = PRODUCT_UPDATES.map((u) => ({
  id: u.id,
  title: u.title,
  body: u.body,
  href: u.href,
  ctaLabel: u.ctaLabel,
  severity: 'info' as const,
  createdAt: u.createdAt,
  scope: 'dashboard' as const,
}));

// =============================================================================
// PERSISTENCE HELPERS
// =============================================================================

function getStorageKey(orgId: string, userId: string): string {
  return `ss.notifications.read.${orgId}.${userId}`;
}

function getToastShownKey(orgId: string, userId: string): string {
  return `ss.notifications.toastShown.${orgId}.${userId}`;
}

export function getReadNotificationIds(orgId: string, userId: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(getStorageKey(orgId, userId));
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function markNotificationRead(orgId: string, userId: string, notificationId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getReadNotificationIds(orgId, userId);
    if (!current.includes(notificationId)) {
      const updated = [...current, notificationId];
      localStorage.setItem(getStorageKey(orgId, userId), JSON.stringify(updated));
    }
  } catch {
    // ignore
  }
}

export function markAllNotificationsRead(orgId: string, userId: string, notificationIds: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getReadNotificationIds(orgId, userId);
    const updated = Array.from(new Set([...current, ...notificationIds]));
    localStorage.setItem(getStorageKey(orgId, userId), JSON.stringify(updated));
  } catch {
    // ignore
  }
}

export function hasShownToastThisSession(orgId: string, userId: string): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return sessionStorage.getItem(getToastShownKey(orgId, userId)) === '1';
  } catch {
    return true;
  }
}

export function setToastShownThisSession(orgId: string, userId: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(getToastShownKey(orgId, userId), '1');
  } catch {
    // ignore
  }
}

export function getUnreadNotifications(
  notifications: AppNotification[],
  orgId: string,
  userId: string
): AppNotification[] {
  const readIds = getReadNotificationIds(orgId, userId);
  return notifications.filter((n) => !readIds.includes(n.id));
}
