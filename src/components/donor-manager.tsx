'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Edit, Trash2, User, Building2, RefreshCw, Heart, Upload, AlertTriangle, Search, X, RotateCcw, Download, Users, CreditCard, MoreVertical, ChevronDown, UserPlus, RotateCw, UserX } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import type { Donor, Category, Transaction } from '@/lib/data';
import { fromPeriodQuery, toPeriodQuery } from '@/lib/period-query';
import type { DateFilterValue } from '@/components/date-filter';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { useCollection, useFirebase, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import { updateContactViaApi } from '@/services/contacts';
import { findExistingContact } from '@/lib/contact-matching';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { useCurrentOrganization } from '@/hooks/organization-provider';
import { DonorImporter } from './donor-importer';
import { DonorDetailDrawer } from './donor-detail-drawer';
import { useTranslations } from '@/i18n';
import { normalizeContact, formatCurrencyEU } from '@/lib/normalize';
import { cn } from '@/lib/utils';
import { exportDonorsToExcel } from '@/lib/donors-export';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { MobileListItem } from '@/components/mobile/mobile-list-item';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { DateFilter } from '@/components/date-filter';
import { computeDonorDynamics, getDateRange, type DonorWithMeta, type DonorDynamicsResult } from '@/lib/donor-dynamics';
import { MOBILE_ACTIONS_BAR, MOBILE_CTA_PRIMARY } from '@/lib/ui/mobile-actions';
import { filterValidSelectItems } from '@/lib/ui/safe-select-options';
import { CannotArchiveContactDialog } from '@/components/contacts/cannot-archive-contact-dialog';
import { getPeriodicitySuffix } from '@/lib/donors/periodicity-suffix';
import { usePermissions } from '@/hooks/use-permissions';

type DonorFormData = Omit<Donor, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'inactiveSince'>;

const emptyFormData: DonorFormData = {
  type: 'donor',
  name: '',
  taxId: '',
  zipCode: '',
  city: '',
  province: '',
  address: '',
  donorType: 'individual',
  membershipType: 'one-time',
  monthlyAmount: undefined,
  memberSince: undefined,
  iban: '',
  email: '',
  phone: '',
  notes: '',
  defaultCategoryId: undefined,
  periodicityQuota: null,
  contactPersonName: null,
};

// ═══════════════════════════════════════════════════════════════════════════
// DYNAMICS BLOCK - Component intern per mostrar llistes de dinàmica
// ═══════════════════════════════════════════════════════════════════════════
function DynamicsBlock({
  title,
  help,
  items,
  onDonorClick,
  tr,
  icon,
  showAmount = false,
  showNetAmount = false,
  numbered = false
}: {
  title: string;
  help: string;
  items: DonorWithMeta[];
  onDonorClick: (donor: Donor) => void;
  tr: (key: string, fallback?: string) => string;
  icon?: React.ReactNode;
  showAmount?: boolean;
  showNetAmount?: boolean;
  numbered?: boolean;
}) {
  const [showAll, setShowAll] = React.useState(false);
  const displayItems = showAll ? items : items.slice(0, 20);

  return (
    <div className="border rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {icon}
          <div>
            <h4 className="font-medium text-sm">{title}</h4>
            <p className="text-xs text-muted-foreground">{help}</p>
          </div>
        </div>
        <Badge variant="secondary">{items.length}</Badge>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{tr('donors.dynamics.empty', 'Cap donant en aquesta categoria')}</p>
      ) : (
        <>
          <ul className="space-y-1 max-h-48 overflow-y-auto">
            {displayItems.map((item, idx) => (
              <li key={item.donor.id}>
                <button
                  type="button"
                  onClick={() => onDonorClick(item.donor)}
                  className="text-sm text-blue-600 hover:underline text-left w-full flex justify-between items-center py-0.5"
                >
                  <span className="truncate">
                    {numbered && <span className="text-muted-foreground mr-1.5 text-xs">{idx + 1}.</span>}
                    {item.donor.name}
                  </span>
                  {showAmount && item.returnsSum !== undefined && (
                    <span className="text-muted-foreground ml-2 text-xs whitespace-nowrap">
                      {formatCurrencyEU(item.returnsSum)}
                    </span>
                  )}
                  {showNetAmount && item.netAmount !== undefined && (
                    <span className="text-muted-foreground ml-2 text-xs whitespace-nowrap">
                      {formatCurrencyEU(item.netAmount)}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {items.length > 20 && !showAll && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 w-full"
              onClick={() => setShowAll(true)}
            >
              {tr('donors.dynamics.actions.viewAll', 'Veure tots')} ({items.length})
            </Button>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGINACIÓ DE DONANTS
// ═══════════════════════════════════════════════════════════════════════════
const DONORS_PAGE_SIZE = 500;

type DonorYearlySummaryItem = {
  donorId: string;
  year: number | null;
  totalDonations: number;
  donationCount: number;
};

export function DonorManager() {
  const { firestore, auth, user } = useFirebase();
  const { organizationId, orgSlug } = useCurrentOrganization();
  const { can } = usePermissions();
  const { toast } = useToast();
  const { t, tr, language } = useTranslations();
  const isMobile = useIsMobile();
  const searchParams = useSearchParams();
  const urlDonorId = searchParams.get('id');
  const canReadTransactions = can('moviments.read');

  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isAlertOpen, setIsAlertOpen] = React.useState(false);
  const [isImportOpen, setIsImportOpen] = React.useState(false);
  const [isDetailOpen, setIsDetailOpen] = React.useState(false);
  const [selectedDonor, setSelectedDonor] = React.useState<Donor | null>(null);
  const [editingDonor, setEditingDonor] = React.useState<Donor | null>(null);
  const [donorToDelete, setDonorToDelete] = React.useState<Donor | null>(null);
  const [formData, setFormData] = React.useState<DonorFormData>(emptyFormData);
  const [status, setStatus] = React.useState<'active' | 'inactive'>('active');
  const [inactiveSince, setInactiveSince] = React.useState<string | null>(null);

  // Filtre de donants incomplets
  const [showIncompleteOnly, setShowIncompleteOnly] = React.useState(false);
  const [hasUrlFilter, setHasUrlFilter] = React.useState(false);

  // Filtre per estat (actiu/inactiu)
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'active' | 'inactive'>('active');

  // Cercador intel·ligent
  const [searchQuery, setSearchQuery] = React.useState('');

  // Nous filtres: view=active i membershipType
  const [activeViewFilter, setActiveViewFilter] = React.useState(false);
  const [membershipTypeFilter, setMembershipTypeFilter] = React.useState<'one-time' | 'recurring' | null>(null);

  // Filtre per tipus de donant (persona física / jurídica)
  const [donorTypeFilter, setDonorTypeFilter] = React.useState<'individual' | 'company' | null>(null);

  // Filtre per periodicitat de quota
  const [periodicityFilter, setPeriodicityFilter] = React.useState<'all' | 'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'manual' | 'none'>('all');
  const [periodFilter, setPeriodFilter] = React.useState<DateFilterValue | null>(null);
  const [periodLabel, setPeriodLabel] = React.useState<string>('');

  // ═══════════════════════════════════════════════════════════════════════════
  // DINÀMICA DE DONANTS
  // ═══════════════════════════════════════════════════════════════════════════
  const [dynamicsOpen, setDynamicsOpen] = React.useState(false);
  const [dynamicsPeriod, setDynamicsPeriod] = React.useState<DateFilterValue>({
    type: 'year',
    year: new Date().getFullYear()
  });
  const [activeDonorSummaries, setActiveDonorSummaries] = React.useState<DonorYearlySummaryItem[] | null>(null);
  const [dynamicsTransactions, setDynamicsTransactions] = React.useState<Transaction[] | null>(null);

  // Estat de paginació
  const [contactsLimit, setContactsLimit] = React.useState(DONORS_PAGE_SIZE);
  const [hasMoreContacts, setHasMoreContacts] = React.useState(true);

  // Referència base de la col·lecció (per operacions de document)
  const contactsCollection = useMemoFirebase(
    () => organizationId ? collection(firestore, 'organizations', organizationId, 'contacts') : null,
    [firestore, organizationId]
  );

  // Query amb paginació (per carregar dades)
  const donorsQuery = useMemoFirebase(
    () => {
      if (!organizationId) return null;
      const baseCollection = collection(firestore, 'organizations', organizationId, 'contacts');
      return query(baseCollection, where('type', '==', 'donor'), orderBy('name', 'asc'), limit(contactsLimit));
    },
    [firestore, organizationId, contactsLimit]
  );

  const { data: donorsRaw, isLoading: isLoadingDonors } = useCollection<Donor & { archivedAt?: string }>(donorsQuery);
  // Filtrar donants arxivats (soft-deleted)
  const donors = React.useMemo(
    () => donorsRaw?.filter(d => !d.archivedAt),
    [donorsRaw]
  );

  // Detectar si hi ha més contactes per carregar
  React.useEffect(() => {
    if (donorsRaw) {
      // Si hem rebut exactament el límit, probablement n'hi ha més
      setHasMoreContacts(donorsRaw.length >= contactsLimit);
    }
  }, [donorsRaw, contactsLimit]);

  // Funció per carregar més contactes
  const handleLoadMore = React.useCallback(() => {
    setContactsLimit(prev => prev + DONORS_PAGE_SIZE);
  }, []);

  // Categories d'ingrés per al selector de categoria per defecte
  const categoriesCollection = useMemoFirebase(
    () => organizationId ? collection(firestore, 'organizations', organizationId, 'categories') : null,
    [firestore, organizationId]
  );
  const { data: allCategories } = useCollection<Category>(categoriesCollection);
  const incomeCategories = React.useMemo(
    () => filterValidSelectItems(
      allCategories?.filter(c => c.type === 'income') || [],
      'donor-manager.incomeCategories'
    ),
    [allCategories]
  );

  // Memoitzar per evitar re-renders innecessaris
  const categoryTranslations = React.useMemo(
    () => t.categories as Record<string, string>,
    [t.categories]
  );

  React.useEffect(() => {
    if (!organizationId || !user || !canReadTransactions || !activeViewFilter) {
      setActiveDonorSummaries(null);
      return;
    }

    const controller = new AbortController();

    const loadActiveDonorSummaries = async () => {
      try {
        const idToken = await user.getIdToken();
        const params = new URLSearchParams({
          orgId: organizationId,
          ...toPeriodQuery(periodFilter || { type: 'all' }),
        });
        const response = await fetch(`/api/donors/yearly-summary?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`donor summary request failed: ${response.status}`);
        }

        const payload = await response.json() as { items?: DonorYearlySummaryItem[] };
        if (!controller.signal.aborted) {
          setActiveDonorSummaries(payload.items ?? []);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('[donor-manager] yearly summary load error:', error);
          setActiveDonorSummaries([]);
        }
      }
    };

    void loadActiveDonorSummaries();

    return () => controller.abort();
  }, [activeViewFilter, canReadTransactions, organizationId, periodFilter, user]);

  React.useEffect(() => {
    if (!organizationId || !dynamicsOpen || !canReadTransactions) {
      setDynamicsTransactions(null);
      return;
    }

    const controller = new AbortController();

    const loadDynamicsTransactions = async () => {
      try {
        const range = dynamicsPeriod.type === 'all' ? null : getDateRange(dynamicsPeriod);
        let dynamicsQuery = query(
          collection(firestore, 'organizations', organizationId, 'transactions'),
          orderBy('date', 'desc')
        );

        if (range?.to) {
          dynamicsQuery = query(
            collection(firestore, 'organizations', organizationId, 'transactions'),
            where('date', '<=', range.to),
            orderBy('date', 'desc')
          );
        }

        const snapshot = await getDocs(dynamicsQuery);
        if (controller.signal.aborted) return;
        setDynamicsTransactions(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Transaction)));
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('[donor-manager] dynamics load error:', error);
          setDynamicsTransactions([]);
        }
      }
    };

    void loadDynamicsTransactions();

    return () => controller.abort();
  }, [canReadTransactions, dynamicsOpen, dynamicsPeriod, firestore, organizationId]);

  const dynamics = React.useMemo(() => {
    if (!dynamicsOpen || !donors || !dynamicsTransactions) return null;
    return computeDonorDynamics(donors, dynamicsTransactions, dynamicsPeriod);
  }, [dynamicsOpen, donors, dynamicsTransactions, dynamicsPeriod]);

  // Detectar si no hi ha dades
  const hasNoData = dynamics &&
    dynamics.newDonors.length === 0 &&
    dynamics.leavers.length === 0 &&
    dynamics.withReturns.length === 0 &&
    dynamics.topIndividuals.length === 0 &&
    dynamics.topCompanies.length === 0;

  // Handler per obrir drawer des de dinàmica
  const handleDynamicsDonorClick = React.useCallback((donor: Donor) => {
    setSelectedDonor(donor);
    setIsDetailOpen(true);
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // DEVOLUCIONS: Estat i càrrega
  // ═══════════════════════════════════════════════════════════════════════════
  const [donorsWithReturns, setDonorsWithReturns] = React.useState<Set<string>>(new Set());
  const [donorsWithReturnsThisMonth, setDonorsWithReturnsThisMonth] = React.useState<Set<string>>(new Set());
  const [donorsWithTwoOrMoreReturns, setDonorsWithTwoOrMoreReturns] = React.useState<Set<string>>(new Set());
  const [showWithReturnsOnly, setShowWithReturnsOnly] = React.useState(false);
  const [showWithReturnsThisMonthOnly, setShowWithReturnsThisMonthOnly] = React.useState(false);
  const [showWithTwoOrMoreReturnsOnly, setShowWithTwoOrMoreReturnsOnly] = React.useState(false);
  const [loadingReturns, setLoadingReturns] = React.useState(false);

  const loadDonorsWithReturns = React.useCallback(async () => {
    if (!organizationId || !firestore || !canReadTransactions) return;
    setLoadingReturns(true);
    try {
      const txRef = collection(firestore, 'organizations', organizationId, 'transactions');
      const q = query(txRef, where('transactionType', '==', 'return'));
      const snapshot = await getDocs(q);
      const ids = new Set<string>();
      const idsThisMonth = new Set<string>();
      const idsWithTwoOrMore = new Set<string>();
      const returnsCountByDonor = new Map<string, number>();
      const now = new Date();
      const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      snapshot.forEach(doc => {
        const data = doc.data() as { contactId?: string; date?: string };
        const contactId = data.contactId;
        if (contactId) ids.add(contactId);

        if (!contactId) return;

        const nextCount = (returnsCountByDonor.get(contactId) || 0) + 1;
        returnsCountByDonor.set(contactId, nextCount);
        if (nextCount >= 2) idsWithTwoOrMore.add(contactId);

        if (typeof data.date === 'string' && data.date.startsWith(currentMonthPrefix)) {
          idsThisMonth.add(contactId);
        }
      });
      setDonorsWithReturns(ids);
      setDonorsWithReturnsThisMonth(idsThisMonth);
      setDonorsWithTwoOrMoreReturns(idsWithTwoOrMore);
    } catch (e) {
      console.error('Error carregant devolucions:', e);
    } finally {
      setLoadingReturns(false);
    }
  }, [canReadTransactions, organizationId, firestore]);

  // Carregar devolucions al mount
  React.useEffect(() => {
    if (!canReadTransactions) {
      setDonorsWithReturns(new Set());
      setDonorsWithReturnsThisMonth(new Set());
      setDonorsWithTwoOrMoreReturns(new Set());
      setShowWithReturnsOnly(false);
      setShowWithReturnsThisMonthOnly(false);
      setShowWithTwoOrMoreReturnsOnly(false);
      return;
    }
    loadDonorsWithReturns();
  }, [canReadTransactions, loadDonorsWithReturns]);

  React.useEffect(() => {
    if (status === 'inactive' && !inactiveSince) {
      const today = new Date().toISOString().split('T')[0];
      setInactiveSince(today);
    }

    if (status !== 'inactive') {
      setInactiveSince(null);
    }
  }, [status]);

  // Llegir paràmetres de la URL (filtres)
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const filter = params.get('filter');
      if (filter === 'incomplete') {
        setShowIncompleteOnly(true);
        setHasUrlFilter(true);
      }

      // Nous filtres: view=active i membershipType
      const view = params.get('view');
      const membershipType = params.get('membershipType');

      if (view === 'active' && canReadTransactions) {
        setActiveViewFilter(true);
        setHasUrlFilter(true);
        // Llegir el període dels paràmetres
        const period = fromPeriodQuery(params);
        if (period) {
          setPeriodFilter(period);
          // Construir label del període per mostrar a la UI
          if (period.type === 'all') {
            setPeriodLabel(t.donors.allPeriods || 'Tot el període');
          } else if (period.type === 'year' && period.year) {
            setPeriodLabel(`${period.year}`);
          } else if (period.type === 'month' && period.year && period.month) {
            setPeriodLabel(`${period.month}/${period.year}`);
          } else if (period.type === 'quarter' && period.year && period.quarter) {
            setPeriodLabel(`T${period.quarter} ${period.year}`);
          }
        }
      }

      if (membershipType === 'one-time' || membershipType === 'recurring') {
        setMembershipTypeFilter(membershipType);
        setHasUrlFilter(true);
      }
    }
  }, [canReadTransactions, t.donors.allPeriods]);

  // Efecte separat per obrir el drawer quan hi ha ?id= a la URL (reactiu)
  // PATRÓ: useSearchParams() + useEffect amb deps [urlParam, data] per drawers controlats per URL
  React.useEffect(() => {
    if (urlDonorId && donors !== undefined) {
      const donor = donors.find(d => d.id === urlDonorId);
      if (donor) {
        setSelectedDonor(donor);
        setIsDetailOpen(true);
      }
      // Netejar el paràmetre id de la URL per evitar re-open en refresh/navegació
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete('id');
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, [urlDonorId, donors]);

  // Funció per netejar el filtre i actualitzar la URL
  const clearFilter = () => {
    setShowIncompleteOnly(false);
    setShowWithReturnsOnly(false);
    setShowWithReturnsThisMonthOnly(false);
    setShowWithTwoOrMoreReturnsOnly(false);
    setActiveViewFilter(false);
    setMembershipTypeFilter(null);
    setPeriodFilter(null);
    setPeriodLabel('');
    setHasUrlFilter(false);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('filter');
      url.searchParams.delete('view');
      url.searchParams.delete('membershipType');
      url.searchParams.delete('periodType');
      url.searchParams.delete('periodYear');
      url.searchParams.delete('periodMonth');
      url.searchParams.delete('periodQuarter');
      url.searchParams.delete('periodFrom');
      url.searchParams.delete('periodTo');
      window.history.replaceState({}, '', url.toString());
    }
  };

  const activeContactIds = React.useMemo(() => {
    if (!activeViewFilter || !activeDonorSummaries) return new Set<string>();
    return new Set(activeDonorSummaries.map((item) => item.donorId));
  }, [activeDonorSummaries, activeViewFilter]);

  // Comptadors per estat
  const statusCounts = React.useMemo(() => {
    if (!donors) return { active: 0, inactive: 0, total: 0 };
    const active = donors.filter(d => d.status !== 'inactive').length;
    const inactive = donors.filter(d => d.status === 'inactive').length;
    return { active, inactive, total: donors.length };
  }, [donors]);

  // Base filtrada: estat + cerca + incomplets + devolucions + activeView
  // (abans d'aplicar donorType i membershipType, per calcular comptadors)
  const baseFilteredDonors = React.useMemo(() => {
    if (!donors) return [];

    let result = donors;

    // Filtre per estat
    if (statusFilter === 'active') {
      // "Actius" inclou també pending_return: devolució pendent no és baixa.
      result = result.filter(donor => donor.status !== 'inactive');
    } else if (statusFilter === 'inactive') {
      result = result.filter(donor => donor.status === 'inactive');
    }

    // Filtre de cerca intel·ligent
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      // Normalitzar query per a cerca IBAN (sense espais)
      const queryNoSpaces = query.replace(/\s/g, '');

      result = result.filter(donor => {
        const searchFields = [
          donor.name,
          donor.taxId,
          donor.email,
          donor.phone,
          donor.city,
          donor.province,
          donor.zipCode,
          donor.address,
        ].filter(Boolean).map(f => f!.toLowerCase());

        // Cerca normal en camps de text
        const matchesTextFields = searchFields.some(field => field.includes(query));

        // Cerca especial per IBAN (normalitzat sense espais)
        const ibanNormalized = (donor.iban || '').toLowerCase().replace(/\s/g, '');
        const matchesIban = ibanNormalized.includes(queryNoSpaces);

        return matchesTextFields || matchesIban;
      });
    }

    // Filtre de donants incomplets
    if (showIncompleteOnly) {
      result = result.filter(donor => !donor.taxId || !donor.zipCode || (donor.membershipType === 'recurring' && !donor.iban));
    }

    // Filtre de donants amb devolucions
    if (showWithReturnsOnly) {
      result = result.filter(donor => donorsWithReturns.has(donor.id));
    }

    // Filtre de donants amb devolucions aquest mes
    if (showWithReturnsThisMonthOnly) {
      result = result.filter(donor => donorsWithReturnsThisMonth.has(donor.id));
    }

    // Filtre de donants amb 2 devolucions o més
    if (showWithTwoOrMoreReturnsOnly) {
      result = result.filter(donor => donorsWithTwoOrMoreReturns.has(donor.id));
    }

    // Filtre per contactes actius (amb transaccions al període)
    if (activeViewFilter && activeContactIds.size > 0) {
      result = result.filter(donor => activeContactIds.has(donor.id));
    }

    return result;
  }, [
    donors,
    showIncompleteOnly,
    showWithReturnsOnly,
    showWithReturnsThisMonthOnly,
    showWithTwoOrMoreReturnsOnly,
    searchQuery,
    statusFilter,
    donorsWithReturns,
    donorsWithReturnsThisMonth,
    donorsWithTwoOrMoreReturns,
    activeViewFilter,
    activeContactIds
  ]);

  // Comptadors per tipus de donant i modalitat (sobre baseFilteredDonors)
  const donorTypeCounts = React.useMemo(() => {
    let individual = 0;
    let company = 0;
    for (const d of baseFilteredDonors) {
      if (d.donorType === 'company') company++;
      else individual++;
    }
    return { all: baseFilteredDonors.length, individual, company };
  }, [baseFilteredDonors]);

  const membershipTypeCounts = React.useMemo(() => {
    let oneTime = 0;
    let recurring = 0;
    for (const d of baseFilteredDonors) {
      if ((d.membershipType || 'one-time') === 'recurring') recurring++;
      else oneTime++;
    }
    return { all: baseFilteredDonors.length, 'one-time': oneTime, recurring };
  }, [baseFilteredDonors]);

  const periodicityCounts = React.useMemo(() => {
    let monthly = 0, quarterly = 0, semiannual = 0, annual = 0, manual = 0, none = 0;
    for (const d of baseFilteredDonors) {
      switch (d.periodicityQuota) {
        case 'monthly':    monthly++; break;
        case 'quarterly':  quarterly++; break;
        case 'semiannual': semiannual++; break;
        case 'annual':     annual++; break;
        case 'manual':     manual++; break;
        default:           none++; break;
      }
    }
    return { all: baseFilteredDonors.length, monthly, quarterly, semiannual, annual, manual, none };
  }, [baseFilteredDonors]);

  // Filtrar donants (aplica donorType + membershipType sobre la base)
  const filteredDonors = React.useMemo(() => {
    let result = baseFilteredDonors;

    // Filtre per tipus de membre (donant puntual vs soci recurrent)
    if (membershipTypeFilter) {
      result = result.filter(donor => (donor.membershipType || 'one-time') === membershipTypeFilter);
    }

    // Filtre per tipus de donant (persona física / jurídica)
    if (donorTypeFilter) {
      result = result.filter(donor => donor.donorType === donorTypeFilter);
    }

    // Filtre per periodicitat de quota
    if (periodicityFilter !== 'all') {
      result = result.filter(d => {
        if (periodicityFilter === 'none') {
          return !d.periodicityQuota;
        }
        return d.periodicityQuota === periodicityFilter;
      });
    }

    return result;
  }, [baseFilteredDonors, membershipTypeFilter, donorTypeFilter, periodicityFilter]);

  const incompleteDonorsCount = React.useMemo(() => {
    if (!donors) return 0;
    return donors.filter(donor => !donor.taxId || !donor.zipCode || (donor.membershipType === 'recurring' && !donor.iban)).length;
  }, [donors]);

  const anyReturnsFilterActive = showWithReturnsOnly || showWithReturnsThisMonthOnly || showWithTwoOrMoreReturnsOnly;
  const returnsEmptyStateTitle = showWithTwoOrMoreReturnsOnly
    ? (t.donorsFilter.noWithTwoOrMoreReturns || 'No hi ha donants amb 2 devolucions o més')
    : showWithReturnsThisMonthOnly
      ? (t.donorsFilter.noWithReturnsThisMonth || 'No hi ha donants amb devolucions aquest mes')
      : (t.donorsFilter.noWithReturns || 'No hi ha donants amb devolucions');

  const handleEdit = (donor: Donor) => {
    const currentStatus: 'active' | 'inactive' = donor.status === 'inactive' ? 'inactive' : 'active';
    setEditingDonor(donor);
    setFormData({
      type: 'donor',
      name: donor.name,
      taxId: donor.taxId,
      zipCode: donor.zipCode,
      city: donor.city || '',
      province: donor.province || '',
      address: donor.address || '',
      donorType: donor.donorType,
      membershipType: donor.membershipType,
      monthlyAmount: donor.monthlyAmount,
      memberSince: donor.memberSince,
      iban: donor.iban || '',
      email: donor.email || '',
      phone: donor.phone || '',
      notes: donor.notes || '',
      defaultCategoryId: donor.defaultCategoryId,
      periodicityQuota: donor.periodicityQuota ?? null,
      contactPersonName: donor.contactPersonName ?? null,
    });
    setStatus(currentStatus);
    setInactiveSince(donor.inactiveSince ?? null);
    setIsDialogOpen(true);
  };

  // Estat per modal informatiu "no es pot arxivar"
  const [cannotArchiveOpen, setCannotArchiveOpen] = React.useState(false);
  const [cannotArchiveActiveCount, setCannotArchiveActiveCount] = React.useState(0);
  const [cannotArchiveArchivedCount, setCannotArchiveArchivedCount] = React.useState(0);
  const [isCheckingArchive, setIsCheckingArchive] = React.useState(false);

  // Pre-check via API amb dryRun abans d'obrir modal
  const handleDeleteRequest = async (donor: Donor) => {
    if (!organizationId || !user) return;

    setDonorToDelete(donor);
    setIsCheckingArchive(true);

    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/contacts/archive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          orgId: organizationId,
          contactId: donor.id,
          dryRun: true,
        }),
      });

      const result = await response.json();

      if (result.canArchive) {
        // OK: obrir modal de confirmació
        setIsAlertOpen(true);
      } else if (result.code === 'HAS_TRANSACTIONS') {
        // Té moviments actius: obrir modal informatiu
        setCannotArchiveActiveCount(result.activeCount || 0);
        setCannotArchiveArchivedCount(result.archivedCount || 0);
        setCannotArchiveOpen(true);
      } else {
        // Error genèric
        toast({
          variant: 'destructive',
          title: t.common.error,
          description: result.error || 'Error desconegut',
        });
        setDonorToDelete(null);
      }
    } catch (err) {
      console.error('[DonorManager] Error checking archive:', err);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: t.common.dbConnectionError,
      });
      setDonorToDelete(null);
    } finally {
      setIsCheckingArchive(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ARXIVAT (v1.36): Flux via API-first per garantir integritat referencial
  // ═══════════════════════════════════════════════════════════════════════════
  const handleDeleteConfirm = async () => {
    if (!donorToDelete || !organizationId || !user) {
      setIsAlertOpen(false);
      setDonorToDelete(null);
      return;
    }

    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/contacts/archive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          orgId: organizationId,
          contactId: donorToDelete.id,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: t.donors.donorDeleted,
          description: t.donors.donorDeletedDescription(donorToDelete.name),
        });
      } else if (result.code === 'HAS_TRANSACTIONS') {
        toast({
          variant: 'destructive',
          title: t.contacts?.cannotArchive ?? 'No es pot arxivar',
          description: t.contacts?.hasTransactionsError?.(result.transactionCount)
            ?? `Aquest contacte té ${result.transactionCount} moviments associats. No es pot arxivar.`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: t.common.error,
          description: result.error || 'Error desconegut',
        });
      }
    } catch (err) {
      console.error('[DonorManager] Error arxivant contacte:', err);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: t.common.dbConnectionError,
      });
    }

    setIsAlertOpen(false);
    setDonorToDelete(null);
  };

  const handleOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingDonor(null);
      setFormData(emptyFormData);
      setStatus('active');
      setInactiveSince(null);
    }
  };

  const handleAddNew = () => {
    setEditingDonor(null);
    setFormData(emptyFormData);
    setStatus('active');
    setInactiveSince(null);
    setIsDialogOpen(true);
  };

  const handleFormChange = (field: keyof DonorFormData, value: any) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };
      // Netejar contactPersonName si canvia a individual
      if (field === 'donorType' && value === 'individual') {
        next.contactPersonName = null;
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: t.donors.errorNameRequired
      });
      return;
    }

    if (!contactsCollection) {
      toast({ variant: 'destructive', title: t.common.error, description: t.common.dbConnectionError });
      return;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // NORMALITZACIÓ: Aplicar format consistent abans de guardar
    // ═══════════════════════════════════════════════════════════════════════
    const normalized = normalizeContact(formData);

    // Avís si falten dades pel Model 182
    if (!normalized.taxId || !normalized.zipCode) {
      toast({
        title: t.donors.incompleteDataWarning,
        description: t.donors.incompleteDataWarningDescription,
        duration: 5000,
      });
    }

    const now = new Date().toISOString();

    const dataToSave = {
      ...normalized,
      taxId: normalized.taxId || null,
      zipCode: normalized.zipCode || null,
      city: normalized.city || null,
      province: normalized.province || null,
      address: normalized.address || null,
      email: normalized.email || null,
      phone: normalized.phone || null,
      notes: normalized.notes || null,
      defaultCategoryId: formData.defaultCategoryId ?? null,
      monthlyAmount: normalized.monthlyAmount ?? null,
      memberSince: normalized.memberSince ?? null,
      iban: normalized.iban || null,
      status: status,
      inactiveSince: status === 'inactive' ? inactiveSince : null,
      periodicityQuota: formData.periodicityQuota ?? null,
      contactPersonName: formData.donorType === 'company'
        ? (formData.contactPersonName?.trim() || null)
        : null,
      updatedAt: now,
    };

    if (editingDonor) {
      try {
        await updateContactViaApi({
          orgId: organizationId!,
          docId: editingDonor.id,
          data: dataToSave,
          auth,
        });
        toast({
          title: t.donors.donorUpdated,
          description: t.donors.donorUpdatedDescription(normalized.name)
        });
      } catch (err: any) {
        toast({ variant: 'destructive', title: 'Error', description: err?.message || 'No s\'ha pogut desar' });
        return;
      }
    } else {
      // Validar si ja existeix un contacte amb el mateix NIF/IBAN/email
      const existingMatch = findExistingContact(
        donors as any[] || [],
        normalized.taxId || undefined,
        normalized.iban || undefined,
        normalized.email || undefined
      );

      if (existingMatch.found && existingMatch.contact) {
        const existing = existingMatch.contact;
        toast({
          variant: 'destructive',
          title: 'Possible duplicat detectat',
          description: `Ja existeix "${existing.name}" amb el mateix ${existingMatch.matchedBy === 'taxId' ? 'NIF' : existingMatch.matchedBy === 'iban' ? 'IBAN' : 'email'}. Revisa la llista abans de crear un duplicat.`,
          duration: 8000,
        });
        return;
      }

      addDocumentNonBlocking(contactsCollection, { ...dataToSave, roles: { donor: true }, createdAt: now });
      toast({
        title: t.donors.donorCreated,
        description: t.donors.donorCreatedDescription(normalized.name)
      });
    }
    handleOpenChange(false);
  };

  const handleImportComplete = (count: number) => {
    // El toast ja es mostra dins del DonorImporter
  };

  const handleViewDetail = (donor: Donor) => {
    setSelectedDonor(donor);
    setIsDetailOpen(true);
  };

  const handleReactivate = async (donor: Donor) => {
    if (!organizationId) return;

    const now = new Date().toISOString();
    try {
      await updateContactViaApi({
        orgId: organizationId,
        docId: donor.id,
        data: { status: 'active', inactiveSince: null, updatedAt: now },
        auth,
      });
      toast({
        title: t.donors.donorReactivated,
        description: t.donors.donorReactivatedDescription(donor.name),
      });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err?.message || 'No s\'ha pogut reactivar' });
    }
  };

  const handleEditFromDrawer = (donor: Donor) => {
    setIsDetailOpen(false);
    handleEdit(donor);
  };

  const dialogTitle = editingDonor ? t.donors.editTitle : t.donors.addTitle;
  const dialogDescription = editingDonor
    ? t.donors.editDescription
    : t.donors.addDescription;

  // Helper per detectar dades incompletes
  const hasIncompleteData = (donor: Donor) => !donor.taxId || !donor.zipCode || (donor.membershipType === 'recurring' && !donor.iban);

  // Helper per obtenir què falta (per mostrar a la columna "Falta")
  const getMissingFields = (donor: Donor): string[] => {
    const missing: string[] = [];
    if (!donor.taxId) missing.push('NIF');
    if (!donor.zipCode) missing.push('CP');
    if (donor.membershipType === 'recurring' && !donor.iban) missing.push('IBAN');
    return missing;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // GUARDRAIL: Skeleton mentre l'organització no estigui resolta
  // Prevé errors "Missing or insufficient permissions" per queries prematures
  // ═══════════════════════════════════════════════════════════════════════════
  if (!organizationId) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
        <Card>
          <CardHeader className={cn("flex flex-col gap-4", "sm:flex-row sm:items-center sm:justify-between")}>
            <div>
              <CardTitle className="text-2xl font-bold tracking-tight font-headline">
                {t.donors.title}
              </CardTitle>
              <CardDescription>
                {t.donors.description}
              </CardDescription>
            </div>
            <div className={cn(MOBILE_ACTIONS_BAR, "sm:justify-end")}>
              <DialogTrigger asChild>
                <Button onClick={handleAddNew} className={MOBILE_CTA_PRIMARY}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  {t.donors.add}
                </Button>
              </DialogTrigger>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  asChild
                  className="flex-1 sm:flex-none"
                >
                  <Link href={`/${orgSlug}/dashboard/donants/remeses-cobrament`}>
                    <CreditCard className="mr-2 h-4 w-4" />
                    <span className="sm:inline">{t.sepaCollection?.newCollection ?? 'Remesa SEPA'}</span>
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => donors && exportDonorsToExcel(donors, allCategories || [])}
                  disabled={!donors || donors.length === 0}
                  title={t.donors.exportTooltip ?? 'Exportar llista de donants a Excel'}
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => setIsImportOpen(true)} title={t.donors.import}>
                  <Upload className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Cercador i botons de filtre */}
            <div className="mb-4 flex flex-col gap-3">
              {/* Cercador intel·ligent */}
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t.donors.searchPlaceholder}
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

              {/* Botons de filtre per estat */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant={statusFilter === 'active' && !showIncompleteOnly && !anyReturnsFilterActive ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setStatusFilter('active');
                    setShowIncompleteOnly(false);
                    setShowWithReturnsOnly(false);
                    setShowWithReturnsThisMonthOnly(false);
                    setShowWithTwoOrMoreReturnsOnly(false);
                  }}
                >
                  {t.donors.allActive} ({statusCounts.active})
                </Button>
                {statusCounts.inactive > 0 && (
                  <Button
                    variant={statusFilter === 'inactive' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setStatusFilter('inactive');
                      setShowIncompleteOnly(false);
                      setShowWithReturnsOnly(false);
                      setShowWithReturnsThisMonthOnly(false);
                      setShowWithTwoOrMoreReturnsOnly(false);
                    }}
                    className={statusFilter !== 'inactive' ? 'border-gray-400 text-gray-600' : ''}
                  >
                    {t.donors.allInactive} ({statusCounts.inactive})
                  </Button>
                )}
                <Button
                  variant={statusFilter === 'all' && !showIncompleteOnly && !anyReturnsFilterActive ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setStatusFilter('all');
                    setShowIncompleteOnly(false);
                    setShowWithReturnsOnly(false);
                    setShowWithReturnsThisMonthOnly(false);
                    setShowWithTwoOrMoreReturnsOnly(false);
                  }}
                >
                  {t.donors.all} ({statusCounts.total})
                </Button>
                {incompleteDonorsCount > 0 && (
                  <Button
                    variant={showIncompleteOnly ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setShowIncompleteOnly(true);
                      setShowWithReturnsOnly(false);
                      setShowWithReturnsThisMonthOnly(false);
                      setShowWithTwoOrMoreReturnsOnly(false);
                      setStatusFilter('all');
                    }}
                    className={!showIncompleteOnly ? 'border-amber-300 text-amber-600' : ''}
                  >
                    <AlertTriangle className="mr-1.5 h-3 w-3" />
                    {t.donors.incomplete} ({incompleteDonorsCount})
                  </Button>
                )}
                {donorsWithReturns.size > 0 && (
                  <>
                    <Button
                      variant={showWithReturnsOnly ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        const next = !showWithReturnsOnly;
                        setShowWithReturnsOnly(next);
                        if (next) {
                          setShowIncompleteOnly(false);
                          setStatusFilter('all');
                        }
                      }}
                      className={!showWithReturnsOnly ? 'border-orange-300 text-orange-600' : ''}
                    >
                      {t.donorsFilter.withReturns} ({donorsWithReturns.size})
                    </Button>
                    <Button
                      variant={showWithReturnsThisMonthOnly ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        const next = !showWithReturnsThisMonthOnly;
                        setShowWithReturnsThisMonthOnly(next);
                        if (next) {
                          setShowIncompleteOnly(false);
                          setStatusFilter('all');
                        }
                      }}
                      className={!showWithReturnsThisMonthOnly ? 'border-orange-300 text-orange-600' : ''}
                    >
                      {t.donorsFilter.withReturnsThisMonth} ({donorsWithReturnsThisMonth.size})
                    </Button>
                    <Button
                      variant={showWithTwoOrMoreReturnsOnly ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        const next = !showWithTwoOrMoreReturnsOnly;
                        setShowWithTwoOrMoreReturnsOnly(next);
                        if (next) {
                          setShowIncompleteOnly(false);
                          setStatusFilter('all');
                        }
                      }}
                      className={!showWithTwoOrMoreReturnsOnly ? 'border-orange-300 text-orange-600' : ''}
                    >
                      {t.donorsFilter.withTwoOrMoreReturns} ({donorsWithTwoOrMoreReturns.size})
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      onClick={loadDonorsWithReturns}
                      disabled={loadingReturns}
                    >
                      <RefreshCw className={cn("h-4 w-4", loadingReturns && "animate-spin")} />
                    </Button>
                  </>
                )}
              </div>

              {/* Filtres secundaris: tipus, modalitat, periodicitat */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Bloc Tipus */}
                <span className="text-xs text-muted-foreground mr-1">{t.donorsFilter.donorTypeLabel}</span>
                <Button
                  variant={donorTypeFilter === 'individual' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDonorTypeFilter(donorTypeFilter === 'individual' ? null : 'individual')}
                >
                  <User className="mr-1.5 h-3 w-3" />
                  {t.donorsFilter.individual} ({donorTypeCounts.individual})
                </Button>
                <Button
                  variant={donorTypeFilter === 'company' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDonorTypeFilter(donorTypeFilter === 'company' ? null : 'company')}
                >
                  <Building2 className="mr-1.5 h-3 w-3" />
                  {t.donorsFilter.company} ({donorTypeCounts.company})
                </Button>

                {/* Bloc Modalitat */}
                <span className="text-xs text-muted-foreground mr-1 ml-2">{t.donorsFilter.modalityLabel}</span>
                <Button
                  variant={membershipTypeFilter === 'one-time' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMembershipTypeFilter(membershipTypeFilter === 'one-time' ? null : 'one-time')}
                >
                  {t.donorsFilter.oneTime} ({membershipTypeCounts['one-time']})
                </Button>
                <Button
                  variant={membershipTypeFilter === 'recurring' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMembershipTypeFilter(membershipTypeFilter === 'recurring' ? null : 'recurring')}
                >
                  <Heart className="mr-1.5 h-3 w-3" />
                  {t.donorsFilter.recurring} ({membershipTypeCounts.recurring})
                </Button>

                {/* Bloc Periodicitat */}
                <span className="text-xs text-muted-foreground mr-1 ml-2">{t.donorsFilter.periodicityLabel}</span>
                <Select value={periodicityFilter} onValueChange={(v) => setPeriodicityFilter(v as typeof periodicityFilter)}>
                  <SelectTrigger className="h-8 w-[180px] text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t.donorsFilter.allPeriodicity}</SelectItem>
                    <SelectItem value="monthly">{t.donorsFilter.periodicityMonthly} ({periodicityCounts.monthly})</SelectItem>
                    <SelectItem value="quarterly">{t.donorsFilter.periodicityQuarterly} ({periodicityCounts.quarterly})</SelectItem>
                    <SelectItem value="semiannual">{t.donorsFilter.periodicitySemiannual} ({periodicityCounts.semiannual})</SelectItem>
                    <SelectItem value="annual">{t.donorsFilter.periodicityAnnual} ({periodicityCounts.annual})</SelectItem>
                    <SelectItem value="manual">{t.donorsFilter.periodicityManual} ({periodicityCounts.manual})</SelectItem>
                    <SelectItem value="none">{t.donorsFilter.noPeriodicity} ({periodicityCounts.none})</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Avís de filtre actiu des de dashboard */}
            {hasUrlFilter && showIncompleteOnly && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-blue-500 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-800">
                    Filtrant: {t.donors.incomplete}
                  </p>
                  <p className="text-xs text-blue-600">
                    Mostrant només {filteredDonors.length} donants amb dades incompletes
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilter}
                  className="border-blue-300 text-blue-700 hover:bg-blue-100"
                >
                  {t.donors.showAll}
                </Button>
              </div>
            )}

            {/* Avís de filtre actiu: donants/socis actius al període */}
            {hasUrlFilter && (membershipTypeFilter !== null || (canReadTransactions && activeViewFilter)) && !showIncompleteOnly && (
              <div className="mb-4 p-3 bg-violet-50 border border-violet-200 rounded-lg flex items-center gap-3">
                <Heart className="h-5 w-5 text-violet-500 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-violet-800">
                    {membershipTypeFilter === 'one-time'
                      ? (t.donors.filterActiveDonors || 'Donants actius')
                      : membershipTypeFilter === 'recurring'
                        ? (t.donors.filterActiveMembers || 'Socis actius')
                        : (t.donors.filterActive || 'Donants i socis actius')}
                    {periodLabel && ` (${periodLabel})`}
                  </p>
                  <p className="text-xs text-violet-600">
                    {t.donors.showingCount
                      ? t.donors.showingCount({ count: filteredDonors.length })
                      : `Mostrant ${filteredDonors.length} ${membershipTypeFilter === 'recurring' ? 'socis' : 'donants'} amb aportacions al període`}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilter}
                  className="border-violet-300 text-violet-700 hover:bg-violet-100"
                >
                  {t.donors.showAll}
                </Button>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════════
                DINÀMICA DE DONANTS - Secció col·lapsable
            ═══════════════════════════════════════════════════════════════════════ */}
            {canReadTransactions && (
              <Collapsible open={dynamicsOpen} onOpenChange={setDynamicsOpen}>
                <div className="mb-4 border rounded-lg">
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center justify-between w-full p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="text-left">
                        <h3 className="font-medium text-base">
                          {tr('donors.dynamics.title', 'Dinàmica de donants')}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {tr('donors.dynamics.subtitle', 'Lectura basada en moviments reals del període seleccionat.')}
                        </p>
                      </div>
                      <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform", dynamicsOpen && "rotate-180")} />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pb-4 space-y-4">
                      {/* Selector de període */}
                      <div>
                        <Label className="text-sm text-muted-foreground mb-2 block">
                          {tr('donors.dynamics.period.title', "Període d'anàlisi")}
                        </Label>
                        <DateFilter value={dynamicsPeriod} onChange={setDynamicsPeriod} />
                      </div>

                      {/* Estat "no hi ha dades" */}
                      {hasNoData && (
                        <p className="text-sm text-muted-foreground py-4">
                          {tr('donors.dynamics.noData', 'No hi ha dades suficients per calcular la dinàmica amb aquest període.')}
                        </p>
                      )}

                      {/* Blocs de dinàmica */}
                      {dynamics && !hasNoData && (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                          <DynamicsBlock
                            title={tr('donors.dynamics.blocks.new.title', 'Altes')}
                            help={tr('donors.dynamics.blocks.new.help', 'Primer moviment dins el període seleccionat')}
                            items={dynamics.newDonors}
                            onDonorClick={handleDynamicsDonorClick}
                            tr={tr}
                            icon={<UserPlus className="h-4 w-4 text-green-600" />}
                          />
                          <DynamicsBlock
                            title={tr('donors.dynamics.blocks.leavers.title', 'Baixes')}
                            help={tr('donors.dynamics.blocks.leavers.help', 'Donants donats de baixa dins el període')}
                            items={dynamics.leavers}
                            onDonorClick={handleDynamicsDonorClick}
                            tr={tr}
                            icon={<UserX className="h-4 w-4 text-red-500" />}
                          />
                          <DynamicsBlock
                            title={tr('donors.dynamics.blocks.returns.title', 'Amb devolucions')}
                            help={tr('donors.dynamics.blocks.returns.help', 'Tenen almenys una devolució dins el període')}
                            items={dynamics.withReturns}
                            onDonorClick={handleDynamicsDonorClick}
                            tr={tr}
                            icon={<RefreshCw className="h-4 w-4 text-orange-500" />}
                            showAmount
                          />
                          <DynamicsBlock
                            title={tr('donors.dynamics.blocks.topIndividuals.title', 'Donants principals (PF)')}
                            help={tr('donors.dynamics.blocks.topIndividuals.help', 'Top 15 persones físiques per import net dins el període')}
                            items={dynamics.topIndividuals}
                            onDonorClick={handleDynamicsDonorClick}
                            tr={tr}
                            icon={<User className="h-4 w-4 text-yellow-600" />}
                            showNetAmount
                            numbered
                          />
                          <DynamicsBlock
                            title={tr('donors.dynamics.blocks.topCompanies.title', 'Donants principals (PJ)')}
                            help={tr('donors.dynamics.blocks.topCompanies.help', 'Top 15 persones jurídiques per import net dins el període')}
                            items={dynamics.topCompanies}
                            onDonorClick={handleDynamicsDonorClick}
                            tr={tr}
                            icon={<Building2 className="h-4 w-4 text-indigo-600" />}
                            showNetAmount
                            numbered
                          />
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            )}

            {/* Vista mòbil */}
            {isMobile ? (
              <div className="flex flex-col gap-2">
                {isLoadingDonors && !donorsRaw && (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={`skeleton-${i}`} className="border border-border/50 rounded-lg p-3">
                      <Skeleton className="h-4 w-32 mb-2" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  ))
                )}
                {filteredDonors && filteredDonors.map((donor) => (
                  <MobileListItem
                    key={donor.id}
                    title={
                      <button
                        type="button"
                        onClick={() => handleViewDetail(donor)}
                        className="text-blue-600 hover:text-blue-800 text-left font-medium"
                      >
                        {donor.name}
                      </button>
                    }
                    leadingIcon={
                      donor.donorType === 'individual' ? (
                        <User className="h-4 w-4" />
                      ) : (
                        <Building2 className="h-4 w-4" />
                      )
                    }
                    meta={[
                      { label: 'NIF', value: donor.taxId || <span className="text-amber-500">-</span> },
                      { value: donor.donorType === 'individual' ? t.donors.types.individual : t.donors.types.company },
                      ...(donor.membershipType === 'recurring' && donor.monthlyAmount
                        ? [{ value: formatCurrencyEU(donor.monthlyAmount) + `/${getPeriodicitySuffix(donor.periodicityQuota, t)}` }]
                        : []
                      ),
                    ]}
                    badges={[
                      ...(donor.status === 'inactive' ? [
                        <Badge key="inactive" variant="secondary" className="bg-gray-200 text-gray-600 text-xs py-0 px-1.5">
                          {t.donors.inactiveBadge}
                        </Badge>
                      ] : []),
                      ...(donor.membershipType === 'recurring' ? [
                        <Badge key="recurring" className="bg-green-100 text-green-800 text-xs py-0 px-1.5">
                          <RefreshCw className="mr-0.5 h-2.5 w-2.5" />
                          {t.donors.membership.recurring}
                        </Badge>
                      ] : []),
                      ...(donorsWithReturns.has(donor.id) ? [
                        <Badge key="returns" variant="secondary" className="text-xs bg-orange-100 text-orange-700 border-orange-200">
                          Dev.
                        </Badge>
                      ] : []),
                      ...(hasIncompleteData(donor) ? [
                        <AlertTriangle key="incomplete" className="h-4 w-4 text-amber-500" />
                      ] : []),
                    ]}
                    actions={
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewDetail(donor)}>
                            <User className="mr-2 h-4 w-4" />
                            Veure detall
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEdit(donor)}>
                            <Edit className="mr-2 h-4 w-4" />
                            {t.donors.editDonor ?? 'Editar'}
                          </DropdownMenuItem>
                          {donor.status === 'inactive' && (
                            <DropdownMenuItem onClick={() => handleReactivate(donor)}>
                              <RotateCcw className="mr-2 h-4 w-4" />
                              {t.donors.reactivate}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => handleDeleteRequest(donor)}
                            className="text-rose-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {t.donors.deleteDonor ?? 'Eliminar'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    }
                  />
                ))}
                {/* Botó "Carregar més" per mòbil */}
                {!isLoadingDonors && hasMoreContacts && filteredDonors.length > 0 && (
                  <div className="mt-4 flex justify-center">
                    <Button
                      variant="outline"
                      onClick={handleLoadMore}
                      className="gap-2"
                    >
                      <ChevronDown className="h-4 w-4" />
                      {language === 'ca' ? 'Carregar més' : 'Cargar más'}
                    </Button>
                  </div>
                )}
                {!isLoadingDonors && (!filteredDonors || filteredDonors.length === 0) && (
                  <EmptyState
                    icon={searchQuery ? Search : Users}
                    title={
                      searchQuery
                        ? (t.emptyStates?.donors?.noResults ?? t.donors.noSearchResults)
                        : showIncompleteOnly
                          ? (t.donors.noIncompleteData || "No hi ha donants amb dades incompletes")
                          : anyReturnsFilterActive
                            ? returnsEmptyStateTitle
                            : (t.emptyStates?.donors?.noData ?? t.donors.noData)
                    }
                    description={
                      searchQuery
                        ? (t.emptyStates?.donors?.noResultsDesc ?? undefined)
                        : !showIncompleteOnly && !anyReturnsFilterActive
                          ? (t.emptyStates?.donors?.noDataDesc ?? undefined)
                          : undefined
                    }
                    className="py-12"
                  />
                )}
              </div>
            ) : (
              /* Vista desktop (taula) */
              <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.donors.name}</TableHead>
                      <TableHead>{t.donors.taxId}</TableHead>
                      <TableHead>{t.donors.donorType}</TableHead>
                      <TableHead>{t.donors.membershipType}</TableHead>
                      <TableHead>{t.donors.amount}</TableHead>
                      {showIncompleteOnly && (
                        <TableHead className="text-amber-600">{t.donors.missingColumn || 'Falta'}</TableHead>
                      )}
                      <TableHead className="text-right">{t.donors.actions}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDonors && filteredDonors.map((donor) => (
                      <TableRow key={donor.id} className="h-10">
                        <TableCell className="font-medium py-1">
                          <div className="flex items-center gap-2">
                            {donor.donorType === 'individual' ? (
                              <User className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                            )}
                            <button
                              type="button"
                              onClick={() => handleViewDetail(donor)}
                              className="text-blue-600 hover:text-blue-800 hover:underline text-left font-medium cursor-pointer"
                            >
                              {donor.name}
                            </button>
                            {donor.status === 'inactive' && (
                              <Badge variant="secondary" className="bg-gray-200 text-gray-600 text-xs py-0 px-1.5">
                                {t.donors.inactiveBadge}
                              </Badge>
                            )}
                            {donorsWithReturns.has(donor.id) && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="secondary" className="ml-1 text-xs bg-orange-100 text-orange-700 border-orange-200">
                                    Dev.
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Aquest donant té devolucions assignades</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {hasIncompleteData(donor) && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  {t.donors.incompleteDataTooltip}
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-1 text-xs">{donor.taxId || <span className="text-amber-500">-</span>}</TableCell>
                        <TableCell className="py-1">
                          <Badge variant="outline" className="text-xs py-0 px-1.5">
                            {donor.donorType === 'individual' ? t.donors.types.individual : t.donors.types.company}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-1">
                          {donor.membershipType === 'recurring' ? (
                            <Badge className="bg-green-100 text-green-800 text-xs py-0 px-1.5">
                              <RefreshCw className="mr-0.5 h-2.5 w-2.5" />
                              {t.donors.membership.recurring}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs py-0 px-1.5">{t.donors.membership.oneTime}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-1 text-xs">
                          {donor.membershipType === 'recurring' && donor.monthlyAmount
                            ? formatCurrencyEU(donor.monthlyAmount) + `/${getPeriodicitySuffix(donor.periodicityQuota, t)}`
                            : '-'
                          }
                        </TableCell>
                        {showIncompleteOnly && (
                          <TableCell className="py-1">
                            <div className="flex flex-wrap gap-1">
                              {getMissingFields(donor).map(field => (
                                <Badge key={field} variant="outline" className="text-amber-600 border-amber-300 text-xs py-0 px-1.5">
                                  {field}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                        )}
                        <TableCell className="text-right py-1">
                          {donor.status === 'inactive' && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-9 w-9 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                  onClick={() => handleReactivate(donor)}
                                  aria-label={t.donors.reactivate}
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{t.donors.reactivate}</TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted/40"
                                onClick={() => handleEdit(donor)}
                                aria-label={t.donors.editDonor ?? 'Editar donant'}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t.donors.editDonor ?? 'Editar'}</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                onClick={() => handleDeleteRequest(donor)}
                                aria-label={t.donors.deleteDonor ?? 'Eliminar donant'}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t.donors.deleteDonor ?? 'Eliminar'}</TooltipContent>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Skeleton loading state */}
                    {isLoadingDonors && !donorsRaw && (
                      Array.from({ length: 6 }).map((_, i) => (
                        <TableRow key={`skeleton-${i}`}>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          {showIncompleteOnly && <TableCell><Skeleton className="h-4 w-20" /></TableCell>}
                          <TableCell><Skeleton className="h-8 w-16" /></TableCell>
                        </TableRow>
                      ))
                    )}
                    {/* Empty state (only when not loading) */}
                    {!isLoadingDonors && (!filteredDonors || filteredDonors.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={showIncompleteOnly ? 7 : 6} className="p-0">
                          <EmptyState
                            icon={searchQuery ? Search : Users}
                            title={
                              searchQuery
                                ? (t.emptyStates?.donors?.noResults ?? t.donors.noSearchResults)
                                : showIncompleteOnly
                                  ? (t.donors.noIncompleteData || "No hi ha donants amb dades incompletes")
                                  : anyReturnsFilterActive
                                    ? returnsEmptyStateTitle
                                    : (t.emptyStates?.donors?.noData ?? t.donors.noData)
                            }
                            description={
                              searchQuery
                                ? (t.emptyStates?.donors?.noResultsDesc ?? undefined)
                                : !showIncompleteOnly && !anyReturnsFilterActive
                                  ? (t.emptyStates?.donors?.noDataDesc ?? undefined)
                                  : undefined
                            }
                            className="border-0 rounded-none py-12"
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {/* ═══════════════════════════════════════════════════════════════════════
                  PAGINACIÓ: Botó "Carregar més"
                  ═══════════════════════════════════════════════════════════════════════ */}
              {!isLoadingDonors && hasMoreContacts && filteredDonors.length > 0 && (
                <div className="mt-4 flex justify-center">
                  <Button
                    variant="outline"
                    onClick={handleLoadMore}
                    className="gap-2"
                  >
                    <ChevronDown className="h-4 w-4" />
                    {language === 'ca' ? 'Carregar més' : 'Cargar más'}
                  </Button>
                </div>
              )}
              </>
            )}
          </CardContent>
        </Card>

        <DialogContent className="w-[95vw] sm:max-w-4xl lg:max-w-5xl max-h-[90vh] p-0 flex flex-col">
          {/* Header fix */}
          <DialogHeader className="flex-shrink-0 px-6 py-5 border-b">
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{dialogDescription}</DialogDescription>
          </DialogHeader>

          {/* Cos amb scroll */}
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
            {/* Grid principal 2 columnes */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">

              {/* ══════════════════════════════════════════════════════════════
                  COLUMNA ESQUERRA
                  ══════════════════════════════════════════════════════════════ */}
              <div className="space-y-6 h-full">

                {/* Secció: Dades fiscals */}
                <div className="rounded-lg border bg-background px-4 py-4">
                  <h4 className="text-sm font-semibold">{tr('donors.form.section.fiscal', 'Dades fiscals')}</h4>
                  <div className="mt-3 space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="name">{t.donors.name}<span className="ml-1 text-muted-foreground">*</span></Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => handleFormChange('name', e.target.value)}
                        placeholder={t.donors.namePlaceholder}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="taxId">
                        {t.donors.taxId}
                        <span className="ml-1 text-muted-foreground">*</span>
                        <span className="ml-1.5 text-xs font-normal text-amber-600">(Model 182)</span>
                      </Label>
                      <Input
                        id="taxId"
                        value={formData.taxId}
                        onChange={(e) => handleFormChange('taxId', e.target.value.toUpperCase())}
                        placeholder="12345678A o B12345678"
                      />
                      <p className="text-xs text-muted-foreground leading-4">
                        {t.form?.taxIdHelp ?? "8 dígits + lletra (DNI) o lletra + 7 dígits + lletra (NIE/CIF)."}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 items-stretch">
                      <div className="space-y-1.5 h-full">
                        <Label htmlFor="donorType">{t.donors.donorType}</Label>
                        <Select
                          value={formData.donorType}
                          onValueChange={(v) => handleFormChange('donorType', v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="individual">{t.donors.types.individual}</SelectItem>
                            <SelectItem value="company">{t.donors.types.company}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-4 h-full">
                        <div className="space-y-1.5">
                          <Label htmlFor="status">{t.donors.statusField}</Label>
                          <Select
                            value={status}
                            onValueChange={(v) => setStatus(v as 'active' | 'inactive')}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">{t.donors.statusActive}</SelectItem>
                              <SelectItem value="inactive">{t.donors.statusInactive}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {status === 'inactive' && (
                          <div className="space-y-2">
                            <Label htmlFor="inactiveSince">{tr('donor.form.inactiveSince')}</Label>
                            <Input
                              id="inactiveSince"
                              type="date"
                              value={inactiveSince ?? ''}
                              onChange={(e) => setInactiveSince(e.target.value || null)}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                </div>

                {/* Secció: Contacte */}
                <div className="rounded-lg border bg-background px-4 py-4">
                  <h4 className="text-sm font-semibold">{tr('donors.form.section.contact', 'Contacte')}</h4>
                  <div className="mt-3 space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="email">{t.donors.email}</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email || ''}
                        onChange={(e) => handleFormChange('email', e.target.value)}
                        placeholder="correu@exemple.com"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="phone">{t.donors.phone}</Label>
                      <Input
                        id="phone"
                        value={formData.phone || ''}
                        onChange={(e) => handleFormChange('phone', e.target.value)}
                        placeholder="600 000 000"
                      />
                    </div>

                    {formData.donorType === 'company' && (
                      <div className="space-y-1.5">
                        <Label htmlFor="contactPersonName">{t.donors.contactPersonName}</Label>
                        <Input
                          id="contactPersonName"
                          value={formData.contactPersonName || ''}
                          onChange={(e) => handleFormChange('contactPersonName', e.target.value)}
                          placeholder={t.donors.contactPersonNamePlaceholder}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Secció: Adreça */}
                <div className="rounded-lg border bg-background px-4 py-4">
                  <h4 className="text-sm font-semibold">{tr('donors.form.section.address', 'Adreça')}</h4>
                  <div className="mt-3 space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="zipCode">
                          {t.donors.zipCode}
                          <span className="ml-1 text-muted-foreground">*</span>
                        </Label>
                        <Input
                          id="zipCode"
                          value={formData.zipCode}
                          onChange={(e) => handleFormChange('zipCode', e.target.value)}
                          placeholder="08001"
                          maxLength={5}
                        />
                        <p className="text-xs text-muted-foreground leading-4">
                          {t.form?.zipCodeHelp ?? "5 dígits. Model 182."}
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="city">{t.donors.city}</Label>
                        <Input
                          id="city"
                          value={formData.city || ''}
                          onChange={(e) => handleFormChange('city', e.target.value)}
                          placeholder="Barcelona"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="province">{t.donors.province}</Label>
                        <Input
                          id="province"
                          value={formData.province || ''}
                          onChange={(e) => handleFormChange('province', e.target.value)}
                          placeholder="Barcelona"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="address">{t.donors.address}</Label>
                      <Input
                        id="address"
                        value={formData.address || ''}
                        onChange={(e) => handleFormChange('address', e.target.value)}
                        placeholder="Carrer Major, 15, 2n 1a"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* ══════════════════════════════════════════════════════════════
                  COLUMNA DRETA
                  ══════════════════════════════════════════════════════════════ */}
              <div className="space-y-6 h-full">

                {/* Secció: Quota / Donació */}
                <div className="rounded-lg border bg-background px-4 py-4">
                  <h4 className="text-sm font-semibold">{tr('donors.form.section.donation', 'Quota / Donació')}</h4>
                  <div className="mt-3 space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="membershipType">{t.donors.membershipType}</Label>
                      <Select
                        value={formData.membershipType}
                        onValueChange={(v) => handleFormChange('membershipType', v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="one-time">{t.donors.membership.oneTime}</SelectItem>
                          <SelectItem value="recurring">{t.donors.membership.recurring}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="defaultCategoryId">
                        {t.contacts.defaultCategory}
                        <span className="block text-xs font-normal text-muted-foreground">{t.contacts.defaultCategoryHint}</span>
                      </Label>
                      <Select
                        value={formData.defaultCategoryId || '__none__'}
                        onValueChange={(v) => handleFormChange('defaultCategoryId', v === '__none__' ? undefined : v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t.contacts.selectDefaultCategory} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">{t.contacts.noDefaultCategory}</SelectItem>
                          {incomeCategories.map(cat => (
                            <SelectItem key={cat.id} value={cat.id}>{categoryTranslations[cat.name] || cat.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Camps recurrents (només si aplica) */}
                    {formData.membershipType === 'recurring' && (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                          <div className="space-y-1.5">
                            <Label htmlFor="monthlyAmount">{tr('donors.quotaAmountPerCharge.label', 'Import de quota')}</Label>
                            <Input
                              id="monthlyAmount"
                              type="number"
                              step="0.01"
                              className="h-10"
                              value={formData.monthlyAmount || ''}
                              onChange={(e) => handleFormChange('monthlyAmount', parseFloat(e.target.value) || undefined)}
                              placeholder="10.00"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="periodicityQuota">{tr('donors.periodicityQuota.label', 'Periodicitat')}</Label>
                            <Select
                              value={formData.periodicityQuota ?? "__none__"}
                              onValueChange={(v) => handleFormChange('periodicityQuota', v === "__none__" ? null : v)}
                            >
                              <SelectTrigger id="periodicityQuota" className="h-10">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">{tr('donors.periodicityQuota.none', 'Sense periodicitat')}</SelectItem>
                                <SelectItem value="monthly">{tr('donors.periodicityQuota.monthly', 'Mensual')}</SelectItem>
                                <SelectItem value="quarterly">{tr('donors.periodicityQuota.quarterly', 'Trimestral')}</SelectItem>
                                <SelectItem value="semiannual">{tr('donors.periodicityQuota.semiannual', 'Semestral')}</SelectItem>
                                <SelectItem value="annual">{tr('donors.periodicityQuota.annual', 'Anual')}</SelectItem>
                                <SelectItem value="manual">{tr('donors.periodicityQuota.manual', 'Manual')}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground leading-4">
                          {tr('donors.quotaAmountPerCharge.hint', "Import per cobrament segons periodicitat.")}
                        </p>

                        <div className="space-y-1.5">
                          <Label htmlFor="memberSince">{t.donors.memberSince}</Label>
                          <Input
                            id="memberSince"
                            type="date"
                            value={formData.memberSince || ''}
                            onChange={(e) => handleFormChange('memberSince', e.target.value)}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Secció: Banc (només si recurring) */}
                {formData.membershipType === 'recurring' && (
                  <div className="rounded-lg border bg-background px-4 py-4">
                    <h4 className="text-sm font-semibold">{tr('donors.form.section.bank', 'Banc')}</h4>
                    <div className="mt-3 space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="iban">{t.donors.iban}</Label>
                        <Input
                          id="iban"
                          value={formData.iban || ''}
                          onChange={(e) => handleFormChange('iban', e.target.value.toUpperCase().replace(/\s/g, ''))}
                          placeholder="ES00 0000 0000 0000 0000 0000"
                          className="font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════
                SECCIÓ NOTES (full width, fora del grid)
                ══════════════════════════════════════════════════════════════ */}
            <div className="mt-6 rounded-lg border bg-background px-4 py-4">
              <h4 className="text-sm font-semibold">{t.donors.notes}</h4>
              <div className="mt-3">
                <Textarea
                  id="notes"
                  value={formData.notes || ''}
                  onChange={(e) => handleFormChange('notes', e.target.value)}
                  placeholder={t.donors.notesPlaceholder}
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* Footer fix */}
          <DialogFooter className="flex-shrink-0 px-6 py-4 border-t flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="outline">{t.common.cancel}</Button>
            </DialogClose>
            <Button onClick={handleSave}>
              {editingDonor ? t.donors.save : t.donors.add}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.donors.confirmDeleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.donors.confirmDeleteDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDonorToDelete(null)}>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>{t.common.delete}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DonorImporter
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        onImportComplete={handleImportComplete}
      />

      <DonorDetailDrawer
        donor={selectedDonor}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        onEdit={handleEditFromDrawer}
      />

      <CannotArchiveContactDialog
        open={cannotArchiveOpen}
        onOpenChange={(open) => {
          setCannotArchiveOpen(open);
          if (!open) setDonorToDelete(null);
        }}
        contactName={donorToDelete?.name || ''}
        activeCount={cannotArchiveActiveCount}
        archivedCount={cannotArchiveArchivedCount}
      />
    </TooltipProvider>
  );
}
