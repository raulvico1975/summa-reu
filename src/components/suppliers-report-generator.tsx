'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Download, Loader2, Building2, AlertTriangle, Ban, FileText, Eye, Mail, Copy } from 'lucide-react';
import type { Supplier, Transaction, AnyContact, Category } from '@/lib/data';
import { formatCurrencyEU } from '@/lib/normalize';
import { useToast } from '@/hooks/use-toast';
import Papa from 'papaparse';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { useTranslations } from '@/i18n';
import { useCurrentOrganization } from '@/hooks/organization-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { MobileListItem } from '@/components/mobile/mobile-list-item';
import { cn } from '@/lib/utils';
import { MOBILE_ACTIONS_BAR, MOBILE_CTA_PRIMARY } from '@/lib/ui/mobile-actions';
import {
  computeModel347,
  THRESHOLD_347,
  type Model347Result,
  type SupplierAggregate,
  type CandidateTransaction,
} from '@/lib/reports/model347';
import {
  encodeLatin1,
  type AEAT347ExcludedSupplier,
  type AEAT347ExportResult,
} from '@/lib/reports/model347-aeat';

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export function SuppliersReportGenerator() {
  const { firestore, auth } = useFirebase();
  const { organizationId, organization } = useCurrentOrganization();
  const { can } = usePermissions();
  const { t, language } = useTranslations();
  const isMobile = useIsMobile();
  const canGenerateModel347 = can('fiscal.model347.generar');
  const canExportReports = can('informes.exportar');

  // ── Queries Firestore ──
  const transactionsQuery = useMemoFirebase(
    () => organizationId ? collection(firestore, 'organizations', organizationId, 'transactions') : null,
    [firestore, organizationId]
  );
  const contactsQuery = useMemoFirebase(
    () => organizationId ? collection(firestore, 'organizations', organizationId, 'contacts') : null,
    [firestore, organizationId]
  );
  const categoriesQuery = useMemoFirebase(
    () => organizationId ? collection(firestore, 'organizations', organizationId, 'categories') : null,
    [firestore, organizationId]
  );
  const { data: transactions } = useCollection<Transaction>(transactionsQuery);
  const { data: contacts } = useCollection<AnyContact>(contactsQuery);
  const { data: categories } = useCollection<Category>(categoriesQuery);

  // Filtrar proveïdors + transaccions actives (sense archivedAt)
  const suppliers = React.useMemo(() =>
    (contacts?.filter(c => c.type === 'supplier') as Supplier[]) || [],
  [contacts]);

  const activeTxs = React.useMemo(() =>
    transactions?.filter(tx => !tx.archivedAt) || [],
  [transactions]);

  // ── Estat ──
  const [selectedYear, setSelectedYear] = React.useState<string>(String(new Date().getFullYear() - 1));
  const [isGenerated, setIsGenerated] = React.useState(false);
  const [excludedTxIds, setExcludedTxIds] = React.useState<Set<string>>(new Set());
  const [excludedSupplierKeys, setExcludedSupplierKeys] = React.useState<Set<string>>(new Set());
  const [detailAggregate, setDetailAggregate] = React.useState<SupplierAggregate | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = React.useState(false);
  const [emailAggregate, setEmailAggregate] = React.useState<SupplierAggregate | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = React.useState(false);
  const [aeatExcludedDialogOpen, setAeatExcludedDialogOpen] = React.useState(false);
  const [aeatPendingExport, setAeatPendingExport] = React.useState<AEAT347ExportResult | null>(null);
  const { toast } = useToast();

  const formatCurrencyNoBreak = React.useCallback((value: number | string | null | undefined) => {
    return formatCurrencyEU(value).replace(' €', '\u00A0€');
  }, []);

  // ── Anys disponibles ──
  const availableYears = React.useMemo(() => {
    if (!activeTxs.length) return [];
    const years = new Set(activeTxs.map(tx => new Date(tx.date).getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
  }, [activeTxs]);

  // ── Càlcul del Model 347 ──
  const model347: Model347Result | null = React.useMemo(() => {
    if (!isGenerated) return null;
    const year = parseInt(selectedYear, 10);
    return computeModel347(activeTxs, suppliers, categories || [], year, excludedTxIds);
  }, [isGenerated, selectedYear, activeTxs, suppliers, categories, excludedTxIds]);

  // Filtrar per proveïdors exclosos manualment
  const effectiveExpenses = React.useMemo(() =>
    model347?.expenses.filter(a => !excludedSupplierKeys.has(`${a.contactId}:expense`)) || [],
  [model347, excludedSupplierKeys]);

  const effectiveIncome = React.useMemo(() =>
    model347?.income.filter(a => !excludedSupplierKeys.has(`${a.contactId}:income`)) || [],
  [model347, excludedSupplierKeys]);

  // Stats
  const stats = React.useMemo(() => {
    if (!model347) return null;
    return {
      expenseSuppliers: effectiveExpenses.length,
      expenseTotal: effectiveExpenses.reduce((s, a) => s + a.quarters.total, 0),
      incomeSuppliers: effectiveIncome.length,
      incomeTotal: effectiveIncome.reduce((s, a) => s + a.quarters.total, 0),
      excludedCount: excludedSupplierKeys.size,
      suppliersWithoutTaxId: [
        ...effectiveExpenses.filter(a => !a.taxId),
        ...effectiveIncome.filter(a => !a.taxId),
      ],
    };
  }, [model347, effectiveExpenses, effectiveIncome, excludedSupplierKeys]);

  // ── Handlers ──
  const handleGenerate = () => {
    if (!canGenerateModel347) {
      toast({ variant: 'destructive', title: t.common.error, description: 'No tens permisos per generar el model 347.' });
      return;
    }
    if (!activeTxs.length || !contacts) {
      toast({ variant: 'destructive', title: t.reports.dataNotAvailable, description: t.reports.dataNotAvailableDescription });
      return;
    }
    const year = parseInt(selectedYear, 10);
    const preview = computeModel347(activeTxs, suppliers, categories || [], year, new Set());
    const previewCount = preview.expenses.length + preview.income.length;
    setExcludedTxIds(new Set());
    setExcludedSupplierKeys(new Set());
    setIsGenerated(true);
    toast({
      title: t.reports.reportGenerated,
      description: t.reports.suppliersReportGeneratedDescription(selectedYear, previewCount),
    });
  };

  const toggleSupplierExclusion = (contactId: string, direction: string) => {
    const key = `${contactId}:${direction}`;
    setExcludedSupplierKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleTxExclusion = (txId: string) => {
    setExcludedTxIds(prev => {
      const next = new Set(prev);
      if (next.has(txId)) next.delete(txId); else next.add(txId);
      return next;
    });
  };

  const openDetail = (aggregate: SupplierAggregate) => {
    setDetailAggregate(aggregate);
    setDetailDialogOpen(true);
  };

  const openEmailDraft = (aggregate: SupplierAggregate) => {
    setEmailAggregate(aggregate);
    setEmailDialogOpen(true);
  };

  const emailDraft = React.useMemo(() => {
    if (!emailAggregate) return null;

    const reportYear = Number.parseInt(selectedYear, 10);
    const validYear = Number.isFinite(reportYear) ? reportYear : new Date().getFullYear() - 1;
    const deadline = `24/02/${validYear + 1}`;

    const subject = `Coordinació Model 347 exercici ${validYear} · ${emailAggregate.name}`;
    const body = [
      'Benvolguts,',
      '',
      `Amb motiu de la preparació del Model 347 (declaració anual d’operacions amb terceres persones) corresponent a l’exercici ${validYear}, ens posem en contacte amb vosaltres per tal de verificar i coordinar les dades de facturació entre les nostres entitats.`,
      '',
      'Com sabeu, aquesta declaració informativa inclou el volum anual d’operacions que superen els 3.005,06 €, desglossades per trimestres naturals. Per aquest motiu, és important que les dades declarades per ambdues parts siguin coincidents.',
      '',
      'Us facilitem a continuació el resum de les operacions registrades a la nostra comptabilitat:',
      '',
      `• 1r trimestre: ${formatCurrencyEU(emailAggregate.quarters.q1)}`,
      `• 2n trimestre: ${formatCurrencyEU(emailAggregate.quarters.q2)}`,
      `• 3r trimestre: ${formatCurrencyEU(emailAggregate.quarters.q3)}`,
      `• 4t trimestre: ${formatCurrencyEU(emailAggregate.quarters.q4)}`,
      `• Total anual: ${formatCurrencyEU(emailAggregate.quarters.total)}`,
      '',
      `Us agrairem que reviseu aquestes dades i ens confirmeu si coincideixen amb els vostres registres, o bé que ens indiqueu qualsevol diferència detectada abans del dia ${deadline} per tal de poder fer les comprovacions necessàries amb antelació a la presentació del model.`,
      '',
      'Aquesta coordinació té com a únic objectiu evitar discrepàncies en la informació declarada davant l’Agència Tributària.',
      '',
      'Restem a la vostra disposició per a qualsevol aclariment.',
      '',
      'Moltes gràcies per la col·laboració,',
    ].join('\n');

    return { subject, body };
  }, [emailAggregate, selectedYear]);

  const handleCopyEmailDraft = React.useCallback(async () => {
    if (!emailDraft) return;
    const payload = `Assumpte: ${emailDraft.subject}\n\n${emailDraft.body}`;

    try {
      await navigator.clipboard.writeText(payload);
      toast({
        title: t.reports.model347EmailCopiedTitle,
        description: t.reports.model347EmailCopiedDescription,
      });
    } catch {
      toast({
        variant: 'destructive',
        title: t.reports.model347EmailCopyErrorTitle,
        description: t.reports.model347EmailCopyErrorDescription,
      });
    }
  }, [emailDraft, t.reports.model347EmailCopiedDescription, t.reports.model347EmailCopiedTitle, t.reports.model347EmailCopyErrorDescription, t.reports.model347EmailCopyErrorTitle, toast]);

  // ── Export CSV ──
  const handleExportCSV = () => {
    if (!canGenerateModel347 || !canExportReports) {
      toast({ variant: 'destructive', title: t.common.error, description: 'No tens permisos per exportar informes.' });
      return;
    }
    const allRows = [
      ...effectiveExpenses.map(a => ({ ...a, tipo: t.reports.model347TypeExpense })),
      ...effectiveIncome.map(a => ({ ...a, tipo: t.reports.model347TypeIncome })),
    ];

    if (allRows.length === 0) {
      toast({ variant: 'destructive', title: t.reports.noDataToExport, description: t.reports.noDataToExportDescription });
      return;
    }

    const csvData = allRows
      .filter(row => row.taxId)
      .map(row => ({
        [t.reports.supplierTaxId]: row.taxId,
        [t.reports.supplierName]: row.name,
        [t.reports.model347Q1]: row.quarters.q1.toFixed(2),
        [t.reports.model347Q2]: row.quarters.q2.toFixed(2),
        [t.reports.model347Q3]: row.quarters.q3.toFixed(2),
        [t.reports.model347Q4]: row.quarters.q4.toFixed(2),
        [t.reports.totalAmount]: row.quarters.total.toFixed(2),
        'Tipus': row.tipo,
      }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', t.reports.model347CsvFileName({ year: selectedYear }));
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({ presentation: 'centered-success', title: t.reports.exportComplete, description: t.reports.exportCompleteDescription });
  };

  // ── Export AEAT ──
  const handleExportAEAT = async () => {
    if (!canGenerateModel347 || !canExportReports) {
      toast({ variant: 'destructive', title: t.common.error, description: 'No tens permisos per exportar informes.' });
      return;
    }
    if (!organizationId) return;

    let result: AEAT347ExportResult;
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/fiscal/model347/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          orgId: organizationId,
          year: parseInt(selectedYear, 10),
          excludedTxIds: Array.from(excludedTxIds),
          excludedSupplierKeys: Array.from(excludedSupplierKeys),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ variant: 'destructive', title: t.common.error, description: err.error ?? `Error ${res.status}` });
        return;
      }
      result = (await res.json()) as AEAT347ExportResult;
    } catch {
      toast({ variant: 'destructive', title: t.common.error, description: 'Error de connexió en generar el fitxer.' });
      return;
    }

    // Errors bloquejants
    if (result.errors.length > 0) {
      toast({
        variant: 'destructive',
        title: t.reports.model347AEATMissingData,
        description: result.errors.join('\n'),
      });
      return;
    }

    // Si hi ha exclosos → dialog
    if (result.excludedCount > 0) {
      setAeatPendingExport(result);
      setAeatExcludedDialogOpen(true);
      return;
    }

    // Download directe
    downloadAEATFile(result.content, {
      includedCount: result.includedCount,
      excludedCount: result.excludedCount,
    });
  };

  const downloadAEATFile = (
    content: string,
    summary?: { includedCount: number; excludedCount: number }
  ) => {
    const encoded = encodeLatin1(content);
    if (encoded.error) {
      toast({ variant: 'destructive', title: t.reports.model347AEATEncodingError, description: encoded.error });
      return;
    }

    const bytesBuffer = encoded.bytes.buffer.slice(
      encoded.bytes.byteOffset,
      encoded.bytes.byteOffset + encoded.bytes.byteLength
    ) as ArrayBuffer;
    const blob = new Blob([bytesBuffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = t.reports.model347AEATFileName({ year: selectedYear });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      presentation: 'centered-success',
      title: t.reports.exportComplete,
      description: t.reports.model347AEATExcludedDesc(
        summary?.includedCount ?? 0,
        summary?.excludedCount ?? 0
      ),
    });

    setAeatExcludedDialogOpen(false);
    setAeatPendingExport(null);
  };

  const handleConfirmAEATExport = () => {
    if (!aeatPendingExport) return;
    downloadAEATFile(aeatPendingExport.content, {
      includedCount: aeatPendingExport.includedCount,
      excludedCount: aeatPendingExport.excludedCount,
    });
  };

  const handleDownloadExcludedCsv = () => {
    if (!aeatPendingExport?.excluded.length) return;

    const headers = ['Nom', 'NIF', 'Problema'];
    const rows = aeatPendingExport.excluded.map(exc => [
      exc.name,
      exc.taxIdRaw || '',
      exc.issueCodes.map(code => t.reports.model347AEATIssueLabel(code, exc.issueMeta)).join('; '),
    ]);

    const csvContent = '\uFEFF' + [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `model347_exclosos_${selectedYear}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const hasData = model347 && (model347.expenses.length > 0 || model347.income.length > 0);
  const isPortuguese = language === 'pt';
  const model347DetailTitle = (name: string) => (
    isPortuguese ? `Transacoes de ${name}` : t.reports.model347DetailTitle(name)
  );
  const model347DetailDescription = isPortuguese
    ? 'Desmarque as transacoes que nao devem ser incluidas no Modelo 347.'
    : t.reports.model347DetailDescription;
  const model347EmailDialogTitle = isPortuguese
    ? 'Texto de email de confirmacao (Modelo 347)'
    : t.reports.model347EmailDialogTitle;
  const model347EmailDialogDescription = (supplierName: string) => (
    isPortuguese
      ? `Reveja e copie o texto para o enviar a ${supplierName}.`
      : t.reports.model347EmailDialogDescription(supplierName)
  );
  const model347EmailDialogDescriptionFallback = isPortuguese
    ? 'Reveja e copie o texto para o enviar ao fornecedor.'
    : t.reports.model347EmailDialogDescriptionFallback;
  const model347ExcludedDialogTitle = isPortuguese
    ? 'Ha fornecedores excluidos'
    : t.reports.model347AEATExcludedDialogTitle;
  const model347ExcludedDialogDesc = (included: number, excluded: number) => (
    isPortuguese
      ? `O ficheiro AEAT incluira ${included} fornecedores. ${excluded} ${excluded === 1 ? 'fornecedor sera excluido por dados incompletos.' : 'fornecedores serao excluidos por dados incompletos.'}`
      : t.reports.model347AEATExcludedDialogDesc(included, excluded)
  );
  const model347ExcludedHelp = isPortuguese
    ? 'Pode transferir a lista para corrigir os dados dos fornecedores antes de apresentar o 347.'
    : t.reports.model347AEATExcludedHelp;
  const model347DownloadExcludedCsv = isPortuguese
    ? 'Transferir excluidos (CSV)'
    : t.reports.model347DownloadExcludedCsv;
  const model347ExportAnyway = isPortuguese
    ? 'Exportar mesmo assim'
    : t.reports.model347ExportAnyway;
  const model347CancelToFix = isPortuguese
    ? 'Cancelar e rever dados'
    : t.reports.model347CancelToFix;
  const missingTaxIdLabel = isPortuguese
    ? 'sem NIF'
    : t.reports.missingTaxId;
  const model347IssueLabel = (code: string, meta?: { taxIdLength?: number }) => {
    if (!isPortuguese) {
      return t.reports.model347AEATIssueLabel(code, meta);
    }
    switch (code) {
      case 'TAXID_EMPTY': return 'NIF/CIF em falta';
      case 'TAXID_INVALID_CHARS': return 'NIF/CIF com caracteres invalidos';
      case 'TAXID_INVALID_LENGTH': return `NIF/CIF com comprimento incorreto (${meta?.taxIdLength ?? '?'})`;
      case 'PROVINCE_CODE_MISSING': return 'codigo de provincia indisponivel (e preciso um CP valido)';
      default: return code;
    }
  };
  const model347PreviewMoreLabel = (count: number) => (
    isPortuguese ? `... e mais ${count}` : `… i ${count} més`
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-500" />
              {t.reports.suppliersReportTitle}
            </CardTitle>
            <CardDescription>{t.reports.suppliersReportDescription}</CardDescription>
          </div>
          <div className={cn(MOBILE_ACTIONS_BAR, "sm:justify-end")}>
            <Select value={selectedYear} onValueChange={v => { setSelectedYear(v); setIsGenerated(false); }}>
              <SelectTrigger className={MOBILE_CTA_PRIMARY}>
                <SelectValue placeholder={t.reports.selectYear} />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map(year => (
                  <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleGenerate} className={MOBILE_CTA_PRIMARY} disabled={!canGenerateModel347}>
              {t.reports.generate}
            </Button>
            <Button variant="outline" onClick={handleExportCSV} disabled={!hasData || !canGenerateModel347 || !canExportReports} className={MOBILE_CTA_PRIMARY}>
              <Download className="mr-2 h-4 w-4" />
              {t.reports.exportCsv}
            </Button>
            <Button variant="outline" onClick={handleExportAEAT} disabled={!hasData || !canGenerateModel347 || !canExportReports} className={MOBILE_CTA_PRIMARY} title={t.reports.model347ExportAEATTooltip}>
              <FileText className="mr-2 h-4 w-4" />
              {t.reports.model347ExportAEAT}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ── Avís de retencions ── */}
        {hasData && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Model 347</AlertTitle>
            <AlertDescription>
              {t.reports.model347WithholdingWarning}
            </AlertDescription>
          </Alert>
        )}

        {/* ── Proveïdors sense NIF ── */}
        {stats && stats.suppliersWithoutTaxId.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{t.reports.suppliersWithoutTaxId}</AlertTitle>
            <AlertDescription>
              {t.reports.suppliersWithoutTaxIdDescription}
              <ul className="mt-2 list-disc list-inside">
                {stats.suppliersWithoutTaxId.map(a => (
                  <li key={a.contactId}>{a.name}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* ── Stats ── */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-600 font-medium">{t.reports.includedSuppliers}</p>
              <p className="text-2xl font-bold text-blue-700">{stats.expenseSuppliers}</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-600 font-medium">{t.reports.totalAmount}</p>
              <p className="text-2xl font-bold text-blue-700 whitespace-nowrap">{formatCurrencyNoBreak(stats.expenseTotal)}</p>
            </div>
            {stats.incomeSuppliers > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-xs text-green-600 font-medium">{t.reports.model347SectionIncome}</p>
                <p className="text-2xl font-bold text-green-700 whitespace-nowrap">{stats.incomeSuppliers} — {formatCurrencyNoBreak(stats.incomeTotal)}</p>
              </div>
            )}
            {stats.excludedCount > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p className="text-xs text-orange-600 font-medium">{t.reports.excludedSuppliers}</p>
                <p className="text-2xl font-bold text-orange-700">{stats.excludedCount}</p>
              </div>
            )}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <p className="text-xs text-gray-600 font-medium">{t.reports.threshold347}</p>
              <p className="text-2xl font-bold text-gray-700 whitespace-nowrap">{formatCurrencyNoBreak(THRESHOLD_347)}</p>
            </div>
          </div>
        )}

        {/* ── Secció: Pagaments a proveïdors ── */}
        {model347 && (
          <SupplierSection
            title={t.reports.model347SectionExpenses}
            aggregates={model347.expenses}
            effectiveAggregates={effectiveExpenses}
            direction="expense"
            excludedKeys={excludedSupplierKeys}
            toggleExclusion={toggleSupplierExclusion}
            onOpenDetail={openDetail}
            onOpenEmailDraft={openEmailDraft}
            isMobile={isMobile}
            t={t}
            formatCurrencyNoBreak={formatCurrencyNoBreak}
          />
        )}

        {/* ── Secció: Ingressos ── */}
        {model347 && model347.income.length > 0 && (
          <SupplierSection
            title={t.reports.model347SectionIncome}
            aggregates={model347.income}
            effectiveAggregates={effectiveIncome}
            direction="income"
            excludedKeys={excludedSupplierKeys}
            toggleExclusion={toggleSupplierExclusion}
            onOpenDetail={openDetail}
            onOpenEmailDraft={openEmailDraft}
            isMobile={isMobile}
            t={t}
            formatCurrencyNoBreak={formatCurrencyNoBreak}
          />
        )}

        {/* ── Estat buit ── */}
        {model347 && model347.expenses.length === 0 && model347.income.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            {t.reports.noSuppliersAboveThreshold}
          </div>
        )}

        {!isGenerated && (
          <div className="text-center text-muted-foreground py-8">
            {t.reports.noData}
          </div>
        )}

        {/* ── Nota informativa ── */}
        {hasData && (
          <p className="text-xs text-muted-foreground">
            {t.reports.model347Note}
          </p>
        )}
      </CardContent>

      {/* ═══════════════════════════════════════════════════════════════════════
          DIALOG DETALL TRANSACCIONS
          ═══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="grid w-[min(calc(100vw-2rem),60rem)] max-w-[calc(100vw-2rem)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:w-[min(calc(100vw-3rem),60rem)]">
          <DialogHeader className="border-b px-6 pb-4 pt-6">
            <DialogTitle>
              {detailAggregate && model347DetailTitle(detailAggregate.name)}
            </DialogTitle>
            <DialogDescription>
              {model347DetailDescription}
            </DialogDescription>
          </DialogHeader>

          {detailAggregate && (
            <div className="min-h-0 overflow-auto px-6 py-5">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">{t.reports.include}</TableHead>
                    <TableHead className="w-[90px]">Data</TableHead>
                    <TableHead>Concepte</TableHead>
                    <TableHead className="text-right w-[100px]">Import</TableHead>
                    <TableHead className="w-[120px]">Categoria</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailAggregate.transactions.map(tx => {
                    const isExcluded = excludedTxIds.has(tx.id);
                    return (
                      <TableRow key={tx.id} className={isExcluded ? 'opacity-50 bg-muted/30' : ''}>
                        <TableCell>
                          <Checkbox
                            checked={!isExcluded}
                            onCheckedChange={() => toggleTxExclusion(tx.id)}
                          />
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          {new Date(tx.date).toLocaleDateString('ca-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                        </TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate">{tx.description}</TableCell>
                        <TableCell className={cn('text-right font-mono text-sm whitespace-nowrap', isExcluded && 'line-through')}>
                          {formatCurrencyNoBreak(tx.amount)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {tx.categoryName ?? t.reports.model347NoCategory}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════════
          DIALOG EMAIL CONFIRMACIÓ 347
          ═══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="grid w-[min(calc(100vw-2rem),60rem)] max-w-[calc(100vw-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:w-[min(calc(100vw-3rem),60rem)]">
          <DialogHeader className="border-b px-6 pb-4 pt-6">
            <DialogTitle>{model347EmailDialogTitle}</DialogTitle>
            <DialogDescription>
              {emailAggregate
                ? model347EmailDialogDescription(emailAggregate.name)
                : model347EmailDialogDescriptionFallback}
            </DialogDescription>
          </DialogHeader>

          {emailDraft && (
            <div className="min-h-0 space-y-3 overflow-auto px-6 py-5">
              <div className="rounded-md border bg-muted/20 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t.reports.model347EmailSubjectLabel}
                </p>
                <p className="text-sm font-medium break-words">{emailDraft.subject}</p>
              </div>

              <div className="rounded-md border bg-muted/20 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                  {t.reports.model347EmailBodyLabel}
                </p>
                <pre className="text-sm whitespace-pre-wrap break-words font-sans leading-relaxed">
                  {emailDraft.body}
                </pre>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 border-t bg-muted/10 px-6 py-4">
            <Button variant="outline" onClick={handleCopyEmailDraft} className="w-full sm:w-auto">
              <Copy className="mr-2 h-4 w-4" />
              {t.reports.model347EmailCopyButton}
            </Button>
            <Button variant="ghost" onClick={() => setEmailDialogOpen(false)} className="w-full sm:w-auto">
              {t.common.close}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════════
          DIALOG EXCLOSOS AEAT
          ═══════════════════════════════════════════════════════════════════════ */}
      <Dialog
        open={aeatExcludedDialogOpen}
        onOpenChange={(open) => {
          setAeatExcludedDialogOpen(open);
          if (!open) {
            setAeatPendingExport(null);
          }
        }}
      >
        <DialogContent className="grid w-[min(calc(100vw-2rem),60rem)] max-w-[calc(100vw-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:w-[min(calc(100vw-3rem),60rem)]">
          <DialogHeader className="gap-2 border-b px-6 pb-4 pt-6">
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {model347ExcludedDialogTitle}
            </DialogTitle>
            <DialogDescription>
              {aeatPendingExport && model347ExcludedDialogDesc(
                aeatPendingExport.includedCount,
                aeatPendingExport.excludedCount
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 space-y-4 overflow-auto px-6 py-5">
            {aeatPendingExport && aeatPendingExport.excludedCount > 0 && (
              <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                <ul className="space-y-3">
                  {aeatPendingExport.excluded.slice(0, 5).map((exc, i) => {
                    const issuesText = exc.issueCodes
                      .map(code => model347IssueLabel(code, exc.issueMeta))
                      .join('; ');
                      return (
                        <li key={i} className="text-sm leading-relaxed break-words whitespace-normal min-w-0">
                          <span className="font-medium text-foreground">{exc.name}</span>
                          {' — '}
                          <span className="font-mono break-all">{exc.taxIdRaw || missingTaxIdLabel}</span>
                          {' — '}
                          <span className="text-muted-foreground">{issuesText}</span>
                        </li>
                    );
                  })}
                  {aeatPendingExport.excludedCount > 5 && (
                    <li className="text-sm italic text-muted-foreground">
                      {model347PreviewMoreLabel(aeatPendingExport.excludedCount - 5)}
                    </li>
                  )}
                </ul>
              </div>
            )}

            <p className="text-sm leading-relaxed text-muted-foreground">
              {model347ExcludedHelp}
            </p>
          </div>

          <DialogFooter className="gap-2 border-t bg-muted/10 px-6 py-4 sm:space-x-0">
            <Button variant="outline" onClick={handleDownloadExcludedCsv} className="w-full sm:w-auto">
              <Download className="mr-2 h-4 w-4" />
              {model347DownloadExcludedCsv}
            </Button>
            <Button variant="default" onClick={handleConfirmAEATExport} className="w-full sm:w-auto">
              {model347ExportAnyway}
            </Button>
            <Button variant="ghost" onClick={() => { setAeatExcludedDialogOpen(false); setAeatPendingExport(null); }} className="w-full sm:w-auto">
              {model347CancelToFix}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENT: Secció de proveïdors (expenses o income)
// ═══════════════════════════════════════════════════════════════════════════════

function SupplierSection({
  title,
  aggregates,
  effectiveAggregates,
  direction,
  excludedKeys,
  toggleExclusion,
  onOpenDetail,
  onOpenEmailDraft,
  isMobile,
  t,
  formatCurrencyNoBreak,
}: {
  title: string;
  aggregates: SupplierAggregate[];
  effectiveAggregates: SupplierAggregate[];
  direction: string;
  excludedKeys: Set<string>;
  toggleExclusion: (contactId: string, direction: string) => void;
  onOpenDetail: (aggregate: SupplierAggregate) => void;
  onOpenEmailDraft: (aggregate: SupplierAggregate) => void;
  isMobile: boolean;
  t: ReturnType<typeof useTranslations>['t'];
  formatCurrencyNoBreak: (value: number | string | null | undefined) => string;
}) {
  if (aggregates.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
        {title}
      </h3>

      {isMobile ? (
        <div className="space-y-2">
          {aggregates.map(agg => {
            const key = `${agg.contactId}:${direction}`;
            const isExcluded = excludedKeys.has(key);
            return (
              <MobileListItem
                key={key}
                leadingIcon={
                  <Checkbox
                    checked={!isExcluded}
                    onCheckedChange={() => toggleExclusion(agg.contactId, direction)}
                  />
                }
                title={
                  <span className={cn(isExcluded && 'opacity-50')}>
                    {agg.name}
                    {isExcluded && <Ban className="inline ml-2 h-3 w-3 text-orange-500" />}
                  </span>
                }
                className={isExcluded ? 'opacity-60 bg-muted/30' : ''}
                meta={[
                  {
                    label: 'NIF',
                    value: agg.taxId ? agg.taxId : (
                      <span className="text-red-500 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {t.reports.missingTaxId}
                      </span>
                    ),
                  },
                  {
                    value: (
                      <span className={cn('font-mono font-medium whitespace-nowrap', isExcluded ? 'text-muted-foreground line-through' : 'text-blue-600')}>
                        {formatCurrencyNoBreak(agg.quarters.total)}
                      </span>
                    ),
                  },
                ]}
                actions={
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => onOpenEmailDraft(agg)} className="h-8 w-8" title={t.reports.model347EmailAction}>
                      <Mail className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onOpenDetail(agg)} className="h-8 w-8">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                }
              />
            );
          })}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">{t.reports.include}</TableHead>
                <TableHead>{t.reports.supplierTaxId}</TableHead>
                <TableHead>{t.reports.supplierName}</TableHead>
                <TableHead className="text-right w-[80px]">{t.reports.model347Q1}</TableHead>
                <TableHead className="text-right w-[80px]">{t.reports.model347Q2}</TableHead>
                <TableHead className="text-right w-[80px]">{t.reports.model347Q3}</TableHead>
                <TableHead className="text-right w-[80px]">{t.reports.model347Q4}</TableHead>
                <TableHead className="text-right w-[100px]">{t.reports.totalAmount}</TableHead>
                <TableHead className="w-[50px]">{t.reports.model347Detail}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {aggregates.map(agg => {
                const key = `${agg.contactId}:${direction}`;
                const isExcluded = excludedKeys.has(key);
                return (
                  <TableRow key={key} className={isExcluded ? 'opacity-50 bg-muted/30' : ''}>
                    <TableCell>
                      <Checkbox
                        checked={!isExcluded}
                        onCheckedChange={() => toggleExclusion(agg.contactId, direction)}
                      />
                    </TableCell>
                    <TableCell className={!agg.taxId ? 'text-red-500' : ''}>
                      {agg.taxId || (
                        <span className="flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {t.reports.missingTaxId}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {agg.name}
                      {isExcluded && <Ban className="inline ml-2 h-3 w-3 text-orange-500" />}
                    </TableCell>
                    <TableCell className={cn('text-right font-mono text-sm whitespace-nowrap', isExcluded && 'line-through text-muted-foreground')}>
                      {agg.quarters.q1 > 0 ? formatCurrencyNoBreak(agg.quarters.q1) : '—'}
                    </TableCell>
                    <TableCell className={cn('text-right font-mono text-sm whitespace-nowrap', isExcluded && 'line-through text-muted-foreground')}>
                      {agg.quarters.q2 > 0 ? formatCurrencyNoBreak(agg.quarters.q2) : '—'}
                    </TableCell>
                    <TableCell className={cn('text-right font-mono text-sm whitespace-nowrap', isExcluded && 'line-through text-muted-foreground')}>
                      {agg.quarters.q3 > 0 ? formatCurrencyNoBreak(agg.quarters.q3) : '—'}
                    </TableCell>
                    <TableCell className={cn('text-right font-mono text-sm whitespace-nowrap', isExcluded && 'line-through text-muted-foreground')}>
                      {agg.quarters.q4 > 0 ? formatCurrencyNoBreak(agg.quarters.q4) : '—'}
                    </TableCell>
                    <TableCell className={cn('text-right font-mono font-medium whitespace-nowrap', isExcluded ? 'text-muted-foreground line-through' : 'text-blue-600')}>
                      {formatCurrencyNoBreak(agg.quarters.total)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => onOpenEmailDraft(agg)} className="h-8 w-8" title={t.reports.model347EmailAction}>
                          <Mail className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => onOpenDetail(agg)} className="h-8 w-8">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
