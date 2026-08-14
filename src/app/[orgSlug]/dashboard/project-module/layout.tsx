// src/app/[orgSlug]/dashboard/project-module/layout.tsx
// Guard del Mòdul Projectes: lectura històrica preservada en downgrade.

'use client';

import { useCurrentOrganization } from '@/hooks/organization-provider';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePermissions } from '@/hooks/use-permissions';
import { useTranslations } from '@/i18n';
import { useEntitlements } from '@/hooks/use-entitlements';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ProjectModuleLayoutProps {
  children: React.ReactNode;
}

export default function ProjectModuleLayout({ children }: ProjectModuleLayoutProps) {
  const { organization } = useCurrentOrganization();
  const { tr } = useTranslations();
  const { canAccessProjectsArea } = usePermissions();
  const { canUseCapability } = useEntitlements();

  // Feature flag: Mòdul Projectes
  const isProjectModuleEnabled = organization?.features?.projectModule ?? false;
  const canReadHistoricalProjects = canUseCapability('projects.readHistorical', {
    userAllowed: canAccessProjectsArea,
  });
  const canMutateProjects = canUseCapability('projects.mutate', {
    operationalEnabled: isProjectModuleEnabled,
    userAllowed: canAccessProjectsArea,
  });

  if (!canReadHistoricalProjects) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>{tr('projectModule.capture.restrictedTitle', 'Accés restringit')}</CardTitle>
            <CardDescription>
              {tr('projectModule.layout.restrictedBody', 'No tens permisos per operar al mòdul de Projectes.')}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <>
      {!canMutateProjects && (
        <Alert className="mb-4">
          <AlertDescription>
            {tr('projectModule.layout.readOnlyBody', 'Mode de consulta: pots veure l’històric, però no crear, editar ni exportar dades del mòdul.')}
          </AlertDescription>
        </Alert>
      )}
      {children}
    </>
  );
}
