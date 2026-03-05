// src/app/[orgSlug]/quick-expense/page.tsx
// Captura ultra-ràpida de despeses (<10s): foto + import + guardar
// Rols permesos: admin, user. Viewer: bloquejat amb missatge.

'use client';

import { QuickExpenseScreen } from '@/components/project-module/quick-expense-screen';
import { useCurrentOrganization } from '@/hooks/organization-provider';
import { AlertCircle } from 'lucide-react';
import { useTranslations } from '@/i18n';
import { usePermissions } from '@/hooks/use-permissions';

export default function QuickExpensePage() {
  const { organizationId, userRole } = useCurrentOrganization();
  const { t } = useTranslations();
  const { canAccessProjectsArea } = usePermissions();

  const q = t.projectModule?.quickExpense;

  // Bloquejar usuaris sense capacitat de projectes
  if (userRole === 'viewer' || !canAccessProjectsArea) {
    return (
      <div className="flex h-[100dvh] items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <AlertCircle className="h-12 w-12 text-muted-foreground" />
          <p className="font-semibold text-lg">
            {q?.noPermission ?? 'No tens permís'}
          </p>
          <p className="text-muted-foreground text-sm">
            {q?.noPermissionBody ?? "Demana accés a l'administració de l'entitat."}
          </p>
        </div>
      </div>
    );
  }

  // Validar organització
  if (!organizationId) {
    return (
      <div className="flex h-[100dvh] items-center justify-center p-4">
        <div className="animate-pulse text-muted-foreground">Carregant...</div>
      </div>
    );
  }

  return <QuickExpenseScreen organizationId={organizationId} isLandingMode />;
}
