'use client';

/**
 * Pàgina de detall d'una liquidació de despeses.
 *
 * Reutilitza el component ExpenseReportDetail existent que ja té:
 * - Edició de capçalera (títol, dates, beneficiari, notes)
 * - Gestió de tiquets (afegir/treure)
 * - Quilometratge
 * - Generació de PDF
 * - (SEPA - fora d'abast d'aquest PAS)
 *
 * @see PAS 3 de la implementació de liquidacions
 */

import * as React from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { doc, onSnapshot } from 'firebase/firestore';
import { useCurrentOrganization, useOrgUrl } from '@/hooks/organization-provider';
import { useFirebase } from '@/firebase';
import { useTranslations } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { ExpenseReportDetail } from '@/components/expense-reports/expense-report-detail';
import { expenseReportRef, type ExpenseReport } from '@/lib/expense-reports';
import { useProjectCommercialAccess } from '@/hooks/use-project-module';
import { useEntitlements } from '@/hooks/use-entitlements';
import { usePermissions } from '@/hooks/use-permissions';

export default function LiquidacioDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { organizationId, organization } = useCurrentOrganization();
  const { firestore } = useFirebase();
  const { buildUrl } = useOrgUrl();
  const { t, tr } = useTranslations();
  const { canMutateProjects } = useProjectCommercialAccess();
  const { canUseCapability } = useEntitlements();
  const { can } = usePermissions();
  const canReadHistorical = canUseCapability('projects.readHistorical', {
    userAllowed: can('sections.moviments') && can('moviments.editar'),
  });
  const canUseOcr = canUseCapability('pendingDocuments.ocr', {
    operationalEnabled: organization?.features?.pendingDocs === true,
    userAllowed: can('sections.moviments') && can('moviments.editar'),
  });

  const reportId = params.id as string;
  const initialTab = searchParams.get('tab'); // 'kilometratge' o null

  // Estat
  const [report, setReport] = React.useState<ExpenseReport | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Subscripció al document
  React.useEffect(() => {
    if (!organizationId || !firestore || !reportId || !canReadHistorical) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const docRef = expenseReportRef(firestore, organizationId, reportId);

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setReport({ ...snapshot.data(), id: snapshot.id } as ExpenseReport);
        } else {
          setError(tr('expenseReports.notFound', 'Liquidació no trobada'));
          setReport(null);
        }
        setIsLoading(false);
      },
      (err) => {
        console.error('[LiquidacioDetailPage] Error:', err);
        setError(tr('expenseReports.loadError', 'Error carregant la liquidació'));
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [organizationId, firestore, reportId, tr, canReadHistorical]);

  // Handler per tancar (tornar al llistat)
  const handleClose = () => {
    router.push(buildUrl('/dashboard/movimientos/liquidacions'));
  };

  // Loading
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  // Error
  if (error || !report) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href={buildUrl('/dashboard/movimientos/liquidacions')}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold font-headline">{t.common.error}</h1>
        </div>
        <div className="text-center py-12">
          <p className="text-muted-foreground">{error || tr('expenseReports.notFound', 'Liquidació no trobada')}</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.push(buildUrl('/dashboard/movimientos/liquidacions'))}
          >
            {tr('expenseReports.backToList', 'Tornar al llistat')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={buildUrl('/dashboard/movimientos/liquidacions')}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold font-headline">
            {report.title || t.expenseReports.empty.noTitle}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t.expenseReports.title}
          </p>
        </div>
      </div>

      {/* Detall */}
      <ExpenseReportDetail
        report={report}
        onClose={handleClose}
        canOperate={canMutateProjects && can('sections.moviments') && can('moviments.editar')}
        canUseOcr={canUseOcr}
        scrollToSection={initialTab === 'kilometratge' ? 'kilometratge' : undefined}
      />
    </div>
  );
}
