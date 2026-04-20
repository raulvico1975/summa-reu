'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X, ExternalLink, Calendar, Coins, User, AlertCircle, RefreshCw, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { formatCurrencyEU } from '@/lib/normalize';
import { getCategoryDisplayLabel } from '@/lib/ui/display-labels';
import { useTranslations } from '@/i18n';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, writeBatch, updateDoc, getDocs } from 'firebase/firestore';
import { useOrgUrl } from '@/hooks/organization-provider';
import { useToast } from '@/hooks/use-toast';
import type { Transaction, AnyContact, Category, Donor, RemittancePendingItem } from '@/lib/data';

interface RemittanceDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  remittanceId: string | null;
  organizationId: string;
  parentTransaction?: Transaction | null;
  onReprocessComplete?: () => void;
}

// Tipus per la resposta del check
interface ConsistencyCheckResult {
  consistent: boolean;
  issues: string[];
  details?: {
    expectedCount?: number;
    activeCount?: number;
    parentAmountCents?: number;
    childrenSumCents?: number;
    deltaCents?: number;
  };
  /** Si true, el check s'ha saltat perquè no aplica (ex: remesa OUT) */
  skipped?: boolean;
  /** Motiu pel qual s'ha saltat el check */
  skipReason?: 'OUT_REMITTANCE';
}

// Component per mostrar el resum del donant al hover
function DonorHoverSummary({
  donor,
  transactions,
  t,
}: {
  donor: Donor;
  transactions: Transaction[];
  t: any;
}) {
  const currentYear = new Date().getFullYear();

  // Calcular total donat aquest any
  const totalThisYear = React.useMemo(() => {
    return transactions
      .filter(tx => {
        const txYear = new Date(tx.date).getFullYear();
        return txYear === currentYear && tx.contactId === donor.id && tx.amount > 0;
      })
      .reduce((sum, tx) => sum + tx.amount, 0);
  }, [transactions, donor.id, currentYear]);

  // Comptar donacions totals
  const totalDonations = React.useMemo(() => {
    return transactions.filter(tx => tx.contactId === donor.id && tx.amount > 0).length;
  }, [transactions, donor.id]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <User className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{donor.name}</span>
      </div>
      {donor.taxId && (
        <div className="text-sm text-muted-foreground">
          DNI/CIF: {donor.taxId}
        </div>
      )}
      <div className="border-t pt-2 space-y-1">
        <div className="flex items-center gap-2 text-sm">
          <Coins className="h-3 w-3 text-green-600" />
          <span>{typeof t.remittanceModal?.totalThisYear === 'function'
            ? t.remittanceModal.totalThisYear(currentYear)
            : `Total ${currentYear}`}:</span>
          <span className="font-medium text-green-600">{formatCurrencyEU(totalThisYear)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{totalDonations} {t.donorDetail?.donations || 'donacions'}</span>
        </div>
        {donor.memberSince && (
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-3 w-3 text-muted-foreground" />
            <span>{t.donors?.memberSince || 'Soci des de'}:</span>
            <span>{donor.memberSince}</span>
          </div>
        )}
      </div>
      <div className="text-xs text-muted-foreground flex items-center gap-1 pt-1 border-t">
        <ExternalLink className="h-3 w-3" />
        {t.remittanceModal?.clickToViewProfile || 'Clica per veure el perfil'}
      </div>
    </div>
  );
}

export function RemittanceDetailModal({
  open,
  onOpenChange,
  remittanceId,
  organizationId,
  parentTransaction,
  onReprocessComplete,
}: RemittanceDetailModalProps) {
  const { firestore, user } = useFirebase();
  const { t } = useTranslations();
  const { toast } = useToast();
  const router = useRouter();
  const { buildUrl } = useOrgUrl();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isReprocessing, setIsReprocessing] = React.useState(false);
  const [pendingItems, setPendingItems] = React.useState<RemittancePendingItem[]>([]);

  // Estat per verificació de consistència
  const [consistencyCheck, setConsistencyCheck] = React.useState<ConsistencyCheckResult | null>(null);
  const [isCheckingConsistency, setIsCheckingConsistency] = React.useState(false);
  const [isSanitizing, setIsSanitizing] = React.useState(false);

  // Query per obtenir les transaccions filles de la remesa
  const remittanceItemsQuery = useMemoFirebase(
    () => {
      if (!organizationId || !firestore || !remittanceId) return null;
      const txRef = collection(firestore, 'organizations', organizationId, 'transactions');
      return query(txRef, where('parentTransactionId', '==', remittanceId));
    },
    [firestore, organizationId, remittanceId]
  );

  const { data: remittanceItems } = useCollection<Transaction>(remittanceItemsQuery);

  // Carregar totes les transaccions per al resum del donant
  const allTransactionsQuery = useMemoFirebase(
    () => organizationId ? collection(firestore, 'organizations', organizationId, 'transactions') : null,
    [firestore, organizationId]
  );
  const { data: allTransactions } = useCollection<Transaction>(allTransactionsQuery);

  // Carregar contactes per mostrar noms
  const contactsCollection = useMemoFirebase(
    () => organizationId ? collection(firestore, 'organizations', organizationId, 'contacts') : null,
    [firestore, organizationId]
  );
  const { data: contacts } = useCollection<AnyContact>(contactsCollection);

  const categoriesCollection = useMemoFirebase(
    () => organizationId ? collection(firestore, 'organizations', organizationId, 'categories') : null,
    [firestore, organizationId]
  );
  const { data: categories } = useCollection<Category>(categoriesCollection);

  // Map de contactes per ID
  const contactMap = React.useMemo(() => {
    if (!contacts) return {};
    return contacts.reduce((acc, contact) => {
      acc[contact.id] = contact;
      return acc;
    }, {} as Record<string, AnyContact>);
  }, [contacts]);

  // Traduccions de categories
  const categoryTranslations = React.useMemo(
    () => t.categories as Record<string, string>,
    [t.categories]
  );

  const getCategoryLabel = React.useCallback((categoryValue: string | null | undefined) => {
    if (!categoryValue) return '-';
    return getCategoryDisplayLabel(categoryValue, {
      categories: categories ?? undefined,
      categoryTranslations,
      unknownCategoryLabel: '-',
    });
  }, [categories, categoryTranslations]);

  // Filtrar per cerca (i excloure arxivades)
  const filteredItems = React.useMemo(() => {
    if (!remittanceItems) return [];

    // Primer: excloure filles arxivades (tolerant a legacy: null/undefined/"")
    const activeItems = remittanceItems.filter(item => !item.archivedAt);
    if (!searchQuery.trim()) return activeItems;

    const q = searchQuery.toLowerCase().trim();
    return activeItems.filter(item => {
      const contact = item.contactId ? contactMap[item.contactId] : null;
      const name = contact?.name?.toLowerCase() || '';
      const taxId = contact?.taxId?.toLowerCase() || '';
      return name.includes(q) || taxId.includes(q);
    });
  }, [remittanceItems, searchQuery, contactMap]);

  // Calcular total
  const total = React.useMemo(() => {
    return filteredItems.reduce((sum, item) => sum + item.amount, 0);
  }, [filteredItems]);

  // Reset cerca quan es tanca
  React.useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setConsistencyCheck(null);
    }
  }, [open]);

  // Verificar consistència quan s'obre el modal
  React.useEffect(() => {
    if (!open || !organizationId || !parentTransaction?.id || !user) {
      return;
    }

    const checkConsistency = async () => {
      setIsCheckingConsistency(true);
      try {
        const idToken = await user.getIdToken();
        const response = await fetch(
          `/api/remittances/in/check?orgId=${organizationId}&parentTxId=${parentTransaction.id}`,
          {
            headers: {
              Authorization: `Bearer ${idToken}`,
            },
          }
        );

        if (response.ok) {
          const result = await response.json();
          setConsistencyCheck(result);
        }
      } catch (error) {
        console.error('[RemittanceDetailModal] Error checking consistency:', error);
      } finally {
        setIsCheckingConsistency(false);
      }
    };

    checkConsistency();
  }, [open, organizationId, parentTransaction?.id, user]);

  // Navegar al perfil del donant
  const handleDonorClick = (contactId: string) => {
    onOpenChange(false); // Tancar modal
    router.push(buildUrl(`/dashboard/donants?id=${contactId}`));
  };

  // Refrescar check de consistència
  const refreshConsistencyCheck = React.useCallback(async () => {
    if (!organizationId || !parentTransaction?.id || !user) return;

    setIsCheckingConsistency(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(
        `/api/remittances/in/check?orgId=${organizationId}&parentTxId=${parentTransaction.id}`,
        {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        setConsistencyCheck(result);
      }
    } catch (error) {
      console.error('[RemittanceDetailModal] Error refreshing consistency:', error);
    } finally {
      setIsCheckingConsistency(false);
    }
  }, [organizationId, parentTransaction?.id, user]);

  // Handler per sanejar remesa legacy
  const handleSanitize = async () => {
    if (!organizationId || !parentTransaction?.id || !user) return;

    setIsSanitizing(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/remittances/in/sanitize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          orgId: organizationId,
          parentTxId: parentTransaction.id,
        }),
      });

      const data = await response.json();

      if (data.success) {
        if (data.action === 'REBUILT_DOC') {
          toast({
            title: 'Remesa reconstruïda',
            description: `${data.activeCount} quotes actives verificades`,
          });
        } else if (data.action === 'MARKED_UNDONE_LEGACY') {
          toast({
            title: 'Remesa marcada com a pendent',
            description: 'Ara pots tornar-la a processar',
          });
          // Tancar modal perquè el pare ja no és remesa
          onOpenChange(false);
          onReprocessComplete?.();
          return;
        }
        // Refrescar check
        await refreshConsistencyCheck();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'No s\'ha pogut sanejar la remesa',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('[RemittanceDetailModal] Error sanitizing:', error);
      toast({
        title: 'Error',
        description: 'Error de connexió',
        variant: 'destructive',
      });
    } finally {
      setIsSanitizing(false);
    }
  };

  // Carregar pendents quan s'obre el modal o canvia el remittanceId
  React.useEffect(() => {
    if (!open || !firestore || !organizationId || !parentTransaction?.remittanceId) {
      setPendingItems([]);
      return;
    }

    const loadPending = async () => {
      const pendingRef = collection(
        firestore,
        'organizations',
        organizationId,
        'remittances',
        parentTransaction.remittanceId!,
        'pending'
      );
      const snapshot = await getDocs(pendingRef);
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RemittancePendingItem));
      setPendingItems(items);
    };

    loadPending();
  }, [open, firestore, organizationId, parentTransaction?.remittanceId]);

  // Reprocessar pendents: intentar match amb donants actuals
  const handleReprocess = async () => {
    if (!firestore || !organizationId || !parentTransaction?.remittanceId || pendingItems.length === 0) return;

    setIsReprocessing(true);

    try {
      // Carregar donants actuals
      const contactsRef = collection(firestore, 'organizations', organizationId, 'contacts');
      const contactsSnap = await getDocs(query(contactsRef, where('type', '==', 'donor')));
      const donors = contactsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Donor));

      // Crear maps per matching
      const donorByTaxId = new Map<string, Donor>();
      const donorByIban = new Map<string, Donor>();
      donors.forEach(d => {
        if (d.taxId) donorByTaxId.set(d.taxId.toLowerCase().replace(/[\s.-]/g, ''), d);
        if (d.iban) donorByIban.set(d.iban.toLowerCase().replace(/\s/g, ''), d);
      });

      const transactionsRef = collection(firestore, 'organizations', organizationId, 'transactions');
      const remittanceDocRef = doc(firestore, 'organizations', organizationId, 'remittances', parentTransaction.remittanceId!);
      const parentTxRef = doc(transactionsRef, parentTransaction.id);

      let resolvedCount = 0;
      let resolvedTotalCents = 0;

      for (const pending of pendingItems) {
        // Intentar match per taxId o IBAN
        let matchedDonor: Donor | undefined;
        if (pending.taxId) {
          const normalizedTaxId = pending.taxId.toLowerCase().replace(/[\s.-]/g, '');
          matchedDonor = donorByTaxId.get(normalizedTaxId);
        }
        if (!matchedDonor && pending.iban) {
          const normalizedIban = pending.iban.toLowerCase().replace(/\s/g, '');
          matchedDonor = donorByIban.get(normalizedIban);
        }

        if (matchedDonor) {
          // Crear transacció filla
          const newTxRef = doc(transactionsRef);
          const membershipType = matchedDonor.membershipType ?? 'recurring';
          const category = membershipType === 'recurring' ? 'memberFees' : 'donations';
          const displayName = matchedDonor.name || pending.nameRaw || 'Anònim';

          const newTxData = {
            id: newTxRef.id,
            date: parentTransaction.date,
            description: `${t.movements?.splitter?.donationDescription ?? 'Donació de'}: ${displayName}`,
            amount: pending.amountCents / 100,
            category,
            document: null,
            contactId: matchedDonor.id,
            contactType: 'donor',
            projectId: parentTransaction.projectId ?? null,
            source: 'remittance',
            parentTransactionId: parentTransaction.id,
            bankAccountId: parentTransaction.bankAccountId ?? null,
            isRemittanceItem: true,
            remittanceId: parentTransaction.remittanceId,
          };

          const batch = writeBatch(firestore);
          batch.set(newTxRef, newTxData);

          // Eliminar pendent
          const pendingDocRef = doc(
            firestore,
            'organizations',
            organizationId,
            'remittances',
            parentTransaction.remittanceId!,
            'pending',
            pending.id
          );
          batch.delete(pendingDocRef);

          await batch.commit();

          resolvedCount++;
          resolvedTotalCents += pending.amountCents;
        }
      }

      if (resolvedCount > 0) {
        // Actualitzar comptadors al pare i document de remesa
        const newPendingCount = (parentTransaction.remittancePendingCount ?? 0) - resolvedCount;
        const newResolvedCount = (parentTransaction.remittanceResolvedCount ?? 0) + resolvedCount;
        const newPendingTotalCents = (parentTransaction.remittancePendingTotalCents ?? 0) - resolvedTotalCents;
        const newResolvedTotalCents = (parentTransaction.remittanceResolvedTotalCents ?? 0) + resolvedTotalCents;
        const newStatus = newPendingCount === 0 ? 'complete' : 'partial';

        await updateDoc(parentTxRef, {
          remittancePendingCount: newPendingCount,
          remittanceResolvedCount: newResolvedCount,
          remittancePendingTotalCents: newPendingTotalCents,
          remittanceResolvedTotalCents: newResolvedTotalCents,
          remittanceStatus: newStatus,
        });

        await updateDoc(remittanceDocRef, {
          pendingCount: newPendingCount,
          resolvedCount: newResolvedCount,
          pendingTotalCents: newPendingTotalCents,
          resolvedTotalCents: newResolvedTotalCents,
        });

        // Recarregar pendents
        const pendingRef = collection(
          firestore,
          'organizations',
          organizationId,
          'remittances',
          parentTransaction.remittanceId!,
          'pending'
        );
        const snapshot = await getDocs(pendingRef);
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RemittancePendingItem));
        setPendingItems(items);

        toast({
          title: t.movements?.splitter?.reprocessSuccess ?? 'Reprocessat',
          description: t.movements?.splitter?.reprocessSuccessDescription?.(resolvedCount) ?? `S'han resolt ${resolvedCount} pendents.`,
        });

        onReprocessComplete?.();
      } else {
        toast({
          title: t.movements?.splitter?.reprocessNoMatch ?? 'Cap coincidència',
          description: t.movements?.splitter?.reprocessNoMatchDescription ?? 'No s\'han trobat coincidències amb els donants actuals.',
          variant: 'default',
        });
      }
    } catch (error: any) {
      console.error('Error reprocessing pending:', error);
      toast({
        variant: 'destructive',
        title: t.movements?.splitter?.error ?? 'Error',
        description: error.message,
      });
    } finally {
      setIsReprocessing(false);
    }
  };

  // Determinar si hi ha pendents
  const hasPending = pendingItems.length > 0;
  const pendingTotal = pendingItems.reduce((sum, p) => sum + p.amountCents, 0) / 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-0.75rem)] max-w-[1280px] flex-col overflow-hidden p-0 sm:w-[min(calc(100vw-2rem),1280px)]">
        <DialogHeader className="shrink-0 border-b bg-background px-4 py-4 pr-10 sm:px-6">
          <DialogTitle>{t.movements.table.remittanceDetail}</DialogTitle>
          <DialogDescription className="sr-only">
            Mostra el detall de la remesa i els seus moviments associats.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-4 sm:px-6">
        {/* Banner d'inconsistència (només per remeses IN, no OUT/devolucions) */}
        {consistencyCheck && !consistencyCheck.consistent && !consistencyCheck.skipped && (
          <div className="mb-4 shrink-0 rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-red-800">
                  Inconsistència detectada
                </h4>
                <p className="text-sm text-red-700 mt-1">
                  {consistencyCheck.issues.includes('COUNT_MISMATCH') && (
                    <>El nombre de filles actives ({consistencyCheck.details?.activeCount}) no coincideix amb l&apos;esperat ({consistencyCheck.details?.expectedCount}). </>
                  )}
                  {consistencyCheck.issues.includes('SUM_MISMATCH') && (
                    <>La suma de les filles no quadra amb l&apos;import del pare (diferència: {((consistencyCheck.details?.deltaCents ?? 0) / 100).toFixed(2)}€). </>
                  )}
                  {consistencyCheck.issues.includes('PARENT_IS_REM_BUT_NO_ACTIVE_CHILDREN') && (
                    <>El pare està marcat com a remesa però no té filles actives. </>
                  )}
                  {consistencyCheck.issues.includes('NO_REM_DOC') && (
                    <>No existeix el document de remesa. </>
                  )}
                  {consistencyCheck.issues.includes('DOC_TXIDS_OUT_OF_SYNC') && (
                    <>Les dades internes de la remesa estan desincronitzades. </>
                  )}
                </p>
                <div className="flex gap-2 mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSanitize}
                    disabled={isSanitizing}
                    className="text-red-700 border-red-300 hover:bg-red-100"
                  >
                    {isSanitizing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Resoldre inconsistència
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loading check */}
        {isCheckingConsistency && (
          <div className="mb-2 shrink-0 text-sm text-muted-foreground">
            Verificant consistència...
          </div>
        )}

        {hasPending && (
          <div className="mb-4 shrink-0 rounded-lg border border-orange-200 bg-orange-50 p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-orange-900">
                  {typeof t.movements?.splitter?.pendingItems === 'function'
                    ? t.movements.splitter.pendingItems(pendingItems.length)
                    : `${pendingItems.length} pendents`
                  } · {formatCurrencyEU(pendingTotal)}
                </p>
                <p className="text-sm text-orange-800">
                  {t.movements?.splitter?.pendingExplanation ??
                    "Aquestes línies no s'han pogut processar perquè la remesa no porta DNI/NIF vàlid i l'IBAN no coincideix amb cap donant existent."}
                </p>
              </div>
              <Button
                onClick={handleReprocess}
                disabled={isReprocessing}
                variant="outline"
                size="sm"
                className="border-orange-300 text-orange-700 hover:bg-orange-50"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isReprocessing ? 'animate-spin' : ''}`} />
                {t.movements?.splitter?.reprocessPending ?? 'Reprocessar pendents'}
              </Button>
            </div>
          </div>
        )}

        {/* Cercador */}
        <div className="relative mb-3 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t.movements.table.searchDonor}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pb-2">
          {/* Taula de quotes */}
          <div className="space-y-3 lg:hidden">
            {filteredItems.length === 0 ? (
              <div className="flex h-24 items-center justify-center rounded-lg border text-center text-muted-foreground">
                {t.movements.table.noResults}
              </div>
            ) : (
              filteredItems.map((item) => {
                const contact = item.contactId ? contactMap[item.contactId] : null;
                const isDonor = item.contactType ? item.contactType === 'donor' : contact?.type === 'donor';

                return (
                  <div key={item.id} className="rounded-lg border bg-background p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {contact && isDonor ? (
                          <button
                            type="button"
                            onClick={() => item.contactId && handleDonorClick(item.contactId)}
                            className="flex items-center gap-1 text-left font-medium hover:text-primary hover:underline"
                          >
                            <span className="break-words">{contact.name}</span>
                            <ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
                          </button>
                        ) : (
                          <div className="font-medium">{contact?.name || '-'}</div>
                        )}
                        {contact?.taxId && (
                          <div className="mt-1 text-xs text-muted-foreground">{contact.taxId}</div>
                        )}
                      </div>
                      <div className="whitespace-nowrap text-right font-medium text-green-600">
                        {formatCurrencyEU(item.amount)}
                      </div>
                    </div>
                    <div className="mt-3 text-sm text-muted-foreground">
                      {getCategoryLabel(item.category)}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="hidden rounded-lg border lg:block">
            <div className="max-w-full overflow-x-auto">
              <Table className="w-full min-w-[900px]">
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead>{t.movements.table.contact}</TableHead>
                    <TableHead className="w-[160px]">DNI/CIF</TableHead>
                    <TableHead className="w-[140px] text-right">{t.movements.table.amount}</TableHead>
                    <TableHead>{t.movements.table.category}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => {
                    const contact = item.contactId ? contactMap[item.contactId] : null;
                    const isDonor = item.contactType ? item.contactType === 'donor' : contact?.type === 'donor';

                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {contact && isDonor ? (
                            <HoverCard openDelay={300} closeDelay={100}>
                              <HoverCardTrigger asChild>
                                <button
                                  type="button"
                                  onClick={() => item.contactId && handleDonorClick(item.contactId)}
                                  className="group flex items-center gap-1 text-left hover:text-primary hover:underline"
                                >
                                  <span className="break-words">{contact.name}</span>
                                  <ExternalLink className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-50" />
                                </button>
                              </HoverCardTrigger>
                              <HoverCardContent className="w-72" side="right" align="start">
                                <DonorHoverSummary
                                  donor={contact as Donor}
                                  transactions={allTransactions || []}
                                  t={t}
                                />
                              </HoverCardContent>
                            </HoverCard>
                          ) : (
                            <span>{contact?.name || '-'}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {contact?.taxId || '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium text-green-600">
                          {formatCurrencyEU(item.amount)}
                        </TableCell>
                        <TableCell>
                          {getCategoryLabel(item.category)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                        {t.movements.table.noResults}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        {/* Footer quotes */}
        <div className="mt-3 flex shrink-0 items-center justify-between gap-3 border-t pt-3">
          <span className="text-sm text-muted-foreground">
            {filteredItems.length} {t.movements.table.remittanceQuotes}
          </span>
          <span className="font-semibold text-green-600">
            {t.movements.table.totalQuotes}: {formatCurrencyEU(total)}
          </span>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
