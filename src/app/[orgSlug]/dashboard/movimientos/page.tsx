'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { TransactionsTable } from '@/components/transactions-table';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Transaction, Category } from '@/lib/data';
import { useTranslations } from '@/i18n';
import { useCurrentOrganization } from '@/hooks/organization-provider';
import { useSearchParams } from 'next/navigation';
import { fromPeriodQuery } from '@/lib/period-query';
import { Button } from '@/components/ui/button';
import { FileStack, Receipt } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import type { PendingDocument } from '@/lib/pending-documents';
import type { ExpenseReport } from '@/lib/expense-reports';
import { usePermissions } from '@/hooks/use-permissions';

const TransactionImporter = dynamic(
  () => import('@/components/transaction-importer').then((mod) => mod.TransactionImporter),
  { ssr: false },
);

export default function MovimientosPage() {
  const { firestore } = useFirebase();
  const { organizationId, organization } = useCurrentOrganization();
  const { can } = usePermissions();
  const { t } = useTranslations();
  const searchParams = useSearchParams();
  const initialPeriodFilter = React.useMemo(() => {
    const fiscalParam = searchParams.get('fiscal');
    const yearParam = searchParams.get('year');
    const parsedYear = Number.parseInt(yearParam ?? '', 10);

    if (fiscalParam === 'pending' && Number.isInteger(parsedYear)) {
      return {
        type: 'custom' as const,
        customRange: {
          from: new Date(Date.UTC(parsedYear, 0, 1)),
          to: new Date(Date.UTC(parsedYear, 11, 31)),
        },
      };
    }

    return fromPeriodQuery(searchParams);
  }, [searchParams]);
  const initialFiscalFilter = React.useMemo(
    () => (searchParams.get('fiscal') === 'pending' ? 'pending' : null),
    [searchParams]
  );
  const initialDemoAction = React.useMemo(() => {
    const type = searchParams.get('demoAction');
    const txId = searchParams.get('demoTx')?.trim();

    if (!txId) return null;
    if (type === 'split' || type === 'detail') {
      return { type: type as 'split' | 'detail', txId };
    }

    return null;
  }, [searchParams]);
  const canImportExtracts = can('moviments.importarExtractes');
  const canEditMovements = can('moviments.editar');

  // Feature flag: Documents pendents
  const isPendingDocsEnabled = organization?.features?.pendingDocs ?? false;

  const transactionsQuery = useMemoFirebase(
    () => organizationId ? collection(firestore, 'organizations', organizationId, 'transactions') : null,
    [firestore, organizationId]
  );
  const { data: transactions, isLoading } = useCollection<Transaction>(transactionsQuery);

  const categoriesQuery = useMemoFirebase(
    () => organizationId ? collection(firestore, 'organizations', organizationId, 'categories') : null,
    [firestore, organizationId]
  );
  const { data: categories } = useCollection<Category>(categoriesQuery);

  const pendingActionsQuery = useMemoFirebase(
    () => {
      if (!organizationId || !isPendingDocsEnabled) return null;
      return query(
        collection(firestore, 'organizations', organizationId, 'pendingDocuments'),
        where('status', 'in', ['draft', 'confirmed', 'sepa_generated'])
      );
    },
    [firestore, organizationId, isPendingDocsEnabled]
  );
  const { data: pendingActions } = useCollection<PendingDocument>(pendingActionsQuery);
  const pendingActionsCount = pendingActions?.length ?? 0;

  const submittedSettlementsQuery = useMemoFirebase(
    () => {
      if (!organizationId || !isPendingDocsEnabled) return null;
      return query(
        collection(firestore, 'organizations', organizationId, 'expenseReports'),
        where('status', '==', 'submitted')
      );
    },
    [firestore, organizationId, isPendingDocsEnabled]
  );
  const { data: submittedSettlements } = useCollection<ExpenseReport>(submittedSettlementsQuery);
  const submittedSettlementsCount = submittedSettlements?.length ?? 0;

  return (
    <div className="w-full flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-headline">{t.movements.title}</h1>
          <p className="text-muted-foreground">{t.movements.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canImportExtracts && <TransactionImporter availableCategories={categories} />}
          {isPendingDocsEnabled && (
            <>
              <Button variant="outline" asChild>
                <Link href="movimientos/pendents">
                  <FileStack className="mr-2 h-4 w-4" />
                  {t.movements.buttons.pendingDocs}
                  {pendingActionsCount > 0 && (
                    <Badge variant="secondary" className="ml-2 h-5 min-w-5 rounded-full px-1.5 text-[11px] tabular-nums">
                      {pendingActionsCount}
                    </Badge>
                  )}
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="movimientos/liquidacions">
                  <Receipt className="mr-2 h-4 w-4" />
                  {t.movements.buttons.settlements}
                  {submittedSettlementsCount > 0 && (
                    <Badge variant="secondary" className="ml-2 h-5 min-w-5 rounded-full px-1.5 text-[11px] tabular-nums">
                      {submittedSettlementsCount}
                    </Badge>
                  )}
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>

      {isLoading ? (
        <p>{t.common.loading}</p>
      ) : (
        <div className="w-full">
          <TransactionsTable
            initialDateFilter={initialPeriodFilter ?? undefined}
            initialFiscalFilter={initialFiscalFilter}
            initialDemoAction={initialDemoAction}
            canEditMovements={canEditMovements}
          />
        </div>
      )}
    </div>
  );
}
