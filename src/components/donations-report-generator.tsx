
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
import Link from 'next/link';
import { Download, Loader2, Heart, Undo2, User, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Donor, Transaction, AnyContact } from '@/lib/data';
import { formatCurrencyEU, normalizeTaxId, removeAccents } from '@/lib/normalize';
import { useToast } from '@/hooks/use-toast';
import { encodeLatin1, type AEATExcludedDonor, type AEATExportResult } from '@/lib/model182-aeat';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { useTranslations } from '@/i18n';
import { useCurrentOrganization, useOrgUrl } from '@/hooks/organization-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { MobileListItem } from '@/components/mobile/mobile-list-item';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { MOBILE_ACTIONS_BAR, MOBILE_CTA_PRIMARY } from '@/lib/ui/mobile-actions';
import { calculateTransactionNetAmount, isReturnTransaction } from '@/lib/model182';
import type { Donation } from '@/lib/types/donations';
import { mergeTransactionsWithStripeDonations } from '@/lib/fiscal/stripe-donations-fiscal-source';

let xlsxModulePromise: Promise<typeof import('xlsx')> | null = null;

async function loadXlsx() {
  if (!xlsxModulePromise) {
    xlsxModulePromise = import('xlsx');
  }
  return xlsxModulePromise;
}

// Mapa de codis de província per a Model 182
const PROVINCE_CODES: Record<string, string> = {
  'álava': '01', 'alava': '01', 'araba': '01',
  'albacete': '02',
  'alicante': '03', 'alacant': '03',
  'almería': '04', 'almeria': '04',
  'ávila': '05', 'avila': '05',
  'badajoz': '06',
  'baleares': '07', 'balears': '07', 'illes balears': '07', 'mallorca': '07',
  'barcelona': '08',
  'burgos': '09',
  'cáceres': '10', 'caceres': '10',
  'cádiz': '11', 'cadiz': '11',
  'castellón': '12', 'castellon': '12', 'castelló': '12',
  'ciudad real': '13',
  'córdoba': '14', 'cordoba': '14',
  'coruña': '15', 'a coruña': '15', 'la coruña': '15',
  'cuenca': '16',
  'girona': '17', 'gerona': '17',
  'granada': '18',
  'guadalajara': '19',
  'guipúzcoa': '20', 'guipuzcoa': '20', 'gipuzkoa': '20',
  'huelva': '21',
  'huesca': '22', 'osca': '22',
  'jaén': '23', 'jaen': '23',
  'león': '24', 'leon': '24',
  'lleida': '25', 'lérida': '25', 'lerida': '25',
  'la rioja': '26', 'rioja': '26',
  'lugo': '27',
  'madrid': '28',
  'málaga': '29', 'malaga': '29',
  'murcia': '30',
  'navarra': '31', 'nafarroa': '31',
  'ourense': '32', 'orense': '32',
  'asturias': '33', 'oviedo': '33',
  'palencia': '34',
  'las palmas': '35', 'gran canaria': '35',
  'pontevedra': '36',
  'salamanca': '37',
  'santa cruz de tenerife': '38', 'tenerife': '38',
  'cantabria': '39', 'santander': '39',
  'segovia': '40',
  'sevilla': '41',
  'soria': '42',
  'tarragona': '43',
  'teruel': '44',
  'toledo': '45',
  'valencia': '46', 'valència': '46',
  'valladolid': '47',
  'vizcaya': '48', 'bizkaia': '48',
  'zamora': '49',
  'zaragoza': '50', 'saragossa': '50',
  'ceuta': '51',
  'melilla': '52',
};

/**
 * Obté el codi de província (2 dígits) a partir del nom o codi postal
 */
function getProvinceCode(province?: string, zipCode?: string): string {
  // Primer intentar pel nom de província
  if (province) {
    const normalized = province.toLowerCase().trim();
    if (PROVINCE_CODES[normalized]) {
      return PROVINCE_CODES[normalized];
    }
    // Si ja és un codi de 2 dígits
    if (/^\d{2}$/.test(province)) {
      return province;
    }
  }

  // Si no, obtenir del codi postal (primers 2 dígits)
  if (zipCode && zipCode.length >= 2) {
    const prefix = zipCode.substring(0, 2);
    // Validar que és un codi vàlid (01-52)
    const num = parseInt(prefix, 10);
    if (num >= 1 && num <= 52) {
      return prefix;
    }
  }

  return '';
}

interface DonationReportRow {
  donorName: string;
  donorTaxId: string;
  donorZipCode: string;
  donorProvince: string;       // Codi província (2 dígits)
  donorNaturaleza: 'F' | 'J';  // F = persona física, J = persona jurídica
  donorMembershipType: 'one-time' | 'recurring';  // Per export gestoria (F0/A0)
  totalAmount: number;
  returnedAmount: number;
  valor1: number;              // Donacions any anterior (year-1)
  valor2: number;              // Donacions dos anys abans (year-2)
  recurrente: boolean;         // true si valor1 > 0 AND valor2 > 0
}

interface ReportStats {
  totalDonors: number;
  totalAmount: number;
  excludedReturns: number;
  excludedAmount: number;
}

export function DonationsReportGenerator() {
  const { firestore, auth } = useFirebase();
  const { organizationId } = useCurrentOrganization();
  const { buildUrl } = useOrgUrl();
  const { can } = usePermissions();
  const { t, tr } = useTranslations();
  const isMobile = useIsMobile();
  const canGenerateModel182 = can('fiscal.model182.generar');
  const canExportReports = can('informes.exportar');

  // HOTFIX: Treure where('archivedAt','==',null) de query perquè moltes tx legacy
  // no tenen el camp archivedAt. Filtrem client-side amb tolerància (!tx.archivedAt).
  const transactionsQuery = useMemoFirebase(
    () => organizationId
      ? collection(firestore, 'organizations', organizationId, 'transactions')
      : null,
    [firestore, organizationId]
  );
  const contactsQuery = useMemoFirebase(
    () => organizationId ? collection(firestore, 'organizations', organizationId, 'contacts') : null,
    [firestore, organizationId]
  );
  const donationsQuery = useMemoFirebase(
    () => organizationId ? collection(firestore, 'organizations', organizationId, 'donations') : null,
    [firestore, organizationId]
  );
  const { data: transactions } = useCollection<Transaction>(transactionsQuery);
  const { data: contacts } = useCollection<AnyContact>(contactsQuery);
  const { data: donations } = useCollection<Donation>(donationsQuery);

  // Filtrar només els donants
  const donors = React.useMemo(() => 
    (contacts?.filter(c => c.type === 'donor') as Donor[]) || [],
  [contacts]);

  const [reportData, setReportData] = React.useState<DonationReportRow[]>([]);
  const [reportStats, setReportStats] = React.useState<ReportStats | null>(null);
  const [selectedYear, setSelectedYear] = React.useState<string>(String(new Date().getFullYear()));
  const [isLoading, setIsLoading] = React.useState(false);
  const { toast } = useToast();

  // ─────────────────────────────────────────────────────────────────────────────
  // STATE PER DIALOG D'EXCLOSOS AEAT
  // ─────────────────────────────────────────────────────────────────────────────
  const [aeatExcludedDialogOpen, setAeatExcludedDialogOpen] = React.useState(false);
  const [aeatPendingExport, setAeatPendingExport] = React.useState<{
    content: string;
    excluded: AEATExcludedDonor[];
    includedCount: number;
    excludedCount: number;
  } | null>(null);

  // HOTFIX: Filtre client-side tolerant (inclou null, undefined, "")
  const activeTxs = React.useMemo(() => {
    if (!transactions) return [];
    return transactions.filter(tx => !tx.archivedAt);
  }, [transactions]);

  const fiscalTxs = React.useMemo(() => {
    return mergeTransactionsWithStripeDonations(activeTxs, donations ?? []);
  }, [activeTxs, donations]);

  const availableYears = React.useMemo(() => {
    if (!fiscalTxs.length) return [];
    const years = new Set(fiscalTxs.map(tx => new Date(tx.date).getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
  }, [fiscalTxs]);
  
  const handleGenerateReport = () => {
    if (!canGenerateModel182) {
      toast({ variant: 'destructive', title: t.common.error, description: 'No tens permisos per generar el model 182.' });
      return;
    }
    setIsLoading(true);

    // HOTFIX: Usar activeTxs (filtrat client-side) en lloc de transactions raw
    if (!fiscalTxs.length || !contacts) {
      toast({ variant: 'destructive', title: t.reports.dataNotAvailable, description: t.reports.dataNotAvailableDescription });
      setIsLoading(false);
      return;
    }

    const year = parseInt(selectedYear, 10);
    const year1 = year - 1;  // Any anterior
    const year2 = year - 2;  // Dos anys abans

    // Crear mapa de donants per ID
    const donorMap = new Map(donors.map(d => [d.id, d]));

    const donationsByDonor: Record<string, {
      donor: Donor,
      total: number,
      returned: number,
      totalYear1: number,  // Donacions any-1
      totalYear2: number,  // Donacions any-2
    }> = {};

    // Estadístiques globals
    let excludedReturns = 0;
    let excludedAmount = 0;

    // ═══════════════════════════════════════════════════════════════════════════
    // PROCESSAR TOTES LES TRANSACCIONS ACTIVES (any actual + històric)
    // HOTFIX: Usar activeTxs (filtrat client-side amb tolerància !tx.archivedAt)
    // ═══════════════════════════════════════════════════════════════════════════
    fiscalTxs.forEach(tx => {
      const txYear = new Date(tx.date).getFullYear();

      // Només processar transaccions amb donant assignat
      if (tx.contactId && donorMap.has(tx.contactId)) {

        // Inicialitzar si no existeix
        if (!donationsByDonor[tx.contactId]) {
          donationsByDonor[tx.contactId] = {
            donor: donorMap.get(tx.contactId)!,
            total: 0,
            returned: 0,
            totalYear1: 0,
            totalYear2: 0,
          };
        }

        // ═══════════════════════════════════════════════════════════════════════
        // LÒGICA DE CÀLCUL PER ANY
        // ═══════════════════════════════════════════════════════════════════════

        // Calcular import net de la transacció
        const netAmount = calculateTransactionNetAmount(tx);
        if (txYear === year && isReturnTransaction(tx) && netAmount < 0) {
          excludedReturns++;
          excludedAmount += Math.abs(netAmount);
        }

        // Acumular segons l'any
        if (txYear === year) {
          if (netAmount > 0) {
            donationsByDonor[tx.contactId].total += netAmount;
          } else {
            donationsByDonor[tx.contactId].returned += Math.abs(netAmount);
          }
        } else if (txYear === year1) {
          donationsByDonor[tx.contactId].totalYear1 += Math.max(0, netAmount);
        } else if (txYear === year2) {
          donationsByDonor[tx.contactId].totalYear2 += Math.max(0, netAmount);
        }
      }
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // CALCULAR TOTAL NET: donacions - devolucions per cada donant
    // ═══════════════════════════════════════════════════════════════════════════
    const generatedReportData: DonationReportRow[] = Object.values(donationsByDonor)
      .map(({ donor, total, returned, totalYear1, totalYear2 }) => {
        const netAmount = Math.max(0, total - returned);
        const valor1 = totalYear1;
        const valor2 = totalYear2;

        return {
          donorName: donor.name,
          donorTaxId: donor.taxId,
          donorZipCode: donor.zipCode,
          donorProvince: getProvinceCode(donor.province, donor.zipCode),
          donorNaturaleza: donor.donorType === 'company' ? 'J' as const : 'F' as const,
          donorMembershipType: donor.membershipType,
          totalAmount: netAmount,
          returnedAmount: returned,
          valor1,
          valor2,
          recurrente: valor1 > 0 && valor2 > 0,
        };
      })
      // Només incloure donants amb total positiu
      .filter(({ totalAmount }) => totalAmount > 0)
      .sort((a, b) => b.totalAmount - a.totalAmount);
    
    // Calcular estadístiques
    const stats: ReportStats = {
      totalDonors: generatedReportData.length,
      totalAmount: generatedReportData.reduce((sum, row) => sum + row.totalAmount, 0),
      excludedReturns,
      excludedAmount,
    };

    setReportData(generatedReportData);
    setReportStats(stats);
    setIsLoading(false);
    
    // Toast amb informació de devolucions si n'hi ha
    if (excludedReturns > 0) {
      toast({ 
        title: t.reports.reportGenerated, 
        description: (
          <div>
            <p>{t.reports.reportGeneratedDescription(selectedYear, generatedReportData.length)}</p>
            <p className="text-orange-600 mt-1">
              ⚠️ {t.reports.returnsDiscountedToast(excludedReturns, formatCurrencyEU(excludedAmount))}
            </p>
          </div>
        ),
        duration: 6000,
      });
    } else {
      toast({ 
        title: t.reports.reportGenerated, 
        description: t.reports.reportGeneratedDescription(selectedYear, generatedReportData.length) 
      });
    }
  };

  const handleExportExcel = async () => {
    if (!canGenerateModel182 || !canExportReports) {
      toast({ variant: 'destructive', title: t.common.error, description: 'No tens permisos per exportar informes.' });
      return;
    }
    if (reportData.length === 0) {
      toast({ variant: 'destructive', title: t.reports.noDataToExport, description: t.reports.noDataToExportDescription });
      return;
    }

    let XLSX: typeof import('xlsx');
    try {
      XLSX = await loadXlsx();
    } catch (error) {
      console.error('Error loading xlsx for report export:', error);
      toast({ variant: 'destructive', title: t.common.error, description: t.reports.noDataToExportDescription });
      return;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // FORMAT MODEL 182 PER GESTORIES
    // Columnes: NIF, NOMBRE, CLAVE, PROVINCIA, PORCENTAJE, VALOR, VALOR_1, VALOR_2, RECURRENTE, NATURALEZA
    // ═══════════════════════════════════════════════════════════════════════════
    const excelData = reportData.map(row => ({
      'NIF': row.donorTaxId,
      'NOMBRE': row.donorName,
      'CLAVE': 'A',                          // Sempre "A" per donacions
      'PROVINCIA': row.donorProvince,        // Codi 2 dígits
      'PORCENTAJE': '',                      // Buit - la gestoria/AEAT ho calcula automàticament
      'VALOR': row.totalAmount.toFixed(2).replace('.', ','),     // Import any actual
      'VALOR_1': row.valor1.toFixed(2).replace('.', ','),        // Import any-1
      'VALOR_2': row.valor2.toFixed(2).replace('.', ','),        // Import any-2
      'RECURRENTE': row.recurrente ? 'X' : '',                   // X si donant recurrent
      'NATURALEZA': row.donorNaturaleza,     // F = física, J = jurídica
    }));

    // Crear workbook i worksheet
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Ajustar amplada de columnes
    ws['!cols'] = [
      { wch: 12 },  // NIF
      { wch: 40 },  // NOMBRE
      { wch: 6 },   // CLAVE
      { wch: 10 },  // PROVINCIA
      { wch: 12 },  // PORCENTAJE
      { wch: 12 },  // VALOR
      { wch: 12 },  // VALOR_1
      { wch: 12 },  // VALOR_2
      { wch: 12 },  // RECURRENTE
      { wch: 12 },  // NATURALEZA
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Model 182');

    // Descarregar arxiu
    XLSX.writeFile(wb, `model182_${selectedYear}.xlsx`);

    toast({ title: t.reports.exportComplete, description: t.reports.exportCompleteDescription });
  };

  /**
   * Export format simplificat per gestories (7 columnes A–G)
   * No substitueix l'export estàndard
   */
  const handleExportGestoria = async () => {
    if (!canGenerateModel182 || !canExportReports) {
      toast({ variant: 'destructive', title: t.common.error, description: 'No tens permisos per exportar informes.' });
      return;
    }
    if (reportData.length === 0) {
      toast({ variant: 'destructive', title: t.reports.noDataToExport, description: t.reports.noDataToExportDescription });
      return;
    }

    let XLSX: typeof import('xlsx');
    try {
      XLSX = await loadXlsx();
    } catch (error) {
      console.error('Error loading xlsx for gestoria export:', error);
      toast({ variant: 'destructive', title: t.common.error, description: t.reports.noDataToExportDescription });
      return;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // FORMAT GESTORIA (A–G)
    // Columnes: NIF, COGNOMS_NOM, PROVINCIA, CLAVE, PORCENTAJE, IMPORTE, RECURRENCIA
    // ═══════════════════════════════════════════════════════════════════════════
    const excelData = reportData.map(row => {
      // Calcular recurrència segons criteri validat
      let recurrencia: number | string = '';
      if (row.valor1 > 0 && row.valor2 > 0) {
        recurrencia = 1;
      } else if (row.valor1 === 0 && row.valor2 === 0) {
        recurrencia = 2;
      }
      // Si només un any té import > 0, queda buit

      return {
        'NIF': normalizeTaxId(row.donorTaxId),
        'COGNOMS_NOM': removeAccents(row.donorName).toUpperCase().replace(/\s+/g, ' ').trim(),
        'PROVINCIA': row.donorZipCode?.substring(0, 2) || '',
        'CLAVE': row.donorMembershipType === 'recurring' ? 'F0' : 'A0',
        'PORCENTAJE': '',  // Sempre buit - la gestoria ho calcula
        'IMPORTE': Math.round(row.totalAmount * 100) / 100,  // Numèric amb 2 decimals
        'RECURRENCIA': recurrencia,
      };
    });

    // Crear workbook i worksheet
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Ajustar amplada de columnes
    ws['!cols'] = [
      { wch: 12 },  // NIF
      { wch: 40 },  // COGNOMS_NOM
      { wch: 10 },  // PROVINCIA
      { wch: 8 },   // CLAVE
      { wch: 12 },  // PORCENTAJE
      { wch: 12 },  // IMPORTE
      { wch: 12 },  // RECURRENCIA
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Model 182 Gestoria');

    // Descarregar arxiu amb nom diferenciat
    XLSX.writeFile(wb, `model182_gestoria_A-G_${selectedYear}.xlsx`);

    toast({ title: t.reports.exportComplete, description: t.reports.exportGestoriaTooltip });
  };

  /**
   * Export format AEAT oficial (fitxer .txt de longitud fixa)
   * Per a "Presentació mitjançant fitxer" a la Seu Electrònica
   *
   * Comportament:
   * - Errors d'organització → bloquejants
   * - Errors de donants → Dialog amb opcions (CSV exclosos, exportar igualment, cancel·lar)
   * - Si 0 donants vàlids → error
   */
  const handleExportAEAT = async () => {
    if (!canGenerateModel182 || !canExportReports) {
      toast({ variant: 'destructive', title: t.common.error, description: 'No tens permisos per exportar informes.' });
      return;
    }
    if (reportData.length === 0) {
      toast({ variant: 'destructive', title: t.reports.noDataToExport, description: t.reports.noDataToExportDescription });
      return;
    }
    if (!organizationId) {
      toast({ variant: 'destructive', title: t.reports.exportAEATMissingData, description: "No s'ha pogut carregar l'organització." });
      return;
    }

    // Crida server-side: el servidor llegeix Firestore, computa i genera
    let result: AEATExportResult;
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/fiscal/model182/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({ orgId: organizationId, year: parseInt(selectedYear, 10) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const code = err?.error ?? res.status;
        toast({ variant: 'destructive', title: t.reports.exportAEATMissingData, description: `Error ${code}` });
        return;
      }
      result = await res.json();
    } catch {
      toast({ variant: 'destructive', title: t.reports.exportAEATMissingData, description: "No s'ha pogut connectar amb el servidor." });
      return;
    }

    // 1. Errors d'organització o cap donant vàlid → bloquejants
    if (result.errors.length > 0) {
      toast({
        variant: 'destructive',
        title: t.reports.exportAEATMissingData,
        description: (
          <div className="space-y-1">
            {result.errors.map((err, i) => (
              <p key={i}>• {err}</p>
            ))}
          </div>
        ),
        duration: 10000,
      });
      return;
    }

    // 2. Hi ha donants exclosos → mostrar Dialog amb opcions
    if (result.excludedCount > 0) {
      setAeatPendingExport({
        content: result.content,
        excluded: result.excluded,
        includedCount: result.includedCount,
        excludedCount: result.excludedCount,
      });
      setAeatExcludedDialogOpen(true);
      return;
    }

    // 3. Cap exclòs → exportar directament
    downloadAEATFile(result.content);
    toast({ title: t.reports.exportComplete, description: t.reports.exportAEATTooltip });
  };

  /**
   * Helper per descarregar el fitxer AEAT (codificat a Latin-1)
   */
  const downloadAEATFile = (content: string) => {
    const encoded = encodeLatin1(content);
    if (encoded.error) {
      toast({
        variant: 'destructive',
        title: t.reports.exportAEATEncodingError,
        description: encoded.error,
      });
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
    a.download = `modelo182_${selectedYear}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /**
   * Helper per escapar valors CSV
   */
  const toCsvValue = (v: string | undefined | null): string => {
    const s = (v ?? '').toString();
    return `"${s.replace(/"/g, '""')}"`;
  };

  /**
   * Descarregar CSV d'exclosos
   */
  const handleDownloadExcludedCsv = () => {
    if (!aeatPendingExport) return;

    // Crear mapa de donants per buscar email/telèfon si existeix
    const donorMap = new Map(donors.map(d => [d.taxId?.toLowerCase().trim(), d]));

    const headers = ['name', 'taxId', 'issue', 'email', 'phone'];
    const rows = aeatPendingExport.excluded.map(exc => {
      // Buscar email/telèfon al donant original (si existeix)
      const donor = donorMap.get(exc.taxIdRaw?.toLowerCase().trim());
      // Traduir issueCodes a text localitzat
      const issuesText = exc.issueCodes
        .map(code => t.reports.aeatIssueLabel(code, exc.issueMeta))
        .join('; ');
      return [
        toCsvValue(exc.name),
        toCsvValue(exc.taxIdRaw),
        toCsvValue(issuesText),
        toCsvValue(donor?.email ?? ''),
        toCsvValue(donor?.phone ?? ''),
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' }); // BOM per Excel
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `model182_exclosos_${selectedYear}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({ title: t.reports.exportComplete, description: t.reports.exportExcludedCsvDesc });
  };

  /**
   * Confirmar exportació AEAT (després del Dialog)
   */
  const handleConfirmAEATExport = () => {
    if (!aeatPendingExport) return;

    downloadAEATFile(aeatPendingExport.content);
    setAeatExcludedDialogOpen(false);
    setAeatPendingExport(null);

    toast({
      title: t.reports.exportComplete,
      description: t.reports.exportAEATExcludedDesc(aeatPendingExport.includedCount, aeatPendingExport.excludedCount),
    });
  };

  return (
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5 text-red-500" />
                  {t.reports.donationsReportTitle}
                </CardTitle>
                <CardDescription>{t.reports.donationsReportDescription}</CardDescription>
              </div>
              <div className={cn(MOBILE_ACTIONS_BAR, "sm:justify-end")}>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger className={MOBILE_CTA_PRIMARY}>
                        <SelectValue placeholder={t.reports.selectYear} />
                    </SelectTrigger>
                    <SelectContent>
                        {availableYears.map(year => (
                            <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button onClick={handleGenerateReport} disabled={isLoading || !canGenerateModel182} className={MOBILE_CTA_PRIMARY}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t.reports.generate}
                </Button>
                {/* Botons d'export amb jerarquia: AEAT (primari) > Excel (secundari) > Gestoria (terciari) */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button onClick={handleExportAEAT} disabled={reportData.length === 0 || !canGenerateModel182 || !canExportReports} className={MOBILE_CTA_PRIMARY}>
                          <Download className="mr-2 h-4 w-4" />
                          {t.reports.exportAEAT}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t.reports.exportAEATTooltip}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" onClick={handleExportExcel} disabled={reportData.length === 0 || !canGenerateModel182 || !canExportReports} className={MOBILE_CTA_PRIMARY}>
                          <Download className="mr-2 h-4 w-4" />
                          {t.reports.exportExcel}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t.reports.exportExcelTooltip}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" onClick={handleExportGestoria} disabled={reportData.length === 0 || !canGenerateModel182 || !canExportReports} className="text-muted-foreground">
                          <Download className="mr-2 h-4 w-4" />
                          {t.reports.exportGestoria}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t.reports.exportGestoriaTooltip}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
            {/* ═══════════════════════════════════════════════════════════════════
                AVÍS DE DEVOLUCIONS DESCOMPTADES
                ═══════════════════════════════════════════════════════════════════ */}
            {reportStats && reportStats.excludedReturns > 0 && (
              <Alert className="border-orange-200 bg-orange-50">
                <Undo2 className="h-4 w-4 text-orange-600" />
                <AlertTitle className="text-orange-800">{t.reports.returnsDiscountedTitle}</AlertTitle>
                <AlertDescription className="text-orange-700">
                  {t.reports.returnsDiscountedDescription(reportStats.excludedReturns, formatCurrencyEU(reportStats.excludedAmount))}
                </AlertDescription>
              </Alert>
            )}

            {/* ═══════════════════════════════════════════════════════════════════
                RESUM D'ESTADÍSTIQUES
                ═══════════════════════════════════════════════════════════════════ */}
            {reportStats && reportData.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-xs text-green-600 font-medium">{t.donors.title}</p>
                  <p className="text-2xl font-bold text-green-700">{reportStats.totalDonors}</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-xs text-green-600 font-medium">{t.certificates.totalDonated}</p>
                  <p className="text-2xl font-bold text-green-700">{formatCurrencyEU(reportStats.totalAmount)}</p>
                </div>
                {reportStats.excludedReturns > 0 && (
                  <>
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                      <p className="text-xs text-orange-600 font-medium">{t.reports.returns}</p>
                      <p className="text-2xl font-bold text-orange-700">{reportStats.excludedReturns}</p>
                    </div>
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                      <p className="text-xs text-orange-600 font-medium">{t.reports.discountedAmount}</p>
                      <p className="text-2xl font-bold text-orange-700">{formatCurrencyEU(reportStats.excludedAmount)}</p>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════
                TAULA DE DONANTS (Desktop) / LLISTA (Mobile)
                ═══════════════════════════════════════════════════════════════════ */}
            {isMobile ? (
              <div className="space-y-2">
                {isLoading ? (
                  <>
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="border border-border/50 rounded-lg p-3">
                        <Skeleton className="h-4 w-3/4 mb-2" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    ))}
                  </>
                ) : reportData.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    {t.reports.noData}
                  </div>
                ) : (
                  reportData.map((row) => (
                    <MobileListItem
                      key={row.donorTaxId}
                      leadingIcon={<User className="h-4 w-4" />}
                      title={
                        <span className="flex items-center gap-2">
                          {row.donorName}
                          {row.returnedAmount > 0 && (
                            <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50 text-xs px-1.5 py-0">
                              Dev.
                            </Badge>
                          )}
                        </span>
                      }
                      meta={[
                        { label: 'NIF', value: row.donorTaxId },
                        { label: 'CP', value: row.donorZipCode },
                        {
                          value: (
                            <span className="font-mono text-green-600 font-medium">
                              {formatCurrencyEU(row.totalAmount)}
                            </span>
                          )
                        },
                        ...(row.returnedAmount > 0 ? [{
                          value: (
                            <span className="flex items-center gap-1 font-mono text-orange-500">
                              <Undo2 className="h-3 w-3" />
                              -{formatCurrencyEU(row.returnedAmount)}
                            </span>
                          )
                        }] : [])
                      ]}
                    />
                  ))
                )}
              </div>
            ) : (
              <div className="rounded-md border">
              <TooltipProvider>
              <Table>
                  <TableHeader>
                  <TableRow>
                      <TableHead>{t.reports.donorName}</TableHead>
                      <TableHead>{t.reports.donorTaxId}</TableHead>
                      <TableHead>{t.reports.donorZipCode}</TableHead>
                      <TableHead className="text-right">{t.reports.totalAmount}</TableHead>
                      {reportStats?.excludedReturns ? (
                        <TableHead className="text-right text-orange-600">{t.reports.columnDiscounted}</TableHead>
                      ) : null}
                  </TableRow>
                  </TableHeader>
                  <TableBody>
                  {reportData.map((row) => (
                      <TableRow key={row.donorTaxId}>
                        <TableCell className="font-medium">
                          <span className="flex items-center gap-2">
                            {row.donorName}
                            {row.returnedAmount > 0 && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50 text-xs px-1.5 py-0">
                                    Dev.
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Aquest donant té devolucions aquest any.</p>
                                  <p className="text-xs text-muted-foreground">Import net ja ajustat.</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </span>
                        </TableCell>
                        <TableCell>{row.donorTaxId}</TableCell>
                        <TableCell>{row.donorZipCode}</TableCell>
                        <TableCell className="text-right font-mono text-green-600 font-medium">
                          {formatCurrencyEU(row.totalAmount)}
                        </TableCell>
                        {reportStats?.excludedReturns ? (
                          <TableCell className="text-right font-mono text-orange-500">
                            {row.returnedAmount > 0 ? (
                              <span className="flex items-center justify-end gap-1">
                                <Undo2 className="h-3 w-3" />
                                -{formatCurrencyEU(row.returnedAmount)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        ) : null}
                      </TableRow>
                  ))}
                  {reportData.length === 0 && (
                      <TableRow>
                          <TableCell colSpan={reportStats?.excludedReturns ? 5 : 4} className="text-center text-muted-foreground h-24">
                             {isLoading ? t.reports.generating : t.reports.noData}
                          </TableCell>
                      </TableRow>
                  )}
                  </TableBody>
              </Table>
              </TooltipProvider>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════
                NOTA LEGAL
                ═══════════════════════════════════════════════════════════════════ */}
            {reportData.length > 0 && (
              <p className="text-xs text-muted-foreground">
                ℹ️ {t.reports.netDonationsNote}
              </p>
            )}
        </CardContent>

        {/* ═══════════════════════════════════════════════════════════════════════
            DIALOG EXCLOSOS AEAT
            ═══════════════════════════════════════════════════════════════════════ */}
        <Dialog open={aeatExcludedDialogOpen} onOpenChange={setAeatExcludedDialogOpen}>
          <DialogContent className="w-[calc(100vw-2rem)] max-w-3xl sm:max-w-3xl max-h-[80vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                {t.reports.aeatExcludedDialogTitle}
              </DialogTitle>
              <DialogDescription>
                {aeatPendingExport && t.reports.aeatExcludedDialogDesc(
                  aeatPendingExport.includedCount,
                  aeatPendingExport.excludedCount
                )}
              </DialogDescription>
            </DialogHeader>

            {/* Llista d'exclosos (màxim 5) */}
            {aeatPendingExport && aeatPendingExport.excludedCount > 0 && (
              <div className="max-h-[45vh] overflow-auto pr-2 border rounded-md p-2 bg-muted/30">
                <ul className="space-y-2">
                  {aeatPendingExport.excluded.slice(0, 5).map((exc, i) => {
                    const issuesText = exc.issueCodes
                      .map(code => t.reports.aeatIssueLabel(code, exc.issueMeta))
                      .join('; ');
                    const taxIdOrLabel = exc.taxIdRaw?.trim() || t.reports.aeatExcludedNoNif;
                    return (
                      <li key={i} className="text-sm break-words whitespace-normal min-w-0">
                        <span className="font-medium text-foreground">{exc.name}</span>
                        {' — '}
                        <span className="font-mono break-all">{taxIdOrLabel}</span>
                        {' — '}
                        <span className="text-muted-foreground">{issuesText}</span>
                      </li>
                    );
                  })}
                  {aeatPendingExport.excludedCount > 5 && (
                    <li className="text-sm text-muted-foreground italic">
                      {t.reports.aeatExcludedPreviewMore(aeatPendingExport.excludedCount - 5)}
                    </li>
                  )}
                </ul>
              </div>
            )}

            {/* Help text */}
            <p className="text-sm text-muted-foreground">
              {t.reports.aeatExcludedHelp}
            </p>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={handleDownloadExcludedCsv}
                className="w-full sm:w-auto"
              >
                <Download className="mr-2 h-4 w-4" />
                {t.reports.downloadExcludedCsv}
              </Button>
              <Button variant="outline" asChild className="w-full sm:w-auto">
                <Link
                  href={buildUrl('/donants?filter=incomplete')}
                  onClick={() => {
                    setAeatExcludedDialogOpen(false);
                    setAeatPendingExport(null);
                  }}
                >
                  {tr('guides.cta.model182HasErrors', 'Anar a Donants')}
                </Link>
              </Button>
              <Button
                variant="default"
                onClick={handleConfirmAEATExport}
                className="w-full sm:w-auto"
              >
                {t.reports.exportAnyway}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setAeatExcludedDialogOpen(false);
                  setAeatPendingExport(null);
                }}
                className="w-full sm:w-auto"
              >
                {t.reports.aeatCancelToFix}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Card>
  );
}

    
