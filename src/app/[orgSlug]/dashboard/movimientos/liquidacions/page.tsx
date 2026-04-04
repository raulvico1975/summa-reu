'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentOrganization, useOrgUrl } from '@/hooks/organization-provider';
import { useFirebase } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslations, type TranslationsContextType } from '@/i18n';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { cn } from '@/lib/utils';
import { MOBILE_CTA_PRIMARY } from '@/lib/ui/mobile-actions';
import {
  ArrowLeft,
  FileText,
  Plus,
  Info,
  Loader2,
  Archive,
  RotateCcw,
  ChevronRight,
  Receipt,
  Pencil,
  Car,
  Send,
  MoreVertical,
} from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { EmptyState } from '@/components/ui/empty-state';
import {
  listenExpenseReports,
  createExpenseReportDraft,
  submitExpenseReport,
  restoreExpenseReport,
  type ExpenseReport,
} from '@/lib/expense-reports';
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatCurrencyEU } from '@/lib/normalize';
import { format } from 'date-fns';
import { ca } from 'date-fns/locale';
import { TicketsInbox } from '@/components/expense-reports/tickets-inbox';

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function formatDateRange(dateFrom: string | null, dateTo: string | null): string {
  if (!dateFrom && !dateTo) return '—';
  if (dateFrom && !dateTo) return format(new Date(dateFrom), 'dd/MM/yyyy', { locale: ca });
  if (!dateFrom && dateTo) return format(new Date(dateTo), 'dd/MM/yyyy', { locale: ca });
  return `${format(new Date(dateFrom!), 'dd/MM', { locale: ca })} - ${format(new Date(dateTo!), 'dd/MM/yyyy', { locale: ca })}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS D'ESTAT
// ═══════════════════════════════════════════════════════════════════════════

interface StatusInfo {
  badge: React.ReactNode;
  tooltip: string;
}

/**
 * Retorna badge i tooltip basats en els 4 ESTATS OFICIALS:
 * - draft: En preparació
 * - submitted: Enviada (amb subestats opcionals: PDF generat, SEPA generat)
 * - matched: Conciliada amb pagament bancari
 * - archived: Arxivada
 */
function getStatusInfo(report: ExpenseReport, t: TranslationsContextType['t']): StatusInfo {
  // Usar l'estat oficial de Firestore, no derivats
  switch (report.status) {
    case 'draft':
      return {
        badge: <Badge variant="outline" className="bg-gray-50 text-gray-700">{t.expenseReports.statuses.draft}</Badge>,
        tooltip: t.expenseReports.tooltips.draft,
      };
    case 'submitted':
      // Subestats visuals dins de "Enviada"
      if (report.sepa) {
        return {
          badge: <Badge variant="outline" className="bg-blue-50 text-blue-700">{t.expenseReports.statuses.sepaGenerated}</Badge>,
          tooltip: t.expenseReports.tooltips.sepaGenerated,
        };
      }
      if (report.generatedPdf) {
        return {
          badge: <Badge variant="outline" className="bg-amber-50 text-amber-700">{t.expenseReports.statuses.ready}</Badge>,
          tooltip: t.expenseReports.tooltips.ready,
        };
      }
      // Submitted sense PDF ni SEPA
      return {
        badge: <Badge variant="outline" className="bg-yellow-50 text-yellow-700">{t.expenseReports.status?.submitted ?? t.expenseReports.statuses.submitted}</Badge>,
        tooltip: t.expenseReports.status?.submittedHelp ?? '',
      };
    case 'matched':
      return {
        badge: <Badge variant="outline" className="bg-green-50 text-green-700">{t.expenseReports.statuses.matched}</Badge>,
        tooltip: t.expenseReports.tooltips.matched,
      };
    case 'archived':
      return {
        badge: <Badge variant="outline" className="bg-slate-100 text-slate-500">{t.expenseReports.statuses.archived}</Badge>,
        tooltip: t.expenseReports.tooltips.archived,
      };
    default:
      return {
        badge: <Badge variant="outline">{report.status}</Badge>,
        tooltip: '',
      };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export default function LiquidacionsPage() {
  const router = useRouter();
  const { organization, organizationId, userRole } = useCurrentOrganization();
  const { firestore, storage, user } = useFirebase();
  const { buildUrl } = useOrgUrl();
  const { toast } = useToast();
  const { t, tr } = useTranslations();
  const isMobile = useIsMobile();

  // Helper defensiu per traduccions JSON (evita mostrar claus literals)
  const trSafe = React.useCallback(
    (key: string, fallback: string): string => {
      const v = tr(key);
      return v === key ? fallback : v;
    },
    [tr]
  );

  // Feature flag check
  const isPendingDocsEnabled = organization?.features?.pendingDocs ?? false;

  // Admin i user poden operar (superadmin es resol com admin). Viewer: només lectura.
  const canOperate = userRole === 'admin' || userRole === 'user';

  // Tab principal (liquidacions, tickets o quilometratge)
  const [mainTab, setMainTab] = React.useState<'liquidacions' | 'tickets' | 'quilometratge'>('liquidacions');

  // Tab de liquidacions
  const [activeTab, setActiveTab] = React.useState<'draft' | 'submitted' | 'matched' | 'archived'>('draft');

  // Liquidacions
  const [reports, setReports] = React.useState<ExpenseReport[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Creació
  const [isCreating, setIsCreating] = React.useState(false);

  // Modal confirmació arxivar
  const [reportToArchive, setReportToArchive] = React.useState<ExpenseReport | null>(null);
  const [isArchiving, setIsArchiving] = React.useState(false);
  const [isCheckingArchive, setIsCheckingArchive] = React.useState(false);

  // Modal "no es pot arxivar" (té tiquets pendents)
  const [cannotArchiveOpen, setCannotArchiveOpen] = React.useState(false);
  const [cannotArchivePendingCount, setCannotArchivePendingCount] = React.useState(0);
  const [cannotArchiveMatchedCount, setCannotArchiveMatchedCount] = React.useState(0);

  // Modal confirmació enviar
  const [reportToSubmit, setReportToSubmit] = React.useState<ExpenseReport | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Modal nota informativa
  const [isNoteOpen, setIsNoteOpen] = React.useState(false);

  // Subscripció a liquidacions
  React.useEffect(() => {
    if (!organizationId || !firestore || !isPendingDocsEnabled) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const unsubscribe = listenExpenseReports(
      firestore,
      organizationId,
      {}, // Tots els estats
      (data) => {
        setReports(data);
        setIsLoading(false);
      },
      (error) => {
        console.error('[LiquidacionsPage] Error:', error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [organizationId, firestore, isPendingDocsEnabled]);

  // Filtrar per tab
  const filteredReports = React.useMemo(() => {
    return reports.filter((r) => r.status === activeTab);
  }, [reports, activeTab]);

  // Comptadors
  const counts = React.useMemo(() => ({
    draft: reports.filter((r) => r.status === 'draft').length,
    submitted: reports.filter((r) => r.status === 'submitted').length,
    matched: reports.filter((r) => r.status === 'matched').length,
    archived: reports.filter((r) => r.status === 'archived').length,
  }), [reports]);

  // Crear nova liquidació
  const handleCreate = async () => {
    if (!canOperate || !organizationId || !firestore) return;

    setIsCreating(true);
    try {
      const reportId = await createExpenseReportDraft(firestore, organizationId);
      toast({
        title: t.expenseReports.toasts.created,
        description: t.expenseReports.toasts.createdDesc,
      });
      // Navegar al detall
      router.push(buildUrl(`/dashboard/movimientos/liquidacions/${reportId}`));
    } catch (error) {
      console.error('[handleCreate] Error:', error);
      toast({
        title: t.expenseReports.toasts.error,
        description: t.expenseReports.toasts.errorCreate,
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ARXIVAR (v1.36): Flux via API-first per garantir integritat referencial
  // Pre-check amb dryRun per detectar tiquets pendents
  // ═══════════════════════════════════════════════════════════════════════════
  const handleArchiveRequest = async (report: ExpenseReport) => {
    if (!canOperate || !organizationId || !user) return;

    setReportToArchive(report);
    setIsCheckingArchive(true);

    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/expense-reports/archive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          orgId: organizationId,
          reportId: report.id,
          dryRun: true,
        }),
      });

      const result = await response.json();

      if (result.success || result.code === 'OK_TO_ARCHIVE') {
        // OK: arxivar directament via API
        await handleArchiveConfirm(report);
      } else if (result.code === 'HAS_PENDING_TICKETS') {
        // Té tiquets pendents: mostrar modal informatiu
        setCannotArchivePendingCount(result.pendingCount || 0);
        setCannotArchiveMatchedCount(result.matchedCount || 0);
        setCannotArchiveOpen(true);
      } else if (result.code === 'IS_MATCHED') {
        // Liquidació conciliada: no es pot arxivar
        toast({
          variant: 'destructive',
          title: t.expenseReports.toasts.error,
          description: t.expenseReports?.cannotArchiveMatched ?? 'Una liquidació conciliada no es pot arxivar.',
        });
        setReportToArchive(null);
      } else {
        // Error genèric
        toast({
          variant: 'destructive',
          title: t.expenseReports.toasts.error,
          description: result.error || t.expenseReports.toasts.errorArchive,
        });
        setReportToArchive(null);
      }
    } catch (err) {
      console.error('[handleArchiveRequest] Error:', err);
      toast({
        variant: 'destructive',
        title: t.expenseReports.toasts.error,
        description: t.common.dbConnectionError,
      });
      setReportToArchive(null);
    } finally {
      setIsCheckingArchive(false);
    }
  };

  // Arxivar via API (sense dryRun)
  const handleArchiveConfirm = async (report: ExpenseReport) => {
    if (!canOperate || !organizationId || !user) {
      setReportToArchive(null);
      return;
    }

    setIsArchiving(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/expense-reports/archive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          orgId: organizationId,
          reportId: report.id,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({ title: t.expenseReports.toasts.archived });
      } else {
        toast({
          variant: 'destructive',
          title: t.expenseReports.toasts.error,
          description: result.error || t.expenseReports.toasts.errorArchive,
        });
      }
    } catch (err) {
      console.error('[handleArchiveConfirm] Error:', err);
      toast({
        variant: 'destructive',
        title: t.expenseReports.toasts.error,
        description: t.common.dbConnectionError,
      });
    } finally {
      setIsArchiving(false);
      setReportToArchive(null);
    }
  };

  // Marcar com enviada (amb confirmació)
  const handleSubmit = async () => {
    if (!canOperate || !organizationId || !firestore || !reportToSubmit) return;

    setIsSubmitting(true);
    try {
      await submitExpenseReport(firestore, organizationId, reportToSubmit.id);
      toast({ title: t.expenseReports.toasts.submittedSuccess });
      setReportToSubmit(null);
    } catch (error) {
      console.error('[handleSubmit] Error:', error);
      toast({
        title: t.expenseReports.toasts.error,
        description: t.expenseReports.toasts.submittedError,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Restaurar
  const handleRestore = async (report: ExpenseReport) => {
    if (!canOperate || !organizationId || !firestore) return;

    try {
      await restoreExpenseReport(firestore, organizationId, report.id, 'draft');
      toast({ title: t.expenseReports.toasts.restored });
    } catch (error) {
      console.error('[handleRestore] Error:', error);
      toast({
        title: t.expenseReports.toasts.error,
        description: t.expenseReports.toasts.errorRestore,
        variant: 'destructive',
      });
    }
  };

  // Editar (navegar al detall)
  const handleEdit = (report: ExpenseReport) => {
    if (!canOperate) return;
    router.push(buildUrl(`/dashboard/movimientos/liquidacions/${report.id}`));
  };

  // Si no té el feature activat, mostrar missatge
  if (!isPendingDocsEnabled) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href={buildUrl('/dashboard/movimientos')}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold font-headline">{t.expenseReports.title}</h1>
        </div>
        <EmptyState
          icon={FileText}
          title={t.expenseReports.featureDisabled}
          description={t.expenseReports.featureDisabledDesc}
        />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 pb-24 md:pb-0">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Link href={buildUrl('/dashboard/movimientos')}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <div>
              <h1 className="text-2xl font-bold font-headline">{t.expenseReports.title}</h1>
              <p className="text-muted-foreground text-sm">
                {t.expenseReports.subtitle}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsNoteOpen(true)}
              aria-label={trSafe('notes.liquidacions.aria', 'Informació sobre liquidacions')}
              title={trSafe('notes.liquidacions.tooltip', 'Nota informativa')}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <Info className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {canOperate && mainTab === 'liquidacions' && (
          <Button onClick={handleCreate} disabled={isCreating} className={MOBILE_CTA_PRIMARY}>
            {isCreating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            {t.expenseReports.actions.create}
          </Button>
        )}
      </div>

      {/* Tabs principals: Liquidacions / Tickets */}
      <Tabs className="w-full" value={mainTab} onValueChange={(v) => setMainTab(v as typeof mainTab)}>
        {/* Mobile: Select | Desktop: TabsList */}
        {isMobile ? (
          <Select value={mainTab} onValueChange={(v) => setMainTab(v as typeof mainTab)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="liquidacions">
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  {t.expenseReports.tabs.settlements}
                </span>
              </SelectItem>
              <SelectItem value="tickets">
                <span className="flex items-center gap-2">
                  <Receipt className="h-4 w-4" />
                  {t.expenseReports.tabs.tickets}
                </span>
              </SelectItem>
              <SelectItem value="quilometratge">
                <span className="flex items-center gap-2">
                  <Car className="h-4 w-4" />
                  {t.expenseReports.tabs.mileage}
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <TabsList>
            <TabsTrigger value="liquidacions" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {t.expenseReports.tabs.settlements}
            </TabsTrigger>
            <TabsTrigger value="tickets" className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              {t.expenseReports.tabs.tickets}
            </TabsTrigger>
            <TabsTrigger value="quilometratge" className="flex items-center gap-2">
              <Car className="h-4 w-4" />
              {t.expenseReports.tabs.mileage}
            </TabsTrigger>
          </TabsList>
        )}

        {/* Tab Liquidacions */}
        <TabsContent value="liquidacions" className="mt-4 w-full space-y-4">
          {/* Banner pre-banc */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>{t.expenseReports.banners.prebank}</AlertTitle>
            <AlertDescription>
              {t.expenseReports.banners.prebankDescription}
            </AlertDescription>
          </Alert>

          {/* Subtabs de liquidacions */}
          <Tabs className="w-full" value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            {/* Mobile: Select | Desktop: TabsList */}
            {isMobile ? (
              <Select value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">
                    <span className="flex items-center gap-2">
                      {t.expenseReports.tabs.draft}
                      {counts.draft > 0 && <Badge variant="outline">{counts.draft}</Badge>}
                    </span>
                  </SelectItem>
                  <SelectItem value="submitted">
                    <span className="flex items-center gap-2">
                      {t.expenseReports.tabs.submitted}
                      {counts.submitted > 0 && <Badge variant="outline">{counts.submitted}</Badge>}
                    </span>
                  </SelectItem>
                  <SelectItem value="matched">
                    <span className="flex items-center gap-2">
                      {t.expenseReports.tabs.matched}
                      {counts.matched > 0 && <Badge variant="outline">{counts.matched}</Badge>}
                    </span>
                  </SelectItem>
                  <SelectItem value="archived">
                    <span className="flex items-center gap-2">
                      {t.expenseReports.tabs.archived}
                      {counts.archived > 0 && <Badge variant="outline">{counts.archived}</Badge>}
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <TabsList>
                <TabsTrigger value="draft">
                  {t.expenseReports.tabs.draft}
                  {counts.draft > 0 && <Badge variant="outline" className="ml-2">{counts.draft}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="submitted">
                  {t.expenseReports.tabs.submitted}
                  {counts.submitted > 0 && <Badge variant="outline" className="ml-2">{counts.submitted}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="matched">
                  {t.expenseReports.tabs.matched}
                  {counts.matched > 0 && <Badge variant="outline" className="ml-2">{counts.matched}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="archived">
                  {t.expenseReports.tabs.archived}
                  {counts.archived > 0 && <Badge variant="outline" className="ml-2">{counts.archived}</Badge>}
                </TabsTrigger>
              </TabsList>
            )}

            <TabsContent value={activeTab} className="mt-4 w-full">
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : filteredReports.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title={(t.expenseReports.empty as Record<string, string>)[activeTab]}
                  description={(t.expenseReports.empty as Record<string, string>)[`${activeTab}Desc`]}
                />
              ) : (
                <div className="space-y-2">
                  {filteredReports.map((report) => (
                    <Card
                      key={report.id}
                      className="hover:shadow-sm transition-shadow cursor-pointer"
                      onClick={() => router.push(buildUrl(`/dashboard/movimientos/liquidacions/${report.id}`))}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="font-medium">
                                {report.title || t.expenseReports.empty.noTitle}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {formatDateRange(report.dateFrom, report.dateTo)}
                                {report.receiptDocIds.length > 0 && (
                                  <span className="ml-2">· {t.expenseReports.details.receipts({ count: report.receiptDocIds.length })}</span>
                                )}
                                {report.mileage?.km && (
                                  <span className="ml-2">· {t.expenseReports.details.km({ km: report.mileage.km })}</span>
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground/70 mt-0.5">
                                {getStatusInfo(report, t).tooltip}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 md:gap-3">
                            <span className="font-semibold text-sm md:text-base">
                              {formatCurrencyEU(report.totalAmount)}
                            </span>
                            <div className="hidden md:flex items-center gap-1" title={getStatusInfo(report, t).tooltip}>
                              {getStatusInfo(report, t).badge}
                            </div>

                            {/* Mobile: DropdownMenu amb totes les accions */}
                            {canOperate && (isMobile ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {/* Editar - draft i submitted */}
                                  {(report.status === 'draft' || report.status === 'submitted') && (
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEdit(report);
                                      }}
                                    >
                                      <Pencil className="mr-2 h-4 w-4" />
                                      {t.common.edit}
                                    </DropdownMenuItem>
                                  )}
                                  {/* Marcar com enviada - només draft */}
                                  {report.status === 'draft' && (
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setReportToSubmit(report);
                                      }}
                                      className="text-blue-600"
                                    >
                                      <Send className="mr-2 h-4 w-4" />
                                      {t.expenseReports.actions.submit}
                                    </DropdownMenuItem>
                                  )}
                                  {/* Arxivar - draft i submitted sense SEPA (v1.36: via API) */}
                                  {(report.status === 'draft' || report.status === 'submitted') && !report.sepa && (
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleArchiveRequest(report);
                                      }}
                                      disabled={isCheckingArchive || isArchiving}
                                    >
                                      <Archive className="mr-2 h-4 w-4" />
                                      {t.common.archive}
                                    </DropdownMenuItem>
                                  )}
                                  {/* Restaurar - archived */}
                                  {report.status === 'archived' && (
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRestore(report);
                                      }}
                                    >
                                      <RotateCcw className="mr-2 h-4 w-4" />
                                      {t.common.restore}
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (
                              /* Desktop: botons inline */
                              <>
                                {/* Editar - draft i submitted */}
                                {(report.status === 'draft' || report.status === 'submitted') && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEdit(report);
                                    }}
                                    title={t.common.edit}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                )}
                                {/* Marcar com enviada - només draft */}
                                {report.status === 'draft' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setReportToSubmit(report);
                                    }}
                                    title={t.expenseReports.actions.markAsSubmitted}
                                    className="text-blue-600 border-blue-200 hover:bg-blue-50"
                                  >
                                    <Send className="h-4 w-4 mr-1" />
                                    {t.expenseReports.actions.submit}
                                  </Button>
                                )}
                                {/* Arxivar - draft i submitted sense SEPA (v1.36: via API) */}
                                {(report.status === 'draft' || report.status === 'submitted') && !report.sepa && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleArchiveRequest(report);
                                    }}
                                    title={t.common.archive}
                                    disabled={isCheckingArchive || isArchiving}
                                  >
                                    <Archive className="h-4 w-4" />
                                  </Button>
                                )}
                                {report.status === 'archived' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRestore(report);
                                    }}
                                    title={t.common.restore}
                                  >
                                    <RotateCcw className="h-4 w-4" />
                                  </Button>
                                )}
                              </>
                            ))}
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Tab Tickets */}
        <TabsContent value="tickets" className="mt-4 w-full">
          {organizationId && firestore && storage && (
            <TicketsInbox
              firestore={firestore}
              storage={storage}
              organizationId={organizationId}
              canOperate={canOperate}
            />
          )}
        </TabsContent>

        {/* Tab Quilometratge */}
        <TabsContent value="quilometratge" className="mt-4 w-full space-y-4">
          <Alert>
            <Car className="h-4 w-4" />
            <AlertTitle>{t.expenseReports.tabs.mileage}</AlertTitle>
            <AlertDescription>
              {t.expenseReports.mileage.onlyMileageHere}{' '}
              <button
                type="button"
                className="underline hover:no-underline font-medium"
                onClick={() => setMainTab('liquidacions')}
              >
                {t.expenseReports.tabs.settlements}
              </button>
              .
            </AlertDescription>
          </Alert>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : reports.filter((r) => r.status === 'draft' || r.status === 'submitted').length === 0 ? (
            <EmptyState
              icon={Car}
              title={t.expenseReports.emptyState.noSettlements}
              description={t.expenseReports.emptyState.createToAddMileage}
            />
          ) : (
            <div className="space-y-2">
              {reports
                .filter((r) => r.status === 'draft' || r.status === 'submitted')
                .map((report) => {
                  const mileageTotal = report.mileageItems?.reduce((sum, item) => sum + item.totalEur, 0) ?? 0;
                  const mileageCount = report.mileageItems?.length ?? 0;

                  return (
                    <Card key={report.id} className="transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <Car className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="font-medium">
                                {report.title || t.expenseReports.empty.noTitle}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {formatDateRange(report.dateFrom, report.dateTo)}
                                {mileageCount > 0 && (
                                  <span className="ml-2">
                                    · {t.expenseReports.mileage?.lineCount?.({ count: mileageCount }) ?? `${mileageCount} línies`}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {mileageCount > 0 && (
                              <span className="font-semibold">
                                {formatCurrencyEU(mileageTotal)}
                              </span>
                            )}
                            <div className="flex items-center gap-1">
                              {getStatusInfo(report, t).badge}
                            </div>
                            {canOperate && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => router.push(buildUrl(`/dashboard/movimientos/liquidacions/${report.id}?tab=kilometratge`))}
                              >
                                <Car className="mr-2 h-4 w-4" />
                                {t.expenseReports.actions.manageMileage}
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modal confirmació enviar */}
      <AlertDialog open={!!reportToSubmit} onOpenChange={(open) => !open && setReportToSubmit(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.expenseReports.actions.markAsSubmitted}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.expenseReports.confirmSubmit?.description ?? ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>
              {t.common.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              {t.expenseReports.actions.confirmSubmit}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal informatiu: no es pot arxivar (té tiquets pendents) */}
      <AlertDialog open={cannotArchiveOpen} onOpenChange={(open) => {
        setCannotArchiveOpen(open);
        if (!open) setReportToArchive(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t.expenseReports?.cannotArchiveTitle ?? 'No es pot arxivar'}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                {t.expenseReports?.cannotArchiveIntro?.(reportToArchive?.title || '') ??
                  `Aquesta liquidació té tiquets associats:`}
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong>{t.expenseReports?.pendingTicketsLabel ?? 'Tiquets pendents'}:</strong> {cannotArchivePendingCount}
                  {cannotArchivePendingCount > 0 && (
                    <span className="text-destructive ml-1">
                      ({t.expenseReports?.blocksArchive ?? "bloqueja l'arxivat"})
                    </span>
                  )}
                </li>
                {cannotArchiveMatchedCount > 0 && (
                  <li>
                    <strong>{t.expenseReports?.matchedTicketsLabel ?? 'Tiquets conciliats'}:</strong> {cannotArchiveMatchedCount}
                  </li>
                )}
              </ul>
              <p className="text-sm text-muted-foreground mt-2">
                {t.expenseReports?.cannotArchiveHelp ?? "Cal treure els tiquets pendents de la liquidació abans d'arxivar-la."}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => {
              setCannotArchiveOpen(false);
              setReportToArchive(null);
            }}>
              {t.common?.close ?? 'Tancar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog nota informativa */}
      <Dialog open={isNoteOpen} onOpenChange={setIsNoteOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>{trSafe('notes.liquidacions.title', 'Una nota sobre liquidacions')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="bg-white rounded-md border border-primary/20 p-2">
              <img
                src="/visuals/marca/doodle_liquidac.png"
                alt={trSafe('notes.liquidacions.imageAlt', 'Il·lustració sobre liquidacions')}
                className="w-full max-w-full max-h-[160px] sm:max-h-[200px] object-contain"
              />
            </div>
            <div className="text-sm text-muted-foreground leading-relaxed space-y-2 break-words">
              <p>{trSafe('notes.liquidacions.body.0', 'Quan estàs en ruta, no penses en liquidacions. Penses en arribar, en resoldre, en continuar.')}</p>
              <p>{trSafe('notes.liquidacions.body.1', 'Si guardes el tiquet quan passa, no t\'estàs organitzant: t\'estàs estalviant haver de reconstruir-ho després.')}</p>
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" onClick={() => setIsNoteOpen(false)}>
              {trSafe('notes.common.close', 'Tancar')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
