'use client';

import * as React from 'react';
import { useFirebase } from '@/firebase';
import { useCurrentOrganization } from '@/hooks/organization-provider';
import Link from 'next/link';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import type { Transaction, Donor, Organization } from '@/lib/data';
import type { Donation } from '@/lib/types/donations';
import { formatCurrencyEU } from '@/lib/normalize';
import { useTranslations } from '@/i18n';
import { useToast } from '@/hooks/use-toast';
import { jsPDF } from 'jspdf';
import { getPeriodicitySuffix } from '@/lib/donors/periodicity-suffix';
import {
  buildDonorSummaryDatasetFingerprint,
  calculateDonorSummary,
  createEmptyDonorSummary,
  getDonorSummaryTransactionKey,
  isDrawerDonationCandidate,
  type DonorSummaryResult,
} from '@/lib/fiscal/calculateDonorSummary';
import { mergeUnifiedFiscalDonations } from '@/lib/fiscal/getUnifiedFiscalDonations';
import {
  getIndividualDonationCertificateBlockMessage,
  getIndividualDonationCertificateBlockReason,
} from '@/lib/fiscal/individual-donation-certificate';

// UI Components
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  User,
  Building2,
  Edit,
  AlertTriangle,
  CheckCircle2,
  Euro,
  Calendar,
  TrendingUp,
  Undo2,
  ChevronDown,
  ChevronUp,
  FileText,
  Download,
  RefreshCw,
  Loader2,
  Mail,
  Send,
  ExternalLink,
} from 'lucide-react';

// ════════════════════════════════════════════════════════════════════════════
// TIPUS
// ════════════════════════════════════════════════════════════════════════════

interface DonorDetailDrawerProps {
  donor: Donor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (donor: Donor) => void;
}

// ════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ════════════════════════════════════════════════════════════════════════════

export function DonorDetailDrawer({ donor, open, onOpenChange, onEdit }: DonorDetailDrawerProps) {
  const { firestore, user } = useFirebase();
  const { organizationId, organization, orgSlug } = useCurrentOrganization();
  const { t, tr, language } = useTranslations();
  const { toast } = useToast();
  const certificateLanguage = language === 'ca' ? 'ca' : 'es';

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = React.useState<string>(String(currentYear));
  const [filterStatus, setFilterStatus] = React.useState<'all' | 'returns'>('all');
  const [isHistoryOpen, setIsHistoryOpen] = React.useState(false);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [isGeneratingPdf, setIsGeneratingPdf] = React.useState(false);
  const [isSendingEmail, setIsSendingEmail] = React.useState(false);
  const itemsPerPage = 10;
  const selectedYearNumber = React.useMemo(() => {
    const parsedYear = Number.parseInt(selectedYear, 10);
    return Number.isFinite(parsedYear) ? parsedYear : currentYear;
  }, [selectedYear, currentYear]);

  const getAuthHeaders = async (): Promise<Record<string, string> | null> => {
    const idToken = await user?.getIdToken();
    if (!idToken) {
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: t.certificates.email.errorSending,
      });
      return null;
    }
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    };
  };

  const getIndividualCertificateBlockReason = React.useCallback((tx: Transaction, mode: 'download' | 'email') => {
    return getIndividualDonationCertificateBlockReason({
      transaction: tx,
      donorHasTaxId: Boolean(donor?.taxId),
      donorHasEmail: mode === 'email' ? Boolean(donor?.email) : true,
    });
  }, [donor?.email, donor?.taxId]);

  const getIndividualCertificateBlockMessage = React.useCallback((tx: Transaction, mode: 'download' | 'email') => {
    const reason = getIndividualCertificateBlockReason(tx, mode);
    return reason ? getIndividualDonationCertificateBlockMessage(reason) : null;
  }, [getIndividualCertificateBlockReason]);

  // Transaccions del donant - usar onSnapshot per gestionar errors de permisos
  const [transactions, setTransactions] = React.useState<Transaction[] | null>(null);
  const [stripeDonations, setStripeDonations] = React.useState<Donation[] | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [permissionError, setPermissionError] = React.useState(false);

  React.useEffect(() => {
    if (!organizationId || !donor || !open) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setPermissionError(false);

    // P0: Query directa per contactId (no carregar globals i filtrar al client)
    // Això garanteix que totes les transaccions del donant apareixen independentment
    // del volum global.
    // HOTFIX: Treure where('archivedAt','==',null) de query perquè moltes tx legacy
    // no tenen el camp archivedAt. Filtrem client-side amb tolerància (!tx.archivedAt).
    const txRef = collection(firestore, 'organizations', organizationId, 'transactions');
    const donationsRef = collection(firestore, 'organizations', organizationId, 'donations');
    const txQuery = query(
      txRef,
      where('contactId', '==', donor.id),
      orderBy('date', 'desc'),
      limit(1000)
    );
    const donationsQuery = query(
      donationsRef,
      where('contactId', '==', donor.id),
      limit(1000)
    );

    const unsubscribeTransactions = onSnapshot(
      txQuery,
      (snapshot) => {
        const donorTxs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
        setTransactions(donorTxs);
      },
      (error) => {
        console.warn('Donor transactions not available:', error.message);
        setIsLoading(false);
        setPermissionError(true);
        setTransactions([]);
      }
    );

    const unsubscribeDonations = onSnapshot(
      donationsQuery,
      (snapshot) => {
        const donorDonations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Donation));
        setStripeDonations(donorDonations);
        setIsLoading(false);
        setPermissionError(false);
      },
      (error) => {
        console.warn('Donor Stripe donations not available:', error.message);
        setIsLoading(false);
        setPermissionError(true);
        setStripeDonations([]);
      }
    );

    return () => {
      unsubscribeTransactions();
      unsubscribeDonations();
    };
  }, [firestore, organizationId, donor?.id, open]);

  const fiscalTransactions = React.useMemo(() => {
    return mergeUnifiedFiscalDonations({
      transactions: transactions ?? [],
      donations: stripeDonations ?? [],
    });
  }, [stripeDonations, transactions]);

  // Anys disponibles (dels quals hi ha transaccions)
  const availableYears = React.useMemo(() => {
    if (fiscalTransactions.length === 0) return [String(currentYear)];
    const years = new Set<string>();
    fiscalTransactions.forEach(tx => {
      const year = tx.date.substring(0, 4);
      years.add(year);
    });
    // Afegir any actual si no hi és
    years.add(String(currentYear));
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [fiscalTransactions, currentYear]);

  // Calcular resum fiscal (font única de veritat)
  const summary = React.useMemo<DonorSummaryResult>(() => {
    if (!donor) {
      return createEmptyDonorSummary({
        transactions: fiscalTransactions,
        donorId: '',
        year: selectedYearNumber,
      });
    }

    return calculateDonorSummary({
      transactions: fiscalTransactions,
      donorId: donor.id,
      year: selectedYearNumber,
    });
  }, [fiscalTransactions, selectedYearNumber, donor]);

  // Per defecte: historial obert si <= 5 donacions
  React.useEffect(() => {
    if (fiscalTransactions.length > 0) {
      const donationsCount = fiscalTransactions.filter(isDrawerDonationCandidate).length;
      setIsHistoryOpen(donationsCount <= 5);
    }
  }, [fiscalTransactions]);

  // Filtrar transaccions per any i estat
  const effectiveReturnIdSet = React.useMemo(() => new Set(summary.effectiveReturnIds), [summary.effectiveReturnIds]);

  const filteredTransactions = React.useMemo(() => {
    if (fiscalTransactions.length === 0) return [];

    return fiscalTransactions.filter(tx => {
      // Filtrar per any
      if (!tx.date.startsWith(selectedYear)) return false;
      const txKey = getDonorSummaryTransactionKey(tx);
      const isEffectiveReturn = effectiveReturnIdSet.has(txKey);

      // Filtrar per estat
      if (filterStatus === 'returns') {
        return isEffectiveReturn;
      }
      // 'all': mostrar donacions vàlides i devolucions
      return isDrawerDonationCandidate(tx) || isEffectiveReturn;
    });
  }, [effectiveReturnIdSet, fiscalTransactions, filterStatus, selectedYear]);

  // Paginació
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset pàgina quan canvien els filtres
  React.useEffect(() => {
    setCurrentPage(1);
  }, [selectedYear, filterStatus]);

  // Helper: dades completes?
  const hasCompleteData = donor?.taxId && donor?.zipCode;

  // Formatar data
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(language === 'ca' ? 'ca-ES' : 'es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  // Helper per carregar imatge com a base64 usant canvas (evita problemes CORS)
  const loadImageAsBase64 = async (url: string): Promise<string | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous'; // Important per CORS

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const dataUrl = canvas.toDataURL('image/png');
            resolve(dataUrl);
          } else {
            resolve(null);
          }
        } catch (error) {
          console.warn('Canvas error:', error);
          resolve(null);
        }
      };

      img.onerror = (error) => {
        console.warn('Error loading image for PDF:', url, error);
        resolve(null);
      };

      // Afegir timestamp per evitar cache problemàtic
      img.src = url.includes('?') ? `${url}&t=${Date.now()}` : `${url}?t=${Date.now()}`;
    });
  };

  // Generar certificat individual
  const generateCertificate = async (tx: Transaction) => {
    if (!donor || !organization) return;
    const blockedMessage = getIndividualCertificateBlockMessage(tx, 'download');
    if (blockedMessage) {
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: blockedMessage,
      });
      return;
    }

    setIsGeneratingPdf(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      const contentWidth = pageWidth - margin * 2;
      let y = margin;
      const lineHeight = 7;

      // ═══════════════════════════════════════════════════════════════════════
      // CAPÇALERA AMB LOGO
      // ═══════════════════════════════════════════════════════════════════════

      // Helper per construir l'adreça completa de l'organització
      const buildOrgFullAddress = (): string => {
        const parts: string[] = [];
        if (organization.address) parts.push(organization.address);
        const locationPart = [organization.zipCode, organization.city, organization.province].filter(Boolean).join(' ');
        if (locationPart) parts.push(locationPart);
        return parts.join(', ');
      };

      const orgFullAddress = buildOrgFullAddress();

      if (organization.logoUrl) {
        const logoBase64 = await loadImageAsBase64(organization.logoUrl);
        if (logoBase64) {
          doc.addImage(logoBase64, 'PNG', margin, y, 30, 30);
          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
          doc.text(organization.name || '', margin + 35, y + 10);
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          doc.text(`CIF: ${organization.taxId || 'N/A'}`, margin + 35, y + 16);
          if (orgFullAddress) {
            doc.setFontSize(9);
            const headerAddress = doc.splitTextToSize(orgFullAddress, contentWidth - 35);
            doc.text(headerAddress, margin + 35, y + 22);
          }
          y += 38;
        } else {
          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
          doc.text(organization.name || '', pageWidth / 2, y, { align: 'center' });
          y += 6;
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          doc.text(`CIF: ${organization.taxId || 'N/A'}`, pageWidth / 2, y, { align: 'center' });
          y += 5;
          if (orgFullAddress) {
            doc.setFontSize(9);
            doc.text(orgFullAddress, pageWidth / 2, y, { align: 'center' });
            y += 5;
          }
          y += 5;
        }
      } else {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(organization.name || '', pageWidth / 2, y, { align: 'center' });
        y += 6;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`CIF: ${organization.taxId || 'N/A'}`, pageWidth / 2, y, { align: 'center' });
        y += 5;
        if (orgFullAddress) {
          doc.setFontSize(9);
          doc.text(orgFullAddress, pageWidth / 2, y, { align: 'center' });
          y += 5;
        }
        y += 5;
      }

      // Línia separadora
      doc.setDrawColor(180);
      doc.line(margin, y, pageWidth - margin, y);
      y += 15;

      // ═══════════════════════════════════════════════════════════════════════
      // TÍTOL DEL CERTIFICAT
      // ═══════════════════════════════════════════════════════════════════════

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(t.donorDetail.certificate.title, pageWidth / 2, y, { align: 'center' });
      y += 18;

      // ═══════════════════════════════════════════════════════════════════════
      // COS DEL CERTIFICAT - FORMAT FORMAL
      // ═══════════════════════════════════════════════════════════════════════

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');

      // Línia 1: D./Dª [Signant], en representació de [Entitat],
      const signatoryPrefix = donor.donorType === 'company' ? '' : 'D./Dª ';
      const signatoryName = organization.signatoryName || '[Representant]';
      const line1 = `${signatoryPrefix}${signatoryName}, ${t.donorDetail.certificate.inRepresentationOf} ${organization.name},`;
      const line1Wrapped = doc.splitTextToSize(line1, contentWidth);
      doc.text(line1Wrapped, margin, y);
      y += line1Wrapped.length * lineHeight;

      // Línia 2: con CIF [CIF], domicilio en [Adreça completa],
      const line2 = `${t.donorDetail.certificate.withCif} ${organization.taxId}, ${t.donorDetail.certificate.domiciledAt} ${orgFullAddress || t.donorDetail.certificate.addressPlaceholder},`;
      const line2Wrapped = doc.splitTextToSize(line2, contentWidth);
      doc.text(line2Wrapped, margin, y);
      y += line2Wrapped.length * lineHeight + 8;

      // CERTIFICA (destacat i centrat)
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(t.donorDetail.certificate.certifies, pageWidth / 2, y, { align: 'center' });
      y += 12;

      // Primer paràgraf: Que [Donant] con DNI/CIF [NIF] y domicilio en [Adreça], donó...
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      // Construir adreça completa del donant (adreça + CP + ciutat)
      const donorAddressParts: string[] = [];
      if (donor.address) donorAddressParts.push(donor.address);
      const donorLocationPart = [donor.zipCode, donor.city, donor.province].filter(Boolean).join(' ');
      if (donorLocationPart) donorAddressParts.push(donorLocationPart);
      const donorAddress = donorAddressParts.length > 0 ? donorAddressParts.join(', ') : t.donorDetail.certificate.donorAddressMissing;
      const paragraph1 = `${t.donorDetail.certificate.thatDonor} ${donor.name} ${t.donorDetail.certificate.withNifCif} ${donor.taxId} ${t.donorDetail.certificate.andDomicile} ${donorAddress}, ${t.donorDetail.certificate.donatedAmount} ${formatCurrencyEU(tx.amount)} ${t.donorDetail.certificate.onDate} ${formatDate(tx.date)} ${t.donorDetail.certificate.toTheEntity}`;
      const paragraph1Wrapped = doc.splitTextToSize(paragraph1, contentWidth);
      doc.text(paragraph1Wrapped, margin, y);
      y += paragraph1Wrapped.length * lineHeight + 6;

      // Segon paràgraf: Clàusula irrevocable
      const paragraph2 = t.donorDetail.certificate.irrevocableClause;
      const paragraph2Wrapped = doc.splitTextToSize(paragraph2, contentWidth);
      doc.text(paragraph2Wrapped, margin, y);
      y += paragraph2Wrapped.length * lineHeight + 6;

      // Tercer paràgraf: Y para que así conste...
      const today = new Date();
      const monthNames = Object.keys(t.months);
      const monthName = t.months[monthNames[today.getMonth()] as keyof typeof t.months];
      const cityName = organization.city || t.donorDetail.certificate.cityPlaceholder;
      const paragraph3 = `${t.donorDetail.certificate.issuedIn} ${cityName} ${t.donorDetail.certificate.issuedOn} ${today.getDate()} de ${monthName} de ${today.getFullYear()}.`;
      const paragraph3Wrapped = doc.splitTextToSize(paragraph3, contentWidth);
      doc.text(paragraph3Wrapped, margin, y);
      y += paragraph3Wrapped.length * lineHeight + 15;

      // ═══════════════════════════════════════════════════════════════════════
      // NOTA LEGAL
      // ═══════════════════════════════════════════════════════════════════════

      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      const legalText = t.donorDetail.certificate.legalNote;
      const legalLines = doc.splitTextToSize(legalText, contentWidth);
      doc.text(legalLines, margin, y);
      y += legalLines.length * 4 + 15;

      // ═══════════════════════════════════════════════════════════════════════
      // FIRMA (centrada a la dreta)
      // ═══════════════════════════════════════════════════════════════════════

      const signatureX = pageWidth - margin - 60;

      if (organization.signatureUrl) {
        const signatureBase64 = await loadImageAsBase64(organization.signatureUrl);
        if (signatureBase64) {
          doc.addImage(signatureBase64, 'PNG', signatureX, y, 50, 25);
          y += 28;
        }
      }

      if (organization.signatoryName) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(organization.signatoryName, signatureX + 25, y, { align: 'center' });
        y += 5;
      }
      if (organization.signatoryRole) {
        doc.setFont('helvetica', 'normal');
        doc.text(organization.signatoryRole, signatureX + 25, y, { align: 'center' });
      }

      // Descarregar
      const fileName = `Certificat_${formatDate(tx.date).replace(/\//g, '-')}_${donor.name.replace(/\s+/g, '_')}.pdf`;
      doc.save(fileName);

      toast({
        title: t.donorDetail.certificate.generated,
        description: fileName,
      });
    } catch (error) {
      console.error('Error generating certificate:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: t.donorDetail.certificate.error,
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const resolveAnnualCertificateScope = (year: string) => {
    if (!donor) return null;

    const parsedYear = Number.parseInt(year, 10);
    if (!Number.isFinite(parsedYear)) {
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: t.donorDetail.invalidFiscalYear,
      });
      return null;
    }

    if (parsedYear !== summary.scopeYear) {
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: t.donorDetail.annualCertificateFilterMismatch(year),
      });
      return null;
    }

    const expectedFingerprint = buildDonorSummaryDatasetFingerprint({
      transactions: fiscalTransactions,
      donorId: donor.id,
      year: parsedYear,
    });

    if (
      summary.scopeDonorId !== donor.id ||
      summary.scopeYear !== parsedYear ||
      summary.datasetFingerprint !== expectedFingerprint
    ) {
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: t.donorDetail.annualCertificateOutOfSync,
      });
      return null;
    }

    return {
      yearLabel: String(parsedYear),
      grossAmount: summary.currentYearGross,
      returnedAmount: summary.currentYearReturned,
      netAmount: summary.currentYearNet,
      donationsCount: summary.currentYearDonationCandidatesCount,
    };
  };

  // Generar certificat anual
  const generateAnnualCertificate = async (year: string) => {
    if (!donor || !organization) return;
    const annualScope = resolveAnnualCertificateScope(year);
    if (!annualScope) return;

    const { yearLabel, grossAmount, returnedAmount, netAmount, donationsCount } = annualScope;

    if (netAmount === 0) {
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: tr('certificates.netZeroBlocked'),
      });
      return;
    }

    setIsGeneratingPdf(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      const contentWidth = pageWidth - margin * 2;
      let y = margin;
      const lineHeight = 7;

      // ═══════════════════════════════════════════════════════════════════════
      // CAPÇALERA AMB LOGO
      // ═══════════════════════════════════════════════════════════════════════

      // Helper per construir l'adreça completa de l'organització
      const buildOrgFullAddress = (): string => {
        const parts: string[] = [];
        if (organization.address) parts.push(organization.address);
        const locationPart = [organization.zipCode, organization.city, organization.province].filter(Boolean).join(' ');
        if (locationPart) parts.push(locationPart);
        return parts.join(', ');
      };

      const orgFullAddress = buildOrgFullAddress();

      if (organization.logoUrl) {
        const logoBase64 = await loadImageAsBase64(organization.logoUrl);
        if (logoBase64) {
          doc.addImage(logoBase64, 'PNG', margin, y, 30, 30);
          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
          doc.text(organization.name || '', margin + 35, y + 10);
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          doc.text(`CIF: ${organization.taxId || 'N/A'}`, margin + 35, y + 16);
          if (orgFullAddress) {
            doc.setFontSize(9);
            const headerAddress = doc.splitTextToSize(orgFullAddress, contentWidth - 35);
            doc.text(headerAddress, margin + 35, y + 22);
          }
          y += 38;
        } else {
          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
          doc.text(organization.name || '', pageWidth / 2, y, { align: 'center' });
          y += 6;
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          doc.text(`CIF: ${organization.taxId || 'N/A'}`, pageWidth / 2, y, { align: 'center' });
          y += 5;
          if (orgFullAddress) {
            doc.setFontSize(9);
            doc.text(orgFullAddress, pageWidth / 2, y, { align: 'center' });
            y += 5;
          }
          y += 5;
        }
      } else {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(organization.name || '', pageWidth / 2, y, { align: 'center' });
        y += 6;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`CIF: ${organization.taxId || 'N/A'}`, pageWidth / 2, y, { align: 'center' });
        y += 5;
        if (orgFullAddress) {
          doc.setFontSize(9);
          doc.text(orgFullAddress, pageWidth / 2, y, { align: 'center' });
          y += 5;
        }
        y += 5;
      }

      // Línia separadora
      doc.setDrawColor(180);
      doc.line(margin, y, pageWidth - margin, y);
      y += 15;

      // ═══════════════════════════════════════════════════════════════════════
      // TÍTOL DEL CERTIFICAT
      // ═══════════════════════════════════════════════════════════════════════

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(t.donorDetail.certificate.annualTitle, pageWidth / 2, y, { align: 'center' });
      y += 7;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(t.certificates.pdf.fiscalYear(yearLabel), pageWidth / 2, y, { align: 'center' });
      y += 18;

      // ═══════════════════════════════════════════════════════════════════════
      // COS DEL CERTIFICAT - FORMAT FORMAL
      // ═══════════════════════════════════════════════════════════════════════

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');

      // Línia 1: D./Dª [Signant], en representació de [Entitat],
      const signatoryPrefix = donor.donorType === 'company' ? '' : 'D./Dª ';
      const signatoryName = organization.signatoryName || '[Representant]';
      const line1 = `${signatoryPrefix}${signatoryName}, ${t.donorDetail.certificate.inRepresentationOf} ${organization.name},`;
      const line1Wrapped = doc.splitTextToSize(line1, contentWidth);
      doc.text(line1Wrapped, margin, y);
      y += line1Wrapped.length * lineHeight;

      // Línia 2: con CIF [CIF], domicilio en [Adreça completa],
      const line2 = `${t.donorDetail.certificate.withCif} ${organization.taxId}, ${t.donorDetail.certificate.domiciledAt} ${orgFullAddress || t.donorDetail.certificate.addressPlaceholder},`;
      const line2Wrapped = doc.splitTextToSize(line2, contentWidth);
      doc.text(line2Wrapped, margin, y);
      y += line2Wrapped.length * lineHeight + 8;

      // CERTIFICA (destacat i centrat)
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(t.donorDetail.certificate.certifies, pageWidth / 2, y, { align: 'center' });
      y += 12;

      // Primer paràgraf: Que [Donant] con DNI/CIF [NIF] y domicilio en [Adreça], donó...
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      // Construir adreça completa del donant (adreça + CP + ciutat)
      const donorAddressParts: string[] = [];
      if (donor.address) donorAddressParts.push(donor.address);
      const donorLocationPart = [donor.zipCode, donor.city, donor.province].filter(Boolean).join(' ');
      if (donorLocationPart) donorAddressParts.push(donorLocationPart);
      const donorAddress = donorAddressParts.length > 0 ? donorAddressParts.join(', ') : '';
      // Usar plantilla institucional consistent amb el certificat massiu
      const paragraph1 = donorAddress
        ? t.certificates.pdf.donorBodyWithAddress(donor.name, donor.taxId || 'N/A', donorAddress, yearLabel, formatCurrencyEU(netAmount), donationsCount)
        : t.certificates.pdf.donorBody(donor.name, donor.taxId || 'N/A', yearLabel, formatCurrencyEU(netAmount), donationsCount);
      const paragraph1Wrapped = doc.splitTextToSize(paragraph1, contentWidth);
      doc.text(paragraph1Wrapped, margin, y);
      y += paragraph1Wrapped.length * lineHeight + 6;

      // Segon paràgraf: Clàusula irrevocable
      const paragraph2 = t.certificates.pdf.irrevocableClause;
      const paragraph2Wrapped = doc.splitTextToSize(paragraph2, contentWidth);
      doc.text(paragraph2Wrapped, margin, y);
      y += paragraph2Wrapped.length * lineHeight + 6;

      // Tercer paràgraf: Y para que así conste...
      const today = new Date();
      const monthNames = Object.keys(t.months);
      const monthName = t.months[monthNames[today.getMonth()] as keyof typeof t.months];
      const cityName = organization.city || t.donorDetail.certificate.cityPlaceholder;
      const paragraph3 = `${t.donorDetail.certificate.issuedIn} ${cityName} ${t.donorDetail.certificate.issuedOn} ${today.getDate()} de ${monthName} de ${today.getFullYear()}.`;
      const paragraph3Wrapped = doc.splitTextToSize(paragraph3, contentWidth);
      doc.text(paragraph3Wrapped, margin, y);
      y += paragraph3Wrapped.length * lineHeight + 15;

      // ═══════════════════════════════════════════════════════════════════════
      // BLOC DE RESUM FISCAL (només si hi ha devolucions)
      // ═══════════════════════════════════════════════════════════════════════

      if (returnedAmount > 0) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setDrawColor(200);
        doc.setFillColor(250, 250, 250);

        const boxX = margin + 20;
        const boxWidth = pageWidth - margin * 2 - 40;
        const boxHeight = 32;
        doc.roundedRect(boxX, y - 4, boxWidth, boxHeight, 2, 2, 'FD');

        y += 6;
        doc.setFont('helvetica', 'bold');
        doc.text(t.donorDetail.certificate.fiscalSummary, boxX + 5, y);
        y += lineHeight;

        doc.setFont('helvetica', 'normal');
        const col1 = boxX + 5;
        const col2 = boxX + boxWidth - 5;

        doc.text(t.donorDetail.certificate.receivedDonations, col1, y);
        doc.text(formatCurrencyEU(grossAmount), col2, y, { align: 'right' });
        y += lineHeight;

        doc.text(t.donorDetail.certificate.processedReturns, col1, y);
        doc.text(`-${formatCurrencyEU(returnedAmount)}`, col2, y, { align: 'right' });
        y += lineHeight;

        doc.setFont('helvetica', 'bold');
        doc.text(t.donorDetail.certificate.certifiedNetAmount, col1, y);
        doc.text(formatCurrencyEU(netAmount), col2, y, { align: 'right' });

        y += lineHeight * 2;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // NOTA LEGAL
      // ═══════════════════════════════════════════════════════════════════════

      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      const legalText = t.donorDetail.certificate.legalNote;
      const legalLines = doc.splitTextToSize(legalText, contentWidth);
      doc.text(legalLines, margin, y);
      y += legalLines.length * 4 + 15;

      // ═══════════════════════════════════════════════════════════════════════
      // FIRMA (centrada a la dreta)
      // ═══════════════════════════════════════════════════════════════════════

      const signatureX = pageWidth - margin - 60;

      if (organization.signatureUrl) {
        const signatureBase64 = await loadImageAsBase64(organization.signatureUrl);
        if (signatureBase64) {
          doc.addImage(signatureBase64, 'PNG', signatureX, y, 50, 25);
          y += 28;
        }
      }

      if (organization.signatoryName) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(organization.signatoryName, signatureX + 25, y, { align: 'center' });
        y += 5;
      }
      if (organization.signatoryRole) {
        doc.setFont('helvetica', 'normal');
        doc.text(organization.signatoryRole, signatureX + 25, y, { align: 'center' });
      }

      // Descarregar
      const fileName = `Certificat_Anual_${yearLabel}_${donor.name.replace(/\s+/g, '_')}.pdf`;
      doc.save(fileName);

      toast({
        title: t.donorDetail.certificate.generated,
        description: fileName,
      });
    } catch (error) {
      console.error('Error generating annual certificate:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: t.donorDetail.certificate.error,
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // ════════════════════════════════════════════════════════════════════════════
  // ENVIAMENT PER EMAIL
  // ════════════════════════════════════════════════════════════════════════════

  // Genera el PDF i retorna el base64 (sense el prefix data:)
  const generatePDFBase64 = (doc: jsPDF): string => {
    const pdfOutput = doc.output('datauristring');
    // Treure el prefix "data:application/pdf;filename=generated.pdf;base64,"
    const base64 = pdfOutput.split(',')[1];
    return base64;
  };

  // Enviar certificat individual per email
  const sendCertificateByEmail = async (tx: Transaction) => {
    if (!donor || !organization) return;
    const blockedMessage = getIndividualCertificateBlockMessage(tx, 'email');
    if (blockedMessage) {
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: blockedMessage,
      });
      return;
    }

    if (!donor.email) {
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: t.certificates.email.errorNoEmail,
      });
      return;
    }

    setIsSendingEmail(true);
    try {
      // Generar el PDF primer (reutilitzem la lògica de generateCertificate)
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      const contentWidth = pageWidth - margin * 2;
      let y = margin;
      const lineHeight = 7;

      // Helper per construir l'adreça completa de l'organització
      const buildOrgFullAddress = (): string => {
        const parts: string[] = [];
        if (organization.address) parts.push(organization.address);
        const locationPart = [organization.zipCode, organization.city, organization.province].filter(Boolean).join(' ');
        if (locationPart) parts.push(locationPart);
        return parts.join(', ');
      };

      const orgFullAddress = buildOrgFullAddress();

      // Capçalera amb logo
      if (organization.logoUrl) {
        const logoBase64 = await loadImageAsBase64(organization.logoUrl);
        if (logoBase64) {
          doc.addImage(logoBase64, 'PNG', margin, y, 30, 30);
          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
          doc.text(organization.name || '', margin + 35, y + 10);
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          doc.text(`CIF: ${organization.taxId || 'N/A'}`, margin + 35, y + 16);
          if (orgFullAddress) {
            doc.setFontSize(9);
            const headerAddress = doc.splitTextToSize(orgFullAddress, contentWidth - 35);
            doc.text(headerAddress, margin + 35, y + 22);
          }
          y += 38;
        } else {
          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
          doc.text(organization.name || '', pageWidth / 2, y, { align: 'center' });
          y += 6;
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          doc.text(`CIF: ${organization.taxId || 'N/A'}`, pageWidth / 2, y, { align: 'center' });
          y += 5;
          if (orgFullAddress) {
            doc.setFontSize(9);
            doc.text(orgFullAddress, pageWidth / 2, y, { align: 'center' });
            y += 5;
          }
          y += 5;
        }
      } else {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(organization.name || '', pageWidth / 2, y, { align: 'center' });
        y += 6;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`CIF: ${organization.taxId || 'N/A'}`, pageWidth / 2, y, { align: 'center' });
        y += 5;
        if (orgFullAddress) {
          doc.setFontSize(9);
          doc.text(orgFullAddress, pageWidth / 2, y, { align: 'center' });
          y += 5;
        }
        y += 5;
      }

      // Línia separadora
      doc.setDrawColor(180);
      doc.line(margin, y, pageWidth - margin, y);
      y += 15;

      // Títol del certificat
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(t.donorDetail.certificate.title, pageWidth / 2, y, { align: 'center' });
      y += 18;

      // Cos del certificat
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');

      const signatoryPrefix = donor.donorType === 'company' ? '' : 'D./Dª ';
      const signatoryName = organization.signatoryName || '[Representant]';
      const line1 = `${signatoryPrefix}${signatoryName}, ${t.donorDetail.certificate.inRepresentationOf} ${organization.name},`;
      const line1Wrapped = doc.splitTextToSize(line1, contentWidth);
      doc.text(line1Wrapped, margin, y);
      y += line1Wrapped.length * lineHeight;

      const line2 = `${t.donorDetail.certificate.withCif} ${organization.taxId}, ${t.donorDetail.certificate.domiciledAt} ${orgFullAddress || t.donorDetail.certificate.addressPlaceholder},`;
      const line2Wrapped = doc.splitTextToSize(line2, contentWidth);
      doc.text(line2Wrapped, margin, y);
      y += line2Wrapped.length * lineHeight + 8;

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(t.donorDetail.certificate.certifies, pageWidth / 2, y, { align: 'center' });
      y += 12;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      const donorAddressParts: string[] = [];
      if (donor.address) donorAddressParts.push(donor.address);
      const donorLocationPart = [donor.zipCode, donor.city, donor.province].filter(Boolean).join(' ');
      if (donorLocationPart) donorAddressParts.push(donorLocationPart);
      const donorAddress = donorAddressParts.length > 0 ? donorAddressParts.join(', ') : t.donorDetail.certificate.donorAddressMissing;
      const paragraph1 = `${t.donorDetail.certificate.thatDonor} ${donor.name} ${t.donorDetail.certificate.withNifCif} ${donor.taxId} ${t.donorDetail.certificate.andDomicile} ${donorAddress}, ${t.donorDetail.certificate.donatedAmount} ${formatCurrencyEU(tx.amount)} ${t.donorDetail.certificate.onDate} ${formatDate(tx.date)} ${t.donorDetail.certificate.toTheEntity}`;
      const paragraph1Wrapped = doc.splitTextToSize(paragraph1, contentWidth);
      doc.text(paragraph1Wrapped, margin, y);
      y += paragraph1Wrapped.length * lineHeight + 6;

      const paragraph2 = t.donorDetail.certificate.irrevocableClause;
      const paragraph2Wrapped = doc.splitTextToSize(paragraph2, contentWidth);
      doc.text(paragraph2Wrapped, margin, y);
      y += paragraph2Wrapped.length * lineHeight + 6;

      const today = new Date();
      const monthNames = Object.keys(t.months);
      const monthName = t.months[monthNames[today.getMonth()] as keyof typeof t.months];
      const cityName = organization.city || t.donorDetail.certificate.cityPlaceholder;
      const paragraph3 = `${t.donorDetail.certificate.issuedIn} ${cityName} ${t.donorDetail.certificate.issuedOn} ${today.getDate()} de ${monthName} de ${today.getFullYear()}.`;
      const paragraph3Wrapped = doc.splitTextToSize(paragraph3, contentWidth);
      doc.text(paragraph3Wrapped, margin, y);
      y += paragraph3Wrapped.length * lineHeight + 15;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      const legalText = t.donorDetail.certificate.legalNote;
      const legalLines = doc.splitTextToSize(legalText, contentWidth);
      doc.text(legalLines, margin, y);
      y += legalLines.length * 4 + 15;

      const signatureX = pageWidth - margin - 60;
      if (organization.signatureUrl) {
        const signatureBase64 = await loadImageAsBase64(organization.signatureUrl);
        if (signatureBase64) {
          doc.addImage(signatureBase64, 'PNG', signatureX, y, 50, 25);
          y += 28;
        }
      }
      if (organization.signatoryName) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(organization.signatoryName, signatureX + 25, y, { align: 'center' });
        y += 5;
      }
      if (organization.signatoryRole) {
        doc.setFont('helvetica', 'normal');
        doc.text(organization.signatoryRole, signatureX + 25, y, { align: 'center' });
      }

      // Obtenir base64 del PDF
      const pdfBase64 = generatePDFBase64(doc);
      const txYear = tx.date.substring(0, 4);

      const authHeaders = await getAuthHeaders();
      if (!authHeaders) return;

      // Enviar via API (amb informació de donació individual)
      const response = await fetch('/api/certificates/send-email', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          organizationId,
          organizationName: organization.name || '',
          organizationEmail: organization.email,
          organizationLanguage: certificateLanguage,
          donors: [{
            id: donor.id,
            name: donor.name,
            email: donor.email,
            pdfBase64,
            singleDonation: {
              date: formatDate(tx.date),
              amount: formatCurrencyEU(tx.amount),
            },
          }],
          year: txYear,
        }),
      });

      const result = await response.json();
      const sentCount = Number(result?.totals?.sent ?? result?.sent ?? 0);

      if (response.ok && sentCount > 0) {
        toast({
          title: t.certificates.email.successOne,
          description: t.certificates.email.successOneDescription(donor.name),
        });
      } else if (response.status === 429) {
        toast({
          variant: 'destructive',
          title: t.common.error,
          description: tr('certificates.email.dailyQuotaExceeded'),
        });
      } else {
        toast({ variant: 'destructive', title: t.common.error, description: t.certificates.email.errorSending });
      }
    } catch (error) {
      console.error('Error sending certificate by email:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: t.certificates.email.errorSending,
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Enviar certificat anual per email
  const sendAnnualCertificateByEmail = async (year: string) => {
    if (!donor || !organization) return;

    if (!donor.email) {
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: t.certificates.email.errorNoEmail,
      });
      return;
    }

    const annualScope = resolveAnnualCertificateScope(year);
    if (!annualScope) return;

    const { yearLabel, grossAmount, returnedAmount, netAmount, donationsCount } = annualScope;

    if (netAmount === 0) {
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: tr('certificates.netZeroBlocked'),
      });
      return;
    }

    setIsSendingEmail(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      const contentWidth = pageWidth - margin * 2;
      let y = margin;
      const lineHeight = 7;

      // Helper per construir l'adreça completa de l'organització
      const buildOrgFullAddress = (): string => {
        const parts: string[] = [];
        if (organization.address) parts.push(organization.address);
        const locationPart = [organization.zipCode, organization.city, organization.province].filter(Boolean).join(' ');
        if (locationPart) parts.push(locationPart);
        return parts.join(', ');
      };

      const orgFullAddress = buildOrgFullAddress();

      // Capçalera amb logo
      if (organization.logoUrl) {
        const logoBase64 = await loadImageAsBase64(organization.logoUrl);
        if (logoBase64) {
          doc.addImage(logoBase64, 'PNG', margin, y, 30, 30);
          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
          doc.text(organization.name || '', margin + 35, y + 10);
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          doc.text(`CIF: ${organization.taxId || 'N/A'}`, margin + 35, y + 16);
          if (orgFullAddress) {
            doc.setFontSize(9);
            const headerAddress = doc.splitTextToSize(orgFullAddress, contentWidth - 35);
            doc.text(headerAddress, margin + 35, y + 22);
          }
          y += 38;
        } else {
          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
          doc.text(organization.name || '', pageWidth / 2, y, { align: 'center' });
          y += 6;
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          doc.text(`CIF: ${organization.taxId || 'N/A'}`, pageWidth / 2, y, { align: 'center' });
          y += 5;
          if (orgFullAddress) {
            doc.setFontSize(9);
            doc.text(orgFullAddress, pageWidth / 2, y, { align: 'center' });
            y += 5;
          }
          y += 5;
        }
      } else {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(organization.name || '', pageWidth / 2, y, { align: 'center' });
        y += 6;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`CIF: ${organization.taxId || 'N/A'}`, pageWidth / 2, y, { align: 'center' });
        y += 5;
        if (orgFullAddress) {
          doc.setFontSize(9);
          doc.text(orgFullAddress, pageWidth / 2, y, { align: 'center' });
          y += 5;
        }
        y += 5;
      }

      // Línia separadora
      doc.setDrawColor(180);
      doc.line(margin, y, pageWidth - margin, y);
      y += 15;

      // Títol del certificat
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(t.donorDetail.certificate.annualTitle, pageWidth / 2, y, { align: 'center' });
      y += 7;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(t.certificates.pdf.fiscalYear(yearLabel), pageWidth / 2, y, { align: 'center' });
      y += 18;

      // Cos del certificat
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');

      const signatoryPrefix = donor.donorType === 'company' ? '' : 'D./Dª ';
      const signatoryName = organization.signatoryName || '[Representant]';
      const line1 = `${signatoryPrefix}${signatoryName}, ${t.donorDetail.certificate.inRepresentationOf} ${organization.name},`;
      const line1Wrapped = doc.splitTextToSize(line1, contentWidth);
      doc.text(line1Wrapped, margin, y);
      y += line1Wrapped.length * lineHeight;

      const line2 = `${t.donorDetail.certificate.withCif} ${organization.taxId}, ${t.donorDetail.certificate.domiciledAt} ${orgFullAddress || t.donorDetail.certificate.addressPlaceholder},`;
      const line2Wrapped = doc.splitTextToSize(line2, contentWidth);
      doc.text(line2Wrapped, margin, y);
      y += line2Wrapped.length * lineHeight + 8;

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(t.donorDetail.certificate.certifies, pageWidth / 2, y, { align: 'center' });
      y += 12;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      const donorAddressParts: string[] = [];
      if (donor.address) donorAddressParts.push(donor.address);
      const donorLocationPart = [donor.zipCode, donor.city, donor.province].filter(Boolean).join(' ');
      if (donorLocationPart) donorAddressParts.push(donorLocationPart);
      const donorAddress = donorAddressParts.length > 0 ? donorAddressParts.join(', ') : '';
      // Usar plantilla institucional consistent amb el certificat massiu
      const paragraph1 = donorAddress
        ? t.certificates.pdf.donorBodyWithAddress(donor.name, donor.taxId || 'N/A', donorAddress, yearLabel, formatCurrencyEU(netAmount), donationsCount)
        : t.certificates.pdf.donorBody(donor.name, donor.taxId || 'N/A', yearLabel, formatCurrencyEU(netAmount), donationsCount);
      const paragraph1Wrapped = doc.splitTextToSize(paragraph1, contentWidth);
      doc.text(paragraph1Wrapped, margin, y);
      y += paragraph1Wrapped.length * lineHeight + 6;

      const paragraph2 = t.certificates.pdf.irrevocableClause;
      const paragraph2Wrapped = doc.splitTextToSize(paragraph2, contentWidth);
      doc.text(paragraph2Wrapped, margin, y);
      y += paragraph2Wrapped.length * lineHeight + 6;

      const today = new Date();
      const monthNames = Object.keys(t.months);
      const monthName = t.months[monthNames[today.getMonth()] as keyof typeof t.months];
      const cityName = organization.city || t.donorDetail.certificate.cityPlaceholder;
      const paragraph3 = `${t.donorDetail.certificate.issuedIn} ${cityName} ${t.donorDetail.certificate.issuedOn} ${today.getDate()} de ${monthName} de ${today.getFullYear()}.`;
      const paragraph3Wrapped = doc.splitTextToSize(paragraph3, contentWidth);
      doc.text(paragraph3Wrapped, margin, y);
      y += paragraph3Wrapped.length * lineHeight + 15;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      const legalText = t.donorDetail.certificate.legalNote;
      const legalLines = doc.splitTextToSize(legalText, contentWidth);
      doc.text(legalLines, margin, y);
      y += legalLines.length * 4 + 15;

      const signatureX = pageWidth - margin - 60;
      if (organization.signatureUrl) {
        const signatureBase64 = await loadImageAsBase64(organization.signatureUrl);
        if (signatureBase64) {
          doc.addImage(signatureBase64, 'PNG', signatureX, y, 50, 25);
          y += 28;
        }
      }
      if (organization.signatoryName) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(organization.signatoryName, signatureX + 25, y, { align: 'center' });
        y += 5;
      }
      if (organization.signatoryRole) {
        doc.setFont('helvetica', 'normal');
        doc.text(organization.signatoryRole, signatureX + 25, y, { align: 'center' });
      }

      // Obtenir base64 del PDF
      const pdfBase64 = generatePDFBase64(doc);

      const authHeaders = await getAuthHeaders();
      if (!authHeaders) return;

      // Enviar via API
      const response = await fetch('/api/certificates/send-email', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          organizationId,
          organizationName: organization.name || '',
          organizationEmail: organization.email,
          organizationLanguage: certificateLanguage,
          donors: [{
            id: donor.id,
            name: donor.name,
            email: donor.email,
            pdfBase64,
          }],
          year: yearLabel,
        }),
      });

      const result = await response.json();
      const sentCount = Number(result?.totals?.sent ?? result?.sent ?? 0);

      if (response.ok && sentCount > 0) {
        toast({
          title: t.certificates.email.successOne,
          description: t.certificates.email.successOneDescription(donor.name),
        });
      } else if (response.status === 429) {
        toast({
          variant: 'destructive',
          title: t.common.error,
          description: tr('certificates.email.dailyQuotaExceeded'),
        });
      } else {
        toast({ variant: 'destructive', title: t.common.error, description: t.certificates.email.errorSending });
      }
    } catch (error) {
      console.error('Error sending annual certificate by email:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: t.certificates.email.errorSending,
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  if (!donor) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {donor.donorType === 'individual' ? (
                <User className="h-8 w-8 text-muted-foreground" />
              ) : (
                <Building2 className="h-8 w-8 text-muted-foreground" />
              )}
              <div>
                <SheetTitle className="text-xl">{donor.name}</SheetTitle>
                <SheetDescription className="flex items-center gap-2 mt-1">
                  {donor.taxId || <span className="text-amber-500">{t.donorDetail.noTaxId}</span>}
                  <span className="text-muted-foreground">·</span>
                  <Badge variant="outline">
                    {donor.donorType === 'individual' ? t.donors.types.individual : t.donors.types.company}
                  </Badge>
                </SheetDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => onEdit(donor)}>
              <Edit className="h-4 w-4 mr-1" />
              {t.common.edit}
            </Button>
          </div>

          {/* Badges de modalitat i estat */}
          <div className="flex items-center gap-2 mt-3">
            {donor.membershipType === 'recurring' ? (
              <Badge className="bg-green-100 text-green-800">
                <RefreshCw className="mr-1 h-3 w-3" />
                {t.donors.membership.recurring}
                {donor.monthlyAmount && ` (${formatCurrencyEU(donor.monthlyAmount)}/${getPeriodicitySuffix(donor.periodicityQuota, t)})`}
              </Badge>
            ) : (
              <Badge variant="secondary">{t.donors.membership.oneTime}</Badge>
            )}
            {hasCompleteData ? (
              <Badge variant="outline" className="text-green-600 border-green-300">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                {t.donorDetail.completeData}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-amber-600 border-amber-300">
                <AlertTriangle className="mr-1 h-3 w-3" />
                {t.donorDetail.incompleteData}
              </Badge>
            )}
          </div>
        </SheetHeader>

        {/* Missatge d'error de permisos */}
        {permissionError && (
          <div className="my-4 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-center gap-2 text-amber-800">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <p className="text-sm">{t.donorDetail.permissionError || "No s'ha pogut carregar l'historial de donacions."}</p>
          </div>
        )}

        {/* Bloc resum */}
        <div className="py-4 space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {t.donorDetail.summary}
          </h3>

          <div className="grid grid-cols-2 gap-3">
            {/* Total històric */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {t.donorDetail.totalHistoric}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-green-600">
                  {formatCurrencyEU(summary.totalHistoric)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {summary.totalHistoricCount} {summary.totalHistoricCount === 1 ? t.donorDetail.donation : t.donorDetail.donations}
                </p>
              </CardContent>
            </Card>

            {/* Any actual */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {t.donorDetail.currentYear} ({summary.scopeYear})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-blue-600">
                  {formatCurrencyEU(summary.currentYear)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {summary.currentYearCount} {summary.currentYearCount === 1 ? t.donorDetail.donation : t.donorDetail.donations}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t.donorDetail.previousYear} ({summary.scopeYear - 1}): {formatCurrencyEU(summary.previousYear)}
                </p>
              </CardContent>
            </Card>

            {/* Última donació */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Euro className="h-3 w-3" />
                  {t.donorDetail.lastDonation}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-semibold">
                  {summary.lastDonationDate ? formatDate(summary.lastDonationDate) : '-'}
                </div>
              </CardContent>
            </Card>

            {/* Import net certificable */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {t.donorDetail.netCertifiable} ({summary.scopeYear})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-blue-600">
                  {formatCurrencyEU(summary.currentYearNet)}
                </div>
                {summary.currentYearReturned > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {t.donorDetail.afterReturns}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {t.donorDetail.noReturns}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {t.donorDetail.previousYear} ({summary.scopeYear - 1}): {formatCurrencyEU(summary.previousYearNet)}
                </p>
              </CardContent>
            </Card>

            {/* Devolucions (només si n'hi ha) */}
            {summary.returns.count > 0 && (
              <Card className="border-orange-200 bg-orange-50/50 col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-orange-600 flex items-center gap-1">
                    <Undo2 className="h-3 w-3" />
                    {t.donorDetail.returns}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Resum principal */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-lg font-semibold text-orange-600">
                        {summary.returns.count} {summary.returns.count === 1 ? t.donorDetail.returnSingular : t.donorDetail.returnPlural}
                      </div>
                      <p className="text-sm text-orange-500">
                        {t.donorDetail.totalReturned} {formatCurrencyEU(summary.returns.amount)}
                      </p>
                      {summary.returns.lastDate && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {t.donorDetail.lastReturnDate} {formatDate(summary.returns.lastDate)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Llista de les últimes devolucions */}
                  {summary.returns.items.length > 0 && (
                    <div className="border-t border-orange-200 pt-2">
                      <p className="text-xs font-medium text-muted-foreground mb-2">{t.donorDetail.recentReturns}</p>
                      <div className="space-y-1.5">
                        {summary.returns.items.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                              {formatDate(item.date)}
                            </span>
                            <span className="text-orange-600 font-mono">
                              {formatCurrencyEU(item.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Botó per veure totes */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-orange-600 border-orange-300 hover:bg-orange-100"
                    asChild
                  >
                    <Link href={`/${orgSlug}/dashboard/movimientos?filter=returns&contactId=${donor.id}`}>
                      <ExternalLink className="h-3 w-3 mr-1" />
                      {t.donorDetail.viewInMovements}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Historial de donacions (col·lapsable) */}
        <div className="border-t pt-4">
          <Collapsible open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
            <div className="flex items-center justify-between">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 p-0 h-auto">
                  {isHistoryOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  <span className="text-sm font-semibold">
                    {t.donorDetail.donationHistory}
                  </span>
                </Button>
              </CollapsibleTrigger>

              {isHistoryOpen && (
                <div className="flex gap-2">
                  {/* Descarregar certificat anual */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" disabled={!donor.taxId || isGeneratingPdf}>
                        <Download className="h-4 w-4 mr-1" />
                        {t.donorDetail.annualCertificate}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {availableYears.map(year => (
                        <DropdownMenuItem
                          key={year}
                          onClick={() => generateAnnualCertificate(year)}
                        >
                          {year}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {/* Enviar certificat anual per email */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!donor.taxId || !donor.email || isSendingEmail}
                        {...(!donor.email ? { title: t.certificates.email.errorNoEmail } : {})}
                      >
                        {isSendingEmail ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Mail className="h-4 w-4 mr-1" />
                        )}
                        {t.certificates.email.sendOne}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {availableYears.map(year => (
                        <DropdownMenuItem
                          key={year}
                          onClick={() => sendAnnualCertificateByEmail(year)}
                        >
                          {year}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>

            <CollapsibleContent className="mt-4 space-y-4">
              {/* Filtres */}
              <div className="flex items-center gap-2">
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map(year => (
                      <SelectItem key={year} value={year}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as 'all' | 'returns')}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t.donorDetail.filterAll}</SelectItem>
                    <SelectItem value="returns">{t.donorDetail.filterReturns}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Taula */}
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredTransactions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {t.donorDetail.noDonationsInPeriod}
                </div>
              ) : (
                <TooltipProvider>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t.donorDetail.date}</TableHead>
                          <TableHead>{t.donorDetail.concept}</TableHead>
                          <TableHead className="text-right">{t.donorDetail.amount}</TableHead>
                          <TableHead className="text-center">{t.donorDetail.status}</TableHead>
                          <TableHead className="text-right">{t.donorDetail.actions}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedTransactions.map((tx, index) => {
                          const isReturn = tx.transactionType === 'return';
                          const isReturned = tx.donationStatus === 'returned';
                          const downloadBlockedMessage = getIndividualCertificateBlockMessage(tx, 'download');
                          const emailBlockedMessage = getIndividualCertificateBlockMessage(tx, 'email');
                          const canDownloadCertificate = !downloadBlockedMessage;
                          const canSendCertificateByEmail = !emailBlockedMessage;

                          return (
                            <TableRow key={tx.id || `tx-${index}`} className={isReturn ? 'bg-orange-50/50' : ''}>
                              <TableCell className="text-sm">
                                {formatDate(tx.date)}
                              </TableCell>
                              <TableCell className="max-w-[150px] truncate text-sm">
                                {tx.note || tx.description}
                              </TableCell>
                              <TableCell className={`text-right font-mono ${isReturn ? 'text-orange-600' : 'text-green-600'}`}>
                                {isReturn && <Undo2 className="inline h-3 w-3 mr-1" />}
                                {formatCurrencyEU(tx.amount)}
                              </TableCell>
                              <TableCell className="text-center">
                                {isReturn ? (
                                  <Badge variant="outline" className="text-orange-600 border-orange-300">
                                    {t.donorDetail.returnBadge}
                                  </Badge>
                                ) : isReturned ? (
                                  <Badge variant="outline" className="text-red-600 border-red-300">
                                    {t.donorDetail.returnedBadge}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-green-600 border-green-300">
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    OK
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {!isReturn && !isReturned && (
                                  <div className="flex justify-end gap-1">
                                    {/* Descarregar certificat individual */}
                                    {canDownloadCertificate ? (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => generateCertificate(tx)}
                                            disabled={isGeneratingPdf}
                                          >
                                            {isGeneratingPdf ? (
                                              <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                              <Download className="h-4 w-4" />
                                            )}
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          {t.donorDetail.certificate.downloadPdf}
                                        </TooltipContent>
                                      </Tooltip>
                                    ) : (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              disabled
                                            >
                                              <Download className="h-4 w-4 text-muted-foreground" />
                                            </Button>
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          {downloadBlockedMessage}
                                        </TooltipContent>
                                      </Tooltip>
                                    )}
                                    {/* Enviar certificat individual per email */}
                                    {canSendCertificateByEmail ? (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => sendCertificateByEmail(tx)}
                                            disabled={isSendingEmail}
                                          >
                                            {isSendingEmail ? (
                                              <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                              <Mail className="h-4 w-4" />
                                            )}
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          {t.certificates.email.sendOne}
                                        </TooltipContent>
                                      </Tooltip>
                                    ) : (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              disabled
                                            >
                                              <Mail className="h-4 w-4 text-muted-foreground" />
                                            </Button>
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          {emailBlockedMessage}
                                        </TooltipContent>
                                      </Tooltip>
                                    )}
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Paginació */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-2">
                      <p className="text-sm text-muted-foreground">
                        {t.donorDetail.showing} {(currentPage - 1) * itemsPerPage + 1}-
                        {Math.min(currentPage * itemsPerPage, filteredTransactions.length)} {t.donorDetail.of} {filteredTransactions.length}
                      </p>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                        >
                          {t.donorDetail.previous}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                        >
                          {t.donorDetail.next}
                        </Button>
                      </div>
                    </div>
                  )}
                </TooltipProvider>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>
      </SheetContent>
    </Sheet>
  );
}
