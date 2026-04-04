'use client';

import { CategoryManager } from '@/components/category-manager';
import { OrganizationSettings } from '@/components/organization-settings';
import { LanguageSelector } from '@/components/language-selector';
import { MembersManager } from '@/components/members-manager';
import { FeatureFlagsSettings } from '@/components/feature-flags-settings';
import { BankAccountsManager } from '@/components/bank-accounts/bank-accounts-manager';
import { BackupsSettings } from '@/components/backups-settings';
import { DangerZone } from '@/components/danger-zone';
import { useCurrentOrganization, useOrgUrl } from '@/hooks/organization-provider';
import { useTranslations } from '@/i18n';
import { useFirebase } from '@/firebase';
import { SUPER_ADMIN_UID } from '@/lib/data';
import { isAllowlistedSuperAdmin } from '@/lib/admin/superadmin-allowlist';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Info } from 'lucide-react';

export default function SettingsPage() {
  const { userRole } = useCurrentOrganization();
  const { t } = useTranslations();
  const { user } = useFirebase();
  const { buildUrl } = useOrgUrl();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Detectar si venim de l'onboarding
  const isOnboarding = searchParams.get('onboarding') === '1';
  const returnUrl = searchParams.get('return') || buildUrl('/dashboard');

  // Només admins poden gestionar l'organització, categories i membres
  const canManageOrganization = userRole === 'admin';
  const canManageCategories = userRole === 'admin';
  const canManageMembers = userRole === 'admin';
  const canManageFeatures = userRole === 'admin';

  // Només SuperAdmin pot veure la Zona de Perill i Backups
  // Usem allowlist d'emails (més robust que UID hardcoded)
  const isSuperAdmin = user?.uid === SUPER_ADMIN_UID || isAllowlistedSuperAdmin(user?.email);

  // Handler per tornar a l'onboarding
  const handleReturnToOnboarding = () => {
    router.push(returnUrl);
  };

  return (
    <div className="space-y-6">
      {/* Banner d'onboarding (si venim del wizard) */}
      {isOnboarding && (
        <div className="flex items-center justify-between gap-4 p-4 rounded-lg border border-blue-200 bg-blue-50/50">
          <div className="flex items-center gap-3">
            <Info className="h-5 w-5 text-blue-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-900">
                {(t.onboarding as any)?.settingsBanner?.title ?? "Configuració inicial"}
              </p>
              <p className="text-xs text-blue-700">
                {(t.onboarding as any)?.settingsBanner?.description ?? "Completa aquest pas i torna a l'assistent."}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReturnToOnboarding}
            className="border-blue-300 text-blue-700 hover:bg-blue-100 flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {(t.onboarding as any)?.settingsBanner?.returnButton ?? "Tornar"}
          </Button>
        </div>
      )}

      {/* Títol de la pàgina */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-headline">{t.settings.title}</h1>
        <p className="text-muted-foreground">{t.settings.description}</p>
      </div>

      {/* Configuració d'usuari: Idioma i Contrasenya */}
      <div>
        <h2 className="text-lg font-semibold mb-4">{t.settings.userSettingsTitle}</h2>
        <div className="grid grid-cols-1 gap-6">
          <LanguageSelector />
        </div>
      </div>

      {/* Gestió de membres (només admins) */}
      {canManageMembers && <MembersManager />}

      {/* Backups - només SuperAdmin (els admins normals no veuen res) */}
      {isSuperAdmin && <BackupsSettings />}

      {/* Zona de Perill - només SuperAdmin */}
      {isSuperAdmin && <DangerZone />}

      {/* Configuració de l'organització */}
      <div>
        <h2 className="text-lg font-semibold mb-4">{t.settings.organizationSettingsTitle}</h2>

        {canManageOrganization ? (
          <OrganizationSettings />
        ) : (
          <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
            {t.settings.permissionDenied}
          </div>
        )}

        {/* Gestió de categories */}
        <div className="mt-6">
          {canManageCategories ? (
            <CategoryManager />
          ) : (
            <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
              {t.settings.permissionDenied}
            </div>
          )}
        </div>

        {/* Gestió de comptes bancaris (només admins) */}
        {canManageOrganization && (
          <div className="mt-6">
            <BankAccountsManager />
          </div>
        )}

        {/* Mòduls opcionals (només admins) - al final de tot */}
        {canManageFeatures && (
          <div className="mt-6">
            <FeatureFlagsSettings />
          </div>
        )}
      </div>
    </div>
  );
}
