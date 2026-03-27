// src/components/notifications/product-update-detail-modal.tsx
// Modal per veure detall d'una novetat del producte

'use client';

import * as React from 'react';
import { ExternalLink, BookOpen, Play } from 'lucide-react';
import Link from 'next/link';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useOrgUrl } from '@/hooks/organization-provider';
import { useTranslations } from '@/i18n';
import { renderStructuredText } from '@/lib/render-structured-text';
import type { FirestoreProductUpdate } from '@/hooks/use-product-updates';

interface ProductUpdateDetailModalProps {
  update: FirestoreProductUpdate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductUpdateDetailModal({
  update,
  open,
  onOpenChange,
}: ProductUpdateDetailModalProps) {
  const { buildUrl } = useOrgUrl();
  const { t } = useTranslations();

  if (!update) return null;

  const hasContentLong = update.contentLong && update.contentLong.trim().length > 0;
  const hasGuideUrl = update.guideUrl && update.guideUrl.trim().length > 0;
  const hasVideoUrl = update.videoUrl && update.videoUrl.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{update.title}</DialogTitle>
          <DialogDescription>{update.body}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Contingut llarg (text pla estructurat) */}
          {hasContentLong && (
            <div className="text-sm text-muted-foreground">
              {renderStructuredText(update.contentLong)}
            </div>
          )}

          {/* Links a guia i vídeo */}
          {(hasGuideUrl || hasVideoUrl) && (
            <div className="flex flex-wrap gap-2 pt-2">
              {hasGuideUrl && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={buildUrl(update.guideUrl!)} onClick={() => onOpenChange(false)}>
                    <BookOpen className="h-4 w-4 mr-2" />
                    {t.productUpdates.viewGuide}
                  </Link>
                </Button>
              )}
              {hasVideoUrl && (
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={update.videoUrl!}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    {t.productUpdates.viewVideo}
                  </a>
                </Button>
              )}
            </div>
          )}

          {/* CTA principal si existeix */}
          {update.href && (
            <div className="pt-2 border-t">
              <Button asChild className="w-full">
                <Link href={buildUrl(update.href)} onClick={() => onOpenChange(false)}>
                  {update.ctaLabel ?? t.productUpdates.openUpdate}
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
