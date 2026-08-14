// src/components/feature-flags-settings.tsx
// Component per gestionar els feature flags de l'organització

'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useCurrentOrganization } from '@/hooks/organization-provider';
import { useTranslations } from '@/i18n';
import { Puzzle, FolderKanban, FileStack } from 'lucide-react';

export function FeatureFlagsSettings() {
  const { organization } = useCurrentOrganization();
  const { tr } = useTranslations();

  // Feature flags actuals
  const isProjectModuleEnabled = organization?.features?.projectModule ?? false;
  const isPendingDocsEnabled = organization?.features?.pendingDocs ?? false;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Puzzle className="h-5 w-5" />
          {tr('settings.featureFlags.title', 'Mòduls opcionals')}
        </CardTitle>
        <CardDescription>
          {tr(
            'settings.featureFlags.description',
            'Estat dels mòduls contractats. Els canvis els gestiona Summa Social.'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mòdul Projectes */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-emerald-100 p-2">
              <FolderKanban className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Label htmlFor="project-module" className="text-base font-medium cursor-pointer">
                  {tr('settings.featureFlags.projectModule.label', 'Mòdul Projectes')}
                </Label>
                {isProjectModuleEnabled && (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                    {tr('settings.featureFlags.badges.active', 'Actiu')}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {tr(
                  'settings.featureFlags.projectModule.description',
                  'Gestió de pressupostos, imputació de despeses i justificació econòmica per projectes.'
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="project-module"
              checked={isProjectModuleEnabled}
              disabled
            />
          </div>
        </div>

        {/* Mòdul Documents Pendents */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-orange-100 p-2">
              <FileStack className="h-5 w-5 text-orange-600" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Label htmlFor="pending-docs" className="text-base font-medium cursor-pointer">
                  {tr('settings.featureFlags.pendingDocs.label', 'Documents pendents')}
                </Label>
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                  {tr('settings.featureFlags.badges.experimental', 'Experimental')}
                </Badge>
                {isPendingDocsEnabled && (
                  <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                    {tr('settings.featureFlags.badges.active', 'Actiu')}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {tr(
                  'settings.featureFlags.pendingDocs.description',
                  'Pujar factures i nòmines abans de tenir l\'extracte bancari. Es concilien automàticament quan arriba el moviment.'
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="pending-docs"
              checked={isPendingDocsEnabled}
              disabled
            />
          </div>
        </div>

        {/* Espai per futurs mòduls */}
        <p className="text-xs text-muted-foreground text-center pt-2">
          {tr('settings.featureFlags.comingSoon', 'Properament més mòduls disponibles.')}
        </p>
      </CardContent>
    </Card>
  );
}
