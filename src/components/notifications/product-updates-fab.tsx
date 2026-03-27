// src/components/notifications/product-updates-fab.tsx
// FAB (Floating Action Button) per Novetats a Summa
// FAB flotant

'use client';

import * as React from 'react';
import Link from 'next/link';
import { Inbox, Check, CheckCheck, ChevronRight, Sparkles, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useOrgUrl, useCurrentOrganization } from '@/hooks/organization-provider';
import { useAuth } from '@/hooks/use-auth';
import { useTranslations } from '@/i18n';
import { useProductUpdates, type FirestoreProductUpdate } from '@/hooks/use-product-updates';
import { SUPER_ADMIN_UID } from '@/lib/data';
import { ProductUpdateDetailModal } from './product-update-detail-modal';
import {
  getReadNotificationIds,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/lib/notifications';

export function ProductUpdatesFab() {
  const { organizationId } = useCurrentOrganization();
  const { user } = useAuth();
  const { buildUrl } = useOrgUrl();
  const { t, language } = useTranslations();

  // Carregar updates de Firestore amb fallback (hook centralitzat)
  const { updates, usingFallback, error } = useProductUpdates(language);

  // Detectar SuperAdmin per mostrar indicador de font
  const isSuperAdmin = user?.uid === SUPER_ADMIN_UID;

  const [readIds, setReadIds] = React.useState<string[]>([]);
  const [isOpen, setIsOpen] = React.useState(false);

  // Modal detall
  const [selectedUpdate, setSelectedUpdate] = React.useState<FirestoreProductUpdate | null>(null);
  const [isDetailOpen, setIsDetailOpen] = React.useState(false);

  const handleOpenDetail = (update: FirestoreProductUpdate) => {
    setSelectedUpdate(update);
    setIsDetailOpen(true);
    setIsOpen(false); // Tancar panel
  };

  // Carregar readIds al muntar
  React.useEffect(() => {
    if (organizationId && user?.uid) {
      setReadIds(getReadNotificationIds(organizationId, user.uid));
    }
  }, [organizationId, user?.uid]);

  // Només els updates compten per al badge
  const unreadUpdates = React.useMemo(
    () => updates.filter((u) => !readIds.includes(u.id)),
    [updates, readIds]
  );

  const unreadCount = unreadUpdates.length;

  const handleMarkRead = React.useCallback(
    (updateId: string) => {
      if (!organizationId || !user?.uid) return;
      markNotificationRead(organizationId, user.uid, updateId);
      setReadIds((prev) => [...prev, updateId]);
    },
    [organizationId, user?.uid]
  );

  const handleMarkAllRead = React.useCallback(() => {
    if (!organizationId || !user?.uid) return;
    const allIds = updates.map((u) => u.id);
    markAllNotificationsRead(organizationId, user.uid, allIds);
    setReadIds((prev) => [...new Set([...prev, ...allIds])]);
  }, [organizationId, user?.uid, updates]);

  const isRead = (id: string) => readIds.includes(id);

  // Si no hi ha cap update, no mostrar res
  if (updates.length === 0) return null;

  // FAB obert: panel complet
  return (
    <>
      {/* FAB tancat: només el botó flotant */}
      {!isOpen && (
        <Button
          className="h-14 w-14 rounded-full shadow-lg bg-sky-600 hover:bg-sky-700 text-white relative"
          onClick={() => setIsOpen(true)}
          aria-label={t.productUpdates.tooltip({ count: unreadCount })}
        >
          <Inbox className="h-6 w-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1.5 text-xs font-bold rounded-full bg-white text-sky-700 flex items-center justify-center shadow-sm">
              {unreadCount}
            </span>
          )}
        </Button>
      )}

      {/* FAB obert: panel complet */}
      {isOpen && (
        <Card className="w-full max-w-lg shadow-2xl">
        <CardHeader className="flex flex-row items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-lg">{t.productUpdates.inboxTitle}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleMarkAllRead}
                title={t.productUpdates.markAllRead}
              >
                <CheckCheck className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-64 p-4 pt-0">
            {updates.length > 0 ? (
              <div className="space-y-2">
                {updates.slice(0, 6).map((update) => {
                  const read = isRead(update.id);
                  return (
                    <div
                      key={update.id}
                      className={`p-3 rounded-md transition-colors cursor-pointer hover:bg-muted/50 ${read ? 'opacity-60' : ''}`}
                      onClick={() => handleOpenDetail(update)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && handleOpenDetail(update)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm leading-snug ${read ? 'font-normal' : 'font-medium'}`}>
                            {update.title}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {update.body}
                          </p>
                          {update.href && (
                            <Link
                              href={buildUrl(update.href)}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkRead(update.id);
                                setIsOpen(false);
                              }}
                              className="inline-flex items-center text-xs text-primary hover:underline mt-2"
                            >
                              {update.ctaLabel ?? t.productUpdates.openUpdate}
                            </Link>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0 mt-0.5">
                          {read ? (
                            <Check className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                {t.productUpdates.noUpdates}
              </div>
            )}
          </ScrollArea>

          {/* SuperAdmin: Indicador de font de dades (debug) */}
          {isSuperAdmin && (
            <div className={`px-4 py-1.5 border-t text-xs ${
              usingFallback
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-muted-foreground'
            }`}>
              Source: {usingFallback ? '⚠️ Legacy' : 'Firestore'}
              {error && ` · ${error.message.slice(0, 40)}`}
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* Modal detall - FORA del condicional isOpen perquè es mantingui */}
      <ProductUpdateDetailModal
        update={selectedUpdate}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
      />
    </>
  );
}
