'use client';

import * as React from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { useCurrentOrganization } from '@/hooks/organization-provider';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import type { Transaction, Donor, Organization } from '@/lib/data';
import { formatCurrencyEU } from '@/lib/normalize';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
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
  FileText,
  Download,
  Mail,
  Eye,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Users,
  Euro,
  Calendar,
  Undo2,
  Send,
  User,
  MoreVertical,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from '@/i18n';
import type { jsPDF } from 'jspdf';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { usePermissions } from '@/hooks/use-permissions';
import { MobileListItem } from '@/components/mobile/mobile-list-item';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { MOBILE_ACTIONS_BAR, MOBILE_CTA_PRIMARY, MOBILE_CTA_TRUNCATE } from '@/lib/ui/mobile-actions';
import { calculateTransactionNetAmount } from '@/lib/model182';
import { getUnifiedFiscalDonationsWithClient } from '@/lib/fiscal/getUnifiedFiscalDonations';

let jsPdfModulePromise: Promise<typeof import('jspdf')> | null = null;

async function loadJsPdf() {
  if (!jsPdfModulePromise) {
    jsPdfModulePromise = import('jspdf');
  }
  return jsPdfModulePromise;
}

// Tipus per al resum de donacions per donant
interface DonorSummary {
  donor: Donor;
  donations: Transaction[];
  returns: Transaction[];
  totalAmount: number;
  grossAmount: number;
  returnedAmount: number;
  donationCount: number;
  returnCount: number;
  hasEmail: boolean;
}

// Tipus ampliat per organització amb logo
interface OrganizationWithLogo extends Organization {
  logoUrl?: string;
}

// Netejar nom (treure espais extra)
const cleanName = (name: string): string => {
  return name.trim().replace(/\s+/g, ' ');
};

// Carregar imatge com a base64 amb suport per cancel·lació
const loadImageAsBase64 = (url: string, signal?: AbortSignal): Promise<string | null> => {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';

    // Cleanup si s'aborta
    const cleanup = () => {
      img.onload = null;
      img.onerror = null;
      img.src = '';
    };

    if (signal) {
      signal.addEventListener('abort', () => {
        cleanup();
        resolve(null);
      });
    }

    img.onload = () => {
      if (signal?.aborted) {
        cleanup();
        resolve(null);
        return;
      }
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } else {
          resolve(null);
        }
      } catch (e) {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
};

export function DonationCertificateGenerator() {
  const { firestore, user } = useFirebase();
  const { organizationId, organization } = useCurrentOrganization();
  const { can } = usePermissions();
  const { toast } = useToast();
  const { t, tr, language } = useTranslations();
  const isMobile = useIsMobile();
  const canGenerateCertificates = can('fiscal.certificats.generar');
  const certificateLanguage = language === 'ca' ? 'ca' : 'es';

  const ensureCanGenerateCertificates = React.useCallback(() => {
    if (canGenerateCertificates) return true;
    toast({
      variant: 'destructive',
      title: t.common.error,
      description: tr('certificates.permissionDenied'),
    });
    return false;
  }, [canGenerateCertificates, toast, t.common.error]);

  // Lògica per any per defecte: si estem a gener, any anterior; altrament any actual - 1
  // (normalment es generen certificats de l'any anterior)
  const getDefaultYear = () => {
    const now = new Date();
    // L'any anterior és sempre el default per certificats
    return String(now.getFullYear() - 1);
  };

  const [selectedYear, setSelectedYear] = React.useState<string>(getDefaultYear());
  const [hasLoadedList, setHasLoadedList] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [donorSummaries, setDonorSummaries] = React.useState<DonorSummary[]>([]);
  const [selectedDonors, setSelectedDonors] = React.useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [generationProgress, setGenerationProgress] = React.useState(0);
  const [previewDonor, setPreviewDonor] = React.useState<DonorSummary | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);
  const [orgData, setOrgData] = React.useState<OrganizationWithLogo | null>(null);
  const [logoBase64, setLogoBase64] = React.useState<string | null>(null);
  const [totalReturns, setTotalReturns] = React.useState(0);
  // Estats per enviament d'emails
  const [isSendingEmails, setIsSendingEmails] = React.useState(false);
  const [emailConfirmOpen, setEmailConfirmOpen] = React.useState(false);
  const [emailTargetDonor, setEmailTargetDonor] = React.useState<DonorSummary | null>(null);

  const availableYears = React.useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => String(currentYear - i));
  }, []);


  // Convertir número a text segons idioma
  const numberToWords = (num: number): string => {
    const units = language === 'ca' 
      ? ['', 'un', 'dos', 'tres', 'quatre', 'cinc', 'sis', 'set', 'vuit', 'nou']
      : ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
    const tens = language === 'ca'
      ? ['', 'deu', 'vint', 'trenta', 'quaranta', 'cinquanta', 'seixanta', 'setanta', 'vuitanta', 'noranta']
      : ['', 'diez', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
    const teens = language === 'ca'
      ? ['deu', 'onze', 'dotze', 'tretze', 'catorze', 'quinze', 'setze', 'disset', 'divuit', 'dinou']
      : ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
    
    if (num === 0) return 'zero';
    if (num < 0) return (language === 'ca' ? 'menys ' : 'menos ') + numberToWords(-num);
    
    const euros = Math.floor(num);
    const cents = Math.round((num - euros) * 100);
    
    let result = '';
    
    if (euros >= 1000) {
      const thousands = Math.floor(euros / 1000);
      if (thousands === 1) {
        result += t.numbers.thousand + ' ';
      } else {
        result += numberToWords(thousands) + ' ' + t.numbers.thousand + ' ';
      }
    }
    
    const remainder = euros % 1000;
    if (remainder >= 100) {
      const hundreds = Math.floor(remainder / 100);
      if (hundreds === 1) {
        result += t.numbers.hundred + ' ';
      } else {
        result += units[hundreds] + '-' + t.numbers.hundreds + ' ';
      }
    }
    
    const tensUnits = remainder % 100;
    if (tensUnits >= 10 && tensUnits < 20) {
      result += teens[tensUnits - 10] + ' ';
    } else {
      if (tensUnits >= 20) {
        result += tens[Math.floor(tensUnits / 10)];
        if (tensUnits % 10 !== 0) {
          result += (language === 'ca' ? '-' : ' y ') + units[tensUnits % 10];
        }
        result += ' ';
      } else if (tensUnits > 0) {
        result += units[tensUnits] + ' ';
      }
    }
    
    result += t.numbers.euros;
    
    if (cents > 0) {
      result += ' ' + t.numbers.withCents(cents);
    }
    
    return result.trim();
  };

  // Obtenir nom del mes
  const getMonthName = (monthIndex: number): string => {
    const monthKeys = ['january', 'february', 'march', 'april', 'may', 'june', 
                       'july', 'august', 'september', 'october', 'november', 'december'];
    return t.months[monthKeys[monthIndex] as keyof typeof t.months];
  };

  React.useEffect(() => {
    if (!firestore || !organizationId) return;

    const abortController = new AbortController();

    const loadOrgData = async () => {
      try {
        const orgRef = doc(firestore, 'organizations', organizationId);
        const orgSnap = await getDoc(orgRef);

        if (abortController.signal.aborted) return;

        if (orgSnap.exists()) {
          const data = { id: orgSnap.id, ...orgSnap.data() } as OrganizationWithLogo;
          setOrgData(data);

          if (data.logoUrl) {
            const base64 = await loadImageAsBase64(data.logoUrl, abortController.signal);
            if (!abortController.signal.aborted) {
              setLogoBase64(base64);
            }
          }
        }
      } catch (error) {
        if (!abortController.signal.aborted) {
          console.error('Error loading org data:', error);
        }
      }
    };

    loadOrgData();

    return () => {
      abortController.abort();
    };
  }, [firestore, organizationId]);

  const loadDonations = React.useCallback(async () => {
    if (!canGenerateCertificates) return;
    if (!firestore || !organizationId) return;

    setIsLoading(true);
    try {
      const yearStart = `${selectedYear}-01-01`;
      const yearEnd = `${selectedYear}-12-31`;

      const contactsRef = collection(firestore, 'organizations', organizationId, 'contacts');
      const donorsQuery = query(contactsRef, where('type', '==', 'donor'));
      const donorsSnapshot = await getDocs(donorsQuery);
      const donors: Donor[] = donorsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Donor));

      const allTransactions = await getUnifiedFiscalDonationsWithClient({
        firestore,
        organizationId,
        filters: {
          dateFrom: yearStart,
          dateTo: yearEnd,
        },
      });

      const summaries: DonorSummary[] = [];
      let globalReturnsCount = 0;
      
      for (const donor of donors) {
        const donorTransactions = allTransactions.filter(tx => tx.contactId === donor.id);
        const donorDonations = donorTransactions.filter(tx => calculateTransactionNetAmount(tx) > 0);
        const donorReturns = donorTransactions.filter(tx => calculateTransactionNetAmount(tx) < 0);

        const grossAmount = donorDonations.reduce((sum, tx) => sum + calculateTransactionNetAmount(tx), 0);
        const returnedAmount = donorReturns.reduce((sum, tx) => sum + Math.abs(calculateTransactionNetAmount(tx)), 0);
        const netAmount = Math.max(0, grossAmount - returnedAmount);
        
        if (netAmount > 0) {
          globalReturnsCount += donorReturns.length;
          
          summaries.push({
            donor,
            donations: donorDonations.sort((a, b) => a.date.localeCompare(b.date)),
            returns: donorReturns.sort((a, b) => a.date.localeCompare(b.date)),
            totalAmount: netAmount,
            grossAmount,
            returnedAmount,
            donationCount: donorDonations.length,
            returnCount: donorReturns.length,
            hasEmail: !!donor.email,
          });
        }
      }

      summaries.sort((a, b) => b.totalAmount - a.totalAmount);
      
      setDonorSummaries(summaries);
      setSelectedDonors(new Set(summaries.map(s => s.donor.id)));
      setTotalReturns(globalReturnsCount);
      
      if (globalReturnsCount > 0) {
        toast({
          title: t.certificates.returnsDetected,
          description: t.certificates.returnsDetectedDescription(globalReturnsCount),
          duration: 5000,
        });
      }
      
    } catch (error) {
      console.error('Error loading donations:', error);
      toast({ variant: 'destructive', title: t.common.error, description: t.reports.dataNotAvailableDescription });
    } finally {
      setIsLoading(false);
    }
  }, [canGenerateCertificates, firestore, organizationId, selectedYear, toast, t]);

  // Només carregar donacions quan l'usuari ho demana explícitament
  React.useEffect(() => {
    if (hasLoadedList) {
      loadDonations();
    }
  }, [hasLoadedList, loadDonations]);

  const stats = React.useMemo(() => {
    const selected = donorSummaries.filter(s => selectedDonors.has(s.donor.id));
    return {
      totalDonors: donorSummaries.length,
      selectedDonors: selected.length,
      totalAmount: donorSummaries.reduce((sum, s) => sum + s.totalAmount, 0),
      selectedAmount: selected.reduce((sum, s) => sum + s.totalAmount, 0),
      withEmail: donorSummaries.filter(s => s.hasEmail).length,
      selectedWithEmail: selected.filter(s => s.hasEmail).length,
      totalReturned: donorSummaries.reduce((sum, s) => sum + s.returnedAmount, 0),
    };
  }, [donorSummaries, selectedDonors]);

  const toggleDonor = (donorId: string) => {
    const newSelected = new Set(selectedDonors);
    if (newSelected.has(donorId)) {
      newSelected.delete(donorId);
    } else {
      newSelected.add(donorId);
    }
    setSelectedDonors(newSelected);
  };

  const toggleAll = () => {
    if (selectedDonors.size === donorSummaries.length) {
      setSelectedDonors(new Set());
    } else {
      setSelectedDonors(new Set(donorSummaries.map(s => s.donor.id)));
    }
  };

  // Construeix una localització sense duplicats (ex: evita "Madrid Madrid")
  const buildLocationString = (zipCode?: string, city?: string, province?: string): string => {
    const parts: string[] = [];
    if (zipCode) parts.push(zipCode);
    if (city) parts.push(city);
    // Només afegim província si és diferent de la ciutat (case insensitive)
    if (province && province.toLowerCase() !== city?.toLowerCase()) {
      parts.push(province);
    }
    return parts.join(' ');
  };

  const buildFullAddress = (): string => {
    const parts: string[] = [];
    if (orgData?.address) parts.push(orgData.address);
    const locationPart = buildLocationString(orgData?.zipCode, orgData?.city, orgData?.province);
    if (locationPart) parts.push(locationPart);
    return parts.join(', ');
  };

  const generatePDF = async (summary: DonorSummary): Promise<jsPDF> => {
    const { jsPDF } = await loadJsPdf();
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const textWidth = pageWidth - margin * 2;
    let y = margin;

    // Logo
    if (logoBase64) {
      try {
        const logoHeight = 25;
        const logoWidth = 25;
        doc.addImage(logoBase64, 'PNG', (pageWidth - logoWidth) / 2, y, logoWidth, logoHeight);
        y += logoHeight + 5;
      } catch (e) {
        console.error('Error adding logo to PDF:', e);
      }
    }

    // Nom de l'organització
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(orgData?.name || organization?.name || '', pageWidth / 2, y, { align: 'center' });
    y += 7;

    // CIF
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`CIF: ${orgData?.taxId || organization?.taxId || 'N/A'}`, pageWidth / 2, y, { align: 'center' });
    y += 5;

    // Adreça completa (adreça + CP + ciutat)
    const fullAddress = buildFullAddress();
    if (fullAddress) {
      doc.setFontSize(9);
      doc.text(fullAddress, pageWidth / 2, y, { align: 'center' });
      y += 5;
    }
    // Si no hi ha adreça però sí CP i/o ciutat/província, mostrar-los
    if (!fullAddress && (orgData?.zipCode || orgData?.city || orgData?.province)) {
      doc.setFontSize(9);
      const locationText = buildLocationString(orgData?.zipCode, orgData?.city, orgData?.province);
      doc.text(locationText, pageWidth / 2, y, { align: 'center' });
      y += 5;
    }

    // Contacte
    const contactParts: string[] = [];
    if (orgData?.phone) contactParts.push(`Tel: ${orgData.phone}`);
    if (orgData?.email) contactParts.push(orgData.email);
    if (contactParts.length > 0) {
      doc.setFontSize(9);
      doc.text(contactParts.join(' | '), pageWidth / 2, y, { align: 'center' });
      y += 5;
    }

    // Línia separadora
    y += 5;
    doc.setDrawColor(200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 15;

    // ═══════════════════════════════════════════════════════════════════════════
    // TÍTOL I SUBTÍTOL
    // ═══════════════════════════════════════════════════════════════════════════
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(t.certificates.pdf.title, pageWidth / 2, y, { align: 'center' });
    y += 8;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(t.certificates.pdf.fiscalYear(selectedYear), pageWidth / 2, y, { align: 'center' });
    y += 18;

    // ═══════════════════════════════════════════════════════════════════════════
    // COS DEL CERTIFICAT - Nova estructura institucional
    // ═══════════════════════════════════════════════════════════════════════════
    const lineHeight = 6;
    const orgName = orgData?.name || organization?.name || '';
    const orgTaxId = orgData?.taxId || organization?.taxId || 'N/A';
    const signerName = orgData?.signatoryName;
    const signerRole = orgData?.signatoryRole;
    const donorName = cleanName(summary.donor.name);
    const donorTaxId = summary.donor.taxId || 'N/A';
    const donorLocation = buildLocationString(summary.donor.zipCode, summary.donor.city, summary.donor.province);
    const amountFormatted = formatCurrencyEU(summary.totalAmount);

    // 1. Introducció del signant/entitat
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');

    let introText: string;
    if (signerName && signerRole) {
      // Amb signant i domicili social
      introText = fullAddress
        ? t.certificates.pdf.signerIntroWithAddress(signerName, signerRole, orgName, orgTaxId, fullAddress)
        : t.certificates.pdf.signerIntro(signerName, signerRole, orgName, orgTaxId);
    } else {
      // Sense signant (fallback)
      introText = fullAddress
        ? t.certificates.pdf.orgIntroWithAddress(orgName, orgTaxId, fullAddress)
        : t.certificates.pdf.orgIntro(orgName, orgTaxId);
    }
    const introLines = doc.splitTextToSize(introText, textWidth);
    doc.text(introLines, margin, y);
    y += introLines.length * lineHeight + 8;

    // 2. CERTIFICA
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(t.certificates.pdf.certifies, pageWidth / 2, y, { align: 'center' });
    y += 10;

    // 3. Cos principal: donant + import + nombre de donacions
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const donorBodyText = donorLocation
      ? t.certificates.pdf.donorBodyWithAddress(donorName, donorTaxId, donorLocation, selectedYear, amountFormatted, summary.donationCount)
      : t.certificates.pdf.donorBody(donorName, donorTaxId, selectedYear, amountFormatted, summary.donationCount);
    const donorBodyLines = doc.splitTextToSize(donorBodyText, textWidth);
    doc.text(donorBodyLines, margin, y);
    y += donorBodyLines.length * lineHeight + 6;

    // 4. Clàusula d'irrevocabilitat
    const irrevocableLines = doc.splitTextToSize(t.certificates.pdf.irrevocableClause, textWidth);
    doc.text(irrevocableLines, margin, y);
    y += irrevocableLines.length * lineHeight + 6;

    // ═══════════════════════════════════════════════════════════════════════════
    // BLOC DE RESUM FISCAL (només si hi ha devolucions)
    // ═══════════════════════════════════════════════════════════════════════════
    if (summary.returnedAmount > 0) {
      y += 4;
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
      doc.text(language === 'ca' ? 'Resum fiscal:' : 'Resumen fiscal:', boxX + 5, y);
      y += lineHeight;

      doc.setFont('helvetica', 'normal');
      const col1 = boxX + 5;
      const col2 = boxX + boxWidth - 5;

      doc.text(language === 'ca' ? 'Donacions rebudes:' : 'Donaciones recibidas:', col1, y);
      doc.text(formatCurrencyEU(summary.grossAmount), col2, y, { align: 'right' });
      y += lineHeight;

      doc.text(language === 'ca' ? 'Devolucions efectuades:' : 'Devoluciones efectuadas:', col1, y);
      doc.text(`-${formatCurrencyEU(summary.returnedAmount)}`, col2, y, { align: 'right' });
      y += lineHeight;

      doc.setFont('helvetica', 'bold');
      doc.text(language === 'ca' ? 'Import net certificat:' : 'Importe neto certificado:', col1, y);
      doc.text(formatCurrencyEU(summary.totalAmount), col2, y, { align: 'right' });

      y += lineHeight + 8;
    }

    // 5. Fórmula d'expedició (data i lloc)
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const today = new Date();
    const dateFormatted = t.certificates.pdf.dateLocation(
      '',
      today.getDate(),
      getMonthName(today.getMonth()),
      today.getFullYear()
    ).replace(/^,\s*/, ''); // Treure la coma inicial si no hi ha ciutat

    const issuePlace = orgData?.city || organization?.city;
    const issuedForText = issuePlace
      ? t.certificates.pdf.issuedForWithPlace(issuePlace, dateFormatted)
      : t.certificates.pdf.issuedFor(dateFormatted);
    const issuedForLines = doc.splitTextToSize(issuedForText, textWidth);
    doc.text(issuedForLines, margin, y);
    y += issuedForLines.length * lineHeight + 8;

    // 6. Nota legal Llei 49/2002
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    const law49Lines = doc.splitTextToSize(t.certificates.pdf.law49Note, textWidth);
    doc.text(law49Lines, margin, y);
    y += law49Lines.length * 5 + 12;

    // 7. Signatura
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(t.certificates.pdf.signature, margin, y);
    y += lineHeight * 4;
    doc.line(margin, y, margin + 60, y);

    // ═══════════════════════════════════════════════════════════════════════════
    // PEU DE PÀGINA
    // ═══════════════════════════════════════════════════════════════════════════
    const footerY = pageHeight - 15;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(128);
    doc.setDrawColor(200);
    doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);

    const footerParts: string[] = [];
    if (orgData?.name || organization?.name) footerParts.push(orgData?.name || organization?.name || '');
    if (orgData?.website) footerParts.push(orgData.website);
    if (orgData?.email) footerParts.push(orgData.email);

    if (footerParts.length > 0) {
      doc.text(footerParts.join(' · '), pageWidth / 2, footerY, { align: 'center' });
    }

    doc.setTextColor(0);
    return doc;
  };

  // Genera el PDF i retorna el base64 (sense el prefix data:)
  const generatePDFBase64 = async (summary: DonorSummary): Promise<string> => {
    const doc = await generatePDF(summary);
    const pdfOutput = doc.output('datauristring');
    // Treure el prefix "data:application/pdf;filename=generated.pdf;base64,"
    const base64 = pdfOutput.split(',')[1];
    return base64;
  };

  // Enviar email a un sol donant
  const handleSendEmailOne = async (summary: DonorSummary) => {
    if (!ensureCanGenerateCertificates()) return;
    if (!summary.donor.email) {
      toast({ variant: 'destructive', title: t.common.error, description: t.certificates.email.errorNoEmail });
      return;
    }

    setIsSendingEmails(true);
    try {
      const idToken = await user?.getIdToken();
      if (!idToken) {
        toast({ variant: 'destructive', title: t.common.error, description: t.certificates.email.errorSending });
        return;
      }

      const pdfBase64 = await generatePDFBase64(summary);

      const response = await fetch('/api/certificates/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          organizationId,
          organizationName: orgData?.name || organization?.name || '',
          organizationEmail: orgData?.email,
          organizationLanguage: certificateLanguage,
          donors: [{
            id: summary.donor.id,
            name: cleanName(summary.donor.name),
            email: summary.donor.email,
            pdfBase64,
          }],
          year: selectedYear,
        }),
      });

      const result = await response.json();
      const sentCount = Number(result?.totals?.sent ?? result?.sent ?? 0);

      if (response.ok && sentCount > 0) {
        toast({
          title: t.certificates.email.successOne,
          description: t.certificates.email.successOneDescription(cleanName(summary.donor.name)),
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
      console.error('Error sending email:', error);
      toast({ variant: 'destructive', title: t.common.error, description: t.certificates.email.errorSending });
    } finally {
      setIsSendingEmails(false);
    }
  };

  // Enviar emails als seleccionats (amb confirmació prèvia)
  const handleSendEmailSelected = async () => {
    if (!ensureCanGenerateCertificates()) return;
    const selected = donorSummaries.filter(s => selectedDonors.has(s.donor.id));
    const withEmail = selected.filter(s => s.hasEmail);
    const withoutEmail = selected.filter(s => !s.hasEmail);

    if (withEmail.length === 0) {
      toast({ variant: 'destructive', title: t.common.error, description: t.certificates.email.errorNoEmail });
      return;
    }

    setIsSendingEmails(true);
    try {
      const idToken = await user?.getIdToken();
      if (!idToken) {
        toast({ variant: 'destructive', title: t.common.error, description: t.certificates.email.errorSending });
        return;
      }

      const MAX_RECIPIENTS_PER_REQUEST = 20;
      let totalSent = 0;
      let totalErrors = 0;
      let quotaExceeded = false;

      for (let i = 0; i < withEmail.length; i += MAX_RECIPIENTS_PER_REQUEST) {
        const chunk = withEmail.slice(i, i + MAX_RECIPIENTS_PER_REQUEST);
        const donorsData = await Promise.all(chunk.map(async (summary) => ({
          id: summary.donor.id,
          name: cleanName(summary.donor.name),
          email: summary.donor.email!,
          pdfBase64: await generatePDFBase64(summary),
        })));

        const response = await fetch('/api/certificates/send-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            organizationId,
            organizationName: orgData?.name || organization?.name || '',
            organizationEmail: orgData?.email,
            organizationLanguage: certificateLanguage,
            donors: donorsData,
            year: selectedYear,
          }),
        });

        const result = await response.json().catch(() => ({}));

        if (response.ok) {
          totalSent += Number(result?.totals?.sent ?? result?.sent ?? 0);
          totalErrors += Number(result?.totals?.failed ?? result?.errors ?? 0);
          continue;
        }

        if (response.status === 429) {
          quotaExceeded = true;
          break;
        }

        totalErrors += chunk.length;
      }

      if (totalSent > 0) {
        toast({
          title: t.certificates.email.successMany,
          description: t.certificates.email.successManyDescription(totalSent, withoutEmail.length),
        });
      }

      if (quotaExceeded) {
        toast({
          variant: 'destructive',
          title: t.common.error,
          description: tr('certificates.email.dailyQuotaExceeded'),
        });
      } else if (totalErrors > 0 && totalSent === 0) {
        toast({ variant: 'destructive', title: t.common.error, description: t.certificates.email.errorSending });
      }
    } catch (error) {
      console.error('Error sending emails:', error);
      toast({ variant: 'destructive', title: t.common.error, description: t.certificates.email.errorSending });
    } finally {
      setIsSendingEmails(false);
      setEmailConfirmOpen(false);
    }
  };

  // Obrir confirmació per enviar email individual
  const openEmailConfirmOne = (summary: DonorSummary) => {
    if (!ensureCanGenerateCertificates()) return;
    if (!summary.donor.email) {
      toast({ variant: 'destructive', title: t.common.error, description: t.certificates.email.errorNoEmail });
      return;
    }
    setEmailTargetDonor(summary);
    setEmailConfirmOpen(true);
  };

  // Obrir confirmació per enviar emails massius
  const openEmailConfirmSelected = () => {
    if (!ensureCanGenerateCertificates()) return;
    const selected = donorSummaries.filter(s => selectedDonors.has(s.donor.id));
    const withEmail = selected.filter(s => s.hasEmail);

    if (withEmail.length === 0) {
      toast({ variant: 'destructive', title: t.common.error, description: t.certificates.email.errorNoEmail });
      return;
    }
    setEmailTargetDonor(null); // null indica enviament massiu
    setEmailConfirmOpen(true);
  };

  // Confirmar enviament
  const confirmSendEmail = () => {
    if (emailTargetDonor) {
      handleSendEmailOne(emailTargetDonor);
    } else {
      handleSendEmailSelected();
    }
  };

  // Calcular estadístiques per al diàleg de confirmació
  const getEmailConfirmStats = () => {
    if (emailTargetDonor) {
      return { toSend: 1, noEmail: 0 };
    }
    const selected = donorSummaries.filter(s => selectedDonors.has(s.donor.id));
    const withEmail = selected.filter(s => s.hasEmail);
    const withoutEmail = selected.filter(s => !s.hasEmail);
    return { toSend: withEmail.length, noEmail: withoutEmail.length };
  };

  const handlePreview = (summary: DonorSummary) => {
    setPreviewDonor(summary);
    setIsPreviewOpen(true);
  };

  const handleDownloadOne = async (summary: DonorSummary) => {
    if (!ensureCanGenerateCertificates()) return;
    const doc = await generatePDF(summary);
    const fileName = `Certificat_${selectedYear}_${cleanName(summary.donor.name).replace(/\s+/g, '_')}.pdf`;
    doc.save(fileName);
    toast({ title: t.certificates.certificateGenerated, description: t.certificates.certificateGeneratedDescription(fileName) });
  };

  const handleDownloadAll = async () => {
    if (!ensureCanGenerateCertificates()) return;
    const selected = donorSummaries.filter(s => selectedDonors.has(s.donor.id));
    if (selected.length === 0) {
      toast({ variant: 'destructive', title: t.common.error, description: t.certificates.errorNoDonorSelected });
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);

    try {
      for (let i = 0; i < selected.length; i++) {
        const summary = selected[i];
        const doc = await generatePDF(summary);
        const fileName = `Certificat_${selectedYear}_${cleanName(summary.donor.name).replace(/\s+/g, '_')}.pdf`;
        doc.save(fileName);
        
        setGenerationProgress(((i + 1) / selected.length) * 100);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      toast({ 
        title: t.certificates.allCertificatesGenerated, 
        description: t.certificates.allCertificatesGeneratedDescription(selected.length) 
      });
    } catch (error) {
      console.error('Error generating certificates:', error);
      toast({ variant: 'destructive', title: t.common.error, description: t.common.error });
    } finally {
      setIsGenerating(false);
      setGenerationProgress(0);
    }
  };

  const previewAddress = buildFullAddress();
  const previewContact = [orgData?.phone ? `Tel: ${orgData.phone}` : null, orgData?.email].filter(Boolean).join(' | ');

  // UI inicial (lazy load): només mostra selector d'any i botó per carregar
  if (!hasLoadedList) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t.certificates.loadDonorsTitle}
            </CardTitle>
            <CardDescription>
              {t.certificates.loadDonorsDescription}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{t.certificates.fiscalYear}:</span>
              </div>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map(year => (
                    <SelectItem key={year} value={year}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => {
                if (!ensureCanGenerateCertificates()) return;
                setHasLoadedList(true);
              }}
              disabled={!canGenerateCertificates}
            >
              <Users className="mr-2 h-4 w-4" />
              {t.certificates.loadDonorsButton}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Estadístiques */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {t.certificates.fiscalYear}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map(year => (
                  <SelectItem key={year} value={year}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              {t.certificates.donors}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDonors}</div>
            <p className="text-xs text-muted-foreground">
              {stats.selectedDonors} {t.certificates.selected}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Euro className="h-4 w-4" />
              {t.certificates.totalDonated}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrencyEU(stats.totalAmount)}</div>
            <p className="text-xs text-muted-foreground">
              {selectedYear}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Mail className="h-4 w-4" />
              {t.certificates.withEmail}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.withEmail}</div>
            <p className="text-xs text-muted-foreground">
              {t.certificates.canReceiveByEmail}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alerta de devolucions */}
      {totalReturns > 0 && (
        <Alert className="border-orange-200 bg-orange-50">
          <Undo2 className="h-4 w-4 text-orange-600" />
          <AlertTitle className="text-orange-800">{t.certificates.returnsDiscountedAlert}</AlertTitle>
          <AlertDescription className="text-orange-700">
            {t.certificates.returnsDiscountedAlertDescription(totalReturns, formatCurrencyEU(stats.totalReturned))}
          </AlertDescription>
        </Alert>
      )}

      {/* Taula de donants */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t.certificates.donorsWithDonations(selectedYear)}</CardTitle>
              <CardDescription>
                {t.certificates.selectDonorsDescription}
              </CardDescription>
            </div>
            <div className={cn(MOBILE_ACTIONS_BAR, "sm:justify-end")}>
              <Button
                variant="outline"
                onClick={handleDownloadAll}
                disabled={isLoading || isGenerating || selectedDonors.size === 0 || !canGenerateCertificates}
                className={cn(MOBILE_CTA_PRIMARY, MOBILE_CTA_TRUNCATE)}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin flex-shrink-0" />
                    <span className="truncate">{t.certificates.generating}</span>
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{t.certificates.downloadSelected(stats.selectedDonors)}</span>
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={openEmailConfirmSelected}
                disabled={isLoading || isSendingEmails || stats.selectedWithEmail === 0 || !canGenerateCertificates}
                className={cn(MOBILE_CTA_PRIMARY, MOBILE_CTA_TRUNCATE)}
              >
                {isSendingEmails ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin flex-shrink-0" />
                    <span className="truncate">{t.certificates.email.sending}</span>
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{t.certificates.email.sendSelected(stats.selectedWithEmail)}</span>
                  </>
                )}
              </Button>
            </div>
          </div>
          {isGenerating && (
            <Progress value={generationProgress} className="mt-4" />
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            isMobile ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="border border-border/50 rounded-lg p-3">
                    <Skeleton className="h-4 w-3/4 mb-2" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )
          ) : donorSummaries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mb-2" />
              <p>{t.certificates.noDonations(selectedYear)}</p>
              <p className="text-sm">{t.certificates.noDonationsHint}</p>
            </div>
          ) : isMobile ? (
            /* ═══════════════════════════════════════════════════════════════════
               VISTA MÒBIL - MobileListItem
               ═══════════════════════════════════════════════════════════════════ */
            <div className="space-y-2">
              {/* Checkbox per seleccionar tots */}
              <div className="flex items-center gap-2 p-2 border-b border-border/50">
                <Checkbox
                  checked={selectedDonors.size === donorSummaries.length}
                  onCheckedChange={toggleAll}
                />
                <span className="text-sm text-muted-foreground">
                  {selectedDonors.size === donorSummaries.length ? t.common.deselectAll : t.common.selectAll}
                </span>
              </div>
              {donorSummaries.map(summary => (
                <MobileListItem
                  key={summary.donor.id}
                  leadingIcon={
                    <Checkbox
                      checked={selectedDonors.has(summary.donor.id)}
                      onCheckedChange={() => toggleDonor(summary.donor.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  }
                  title={cleanName(summary.donor.name)}
                  badges={[
                    <Badge key="donations" variant="secondary" className="text-xs">
                      {summary.donationCount} {summary.donationCount === 1 ? 'donació' : 'donacions'}
                    </Badge>,
                    summary.hasEmail && (
                      <Badge key="email" variant="outline" className="text-xs text-green-600 border-green-300">
                        <Mail className="h-3 w-3 mr-1" />
                        Email
                      </Badge>
                    ),
                  ].filter(Boolean) as React.ReactNode[]}
                  meta={[
                    { label: 'NIF', value: summary.donor.taxId },
                    {
                      value: (
                        <span className="font-mono text-green-600 font-medium">
                          {formatCurrencyEU(summary.totalAmount)}
                        </span>
                      )
                    },
                    ...(summary.returnedAmount > 0 ? [{
                      value: (
                        <span className="flex items-center gap-1 font-mono text-orange-500">
                          <Undo2 className="h-3 w-3" />
                          -{formatCurrencyEU(summary.returnedAmount)}
                        </span>
                      )
                    }] : [])
                  ]}
                  actions={
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handlePreview(summary)}>
                          <Eye className="h-4 w-4 mr-2" />
                          {t.certificates.preview}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDownloadOne(summary)}>
                          <Download className="h-4 w-4 mr-2" />
                          {t.certificates.download}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => openEmailConfirmOne(summary)}
                          disabled={!summary.hasEmail || isSendingEmails}
                        >
                          <Mail className="h-4 w-4 mr-2" />
                          {t.certificates.email.sendOne}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  }
                />
              ))}
            </div>
          ) : (
            /* ═══════════════════════════════════════════════════════════════════
               VISTA DESKTOP - Taula
               ═══════════════════════════════════════════════════════════════════ */
            <div className="rounded-xl border border-border/60 bg-background/95 shadow-sm">
              <Table className="w-full table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedDonors.size === donorSummaries.length}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead className="w-[34%]">{t.donors.name}</TableHead>
                    <TableHead className="w-[150px]">{t.donors.taxId}</TableHead>
                    <TableHead className="w-[100px] text-center">{t.certificates.donations}</TableHead>
                    <TableHead className="w-[140px] text-right">{t.certificates.total}</TableHead>
                    {totalReturns > 0 && (
                      <TableHead className="w-[140px] text-right text-orange-600">{t.reports.columnDiscounted}</TableHead>
                    )}
                    <TableHead className="w-[110px] text-center">{t.certificates.emailColumn}</TableHead>
                    <TableHead className="w-[120px] text-right">{t.certificates.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {donorSummaries.map(summary => (
                    <TableRow key={summary.donor.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedDonors.has(summary.donor.id)}
                          onCheckedChange={() => toggleDonor(summary.donor.id)}
                        />
                      </TableCell>
                      <TableCell className="min-w-0 font-medium">
                        <span className="block truncate">{cleanName(summary.donor.name)}</span>
                      </TableCell>
                      <TableCell className="font-mono text-sm whitespace-nowrap">{summary.donor.taxId}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{summary.donationCount}</Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right font-mono font-medium text-green-600">
                        {formatCurrencyEU(summary.totalAmount)}
                      </TableCell>
                      {totalReturns > 0 && (
                        <TableCell className="whitespace-nowrap text-right font-mono text-orange-500">
                          {summary.returnedAmount > 0 ? (
                            <span className="flex items-center justify-end gap-1">
                              <Undo2 className="h-3 w-3" />
                              -{formatCurrencyEU(summary.returnedAmount)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      )}
                      <TableCell className="text-center">
                        {summary.hasEmail ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handlePreview(summary)}
                            title={t.certificates.preview}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDownloadOne(summary)}
                            title={t.certificates.download}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEmailConfirmOne(summary)}
                            disabled={!summary.hasEmail || isSendingEmails}
                            title={summary.hasEmail ? t.certificates.email.sendOne : t.certificates.email.errorNoEmail}
                          >
                            <Mail className={`h-4 w-4 ${!summary.hasEmail ? 'text-muted-foreground' : ''}`} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diàleg de previsualització */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t.certificates.previewTitle}
            </DialogTitle>
            <DialogDescription>
              {previewDonor ? t.certificates.previewDescription(cleanName(previewDonor.donor.name)) : ''}
            </DialogDescription>
          </DialogHeader>
          
          {previewDonor && (
            <div className="border rounded-lg p-8 bg-white text-black">
              {/* Capçalera */}
              <div className="text-center mb-4">
                {orgData?.logoUrl && (
                  <img 
                    src={orgData.logoUrl} 
                    alt="Logo" 
                    className="h-16 mx-auto mb-2 object-contain"
                  />
                )}
                <h2 className="text-xl font-bold">{orgData?.name || organization?.name}</h2>
                <p className="text-sm text-gray-600">CIF: {orgData?.taxId || organization?.taxId || 'N/A'}</p>
                {previewAddress && (
                  <p className="text-sm text-gray-500">{previewAddress}</p>
                )}
                {previewContact && (
                  <p className="text-sm text-gray-500">{previewContact}</p>
                )}
              </div>

              <hr className="my-4" />

              {/* Títol */}
              <div className="text-center mb-6">
                <h3 className="text-lg font-bold">{t.certificates.pdf.title}</h3>
                <p className="text-gray-600">{t.certificates.pdf.fiscalYear(selectedYear)}</p>
              </div>

              {/* Cos - Alineat amb el PDF real */}
              <div className="space-y-4 text-sm">
                {/* Introducció signant/entitat */}
                <p>
                  {(() => {
                    const orgName = orgData?.name || organization?.name || '';
                    const orgTaxId = orgData?.taxId || organization?.taxId || 'N/A';
                    const signerName = orgData?.signatoryName;
                    const signerRole = orgData?.signatoryRole;
                    const fullAddress = previewAddress;
                    if (signerName && signerRole) {
                      return fullAddress
                        ? t.certificates.pdf.signerIntroWithAddress(signerName, signerRole, orgName, orgTaxId, fullAddress)
                        : t.certificates.pdf.signerIntro(signerName, signerRole, orgName, orgTaxId);
                    }
                    return fullAddress
                      ? t.certificates.pdf.orgIntroWithAddress(orgName, orgTaxId, fullAddress)
                      : t.certificates.pdf.orgIntro(orgName, orgTaxId);
                  })()}
                </p>

                <p className="font-bold text-center">{t.certificates.pdf.certifies}</p>

                {/* Cos principal: donant + import + nombre de donacions */}
                <p>
                  {(() => {
                    const donorName = cleanName(previewDonor.donor.name);
                    const donorTaxId = previewDonor.donor.taxId || 'N/A';
                    const donorLocation = buildLocationString(previewDonor.donor.zipCode, previewDonor.donor.city, previewDonor.donor.province);
                    const amountFormatted = formatCurrencyEU(previewDonor.totalAmount);
                    return donorLocation
                      ? t.certificates.pdf.donorBodyWithAddress(donorName, donorTaxId, donorLocation, selectedYear, amountFormatted, previewDonor.donationCount)
                      : t.certificates.pdf.donorBody(donorName, donorTaxId, selectedYear, amountFormatted, previewDonor.donationCount);
                  })()}
                </p>

                {/* Clàusula d'irrevocabilitat */}
                <p>{t.certificates.pdf.irrevocableClause}</p>

                {/* Bloc resum fiscal (només si hi ha devolucions) */}
                {previewDonor.returnedAmount > 0 && (
                  <div className="bg-gray-50 border border-gray-200 rounded p-3 text-xs">
                    <p className="font-bold mb-1">{language === 'ca' ? 'Resum fiscal:' : 'Resumen fiscal:'}</p>
                    <div className="flex justify-between">
                      <span>{language === 'ca' ? 'Donacions rebudes:' : 'Donaciones recibidas:'}</span>
                      <span>{formatCurrencyEU(previewDonor.grossAmount)}</span>
                    </div>
                    <div className="flex justify-between text-orange-600">
                      <span>{language === 'ca' ? 'Devolucions efectuades:' : 'Devoluciones efectuadas:'}</span>
                      <span>-{formatCurrencyEU(previewDonor.returnedAmount)}</span>
                    </div>
                    <div className="flex justify-between font-bold mt-1 pt-1 border-t border-gray-200">
                      <span>{language === 'ca' ? 'Import net certificat:' : 'Importe neto certificado:'}</span>
                      <span>{formatCurrencyEU(previewDonor.totalAmount)}</span>
                    </div>
                  </div>
                )}

                {/* Fórmula d'expedició */}
                <p>
                  {(() => {
                    const today = new Date();
                    const dateFormatted = t.certificates.pdf.dateLocation(
                      '',
                      today.getDate(),
                      getMonthName(today.getMonth()),
                      today.getFullYear()
                    ).replace(/^,\s*/, '');
                    const issuePlace = orgData?.city || organization?.city;
                    return issuePlace
                      ? t.certificates.pdf.issuedForWithPlace(issuePlace, dateFormatted)
                      : t.certificates.pdf.issuedFor(dateFormatted);
                  })()}
                </p>

                {/* Nota legal Llei 49/2002 */}
                <p className="text-xs italic text-gray-500 mt-4">
                  {t.certificates.pdf.law49Note}
                </p>

                {/* Signatura */}
                <div className="mt-6">
                  <p>{t.certificates.pdf.signature}</p>
                  <div className="border-b border-gray-400 w-48 mt-8"></div>
                </div>
              </div>

              {/* Peu */}
              <div className="mt-8 pt-4 border-t text-center text-xs text-gray-400">
                {[orgData?.name, orgData?.website, orgData?.email].filter(Boolean).join(' · ')}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>
              {t.certificates.close}
            </Button>
            {previewDonor && (
              <Button onClick={() => handleDownloadOne(previewDonor)}>
                <Download className="mr-2 h-4 w-4" />
                {t.certificates.download}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Diàleg de confirmació d'enviament d'emails */}
      <AlertDialog open={emailConfirmOpen} onOpenChange={setEmailConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              {t.certificates.email.confirmTitle}
            </AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line">
              {(() => {
                const stats = getEmailConfirmStats();
                return t.certificates.email.confirmDescription(stats.toSend, stats.noEmail);
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSendingEmails}>
              {t.common.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmSendEmail}
              disabled={isSendingEmails}
            >
              {isSendingEmails ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t.certificates.email.sending}
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  {t.certificates.email.confirmButton}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
