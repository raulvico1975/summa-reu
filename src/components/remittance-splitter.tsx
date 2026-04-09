'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useToast } from '@/hooks/use-toast';
import type { Transaction, Donor, AnyContact } from '@/lib/data';
import { formatCurrencyEU, isValidSpanishTaxId, getSpanishTaxIdType, normalizeTaxId, formatIBANDisplay, normalizeIBAN } from '@/lib/normalize';
import type { SpanishTaxIdType } from '@/lib/normalize';
import {
  FileUp,
  Loader2,
  Info,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  UserPlus,
  ArrowLeft,
  ArrowRight,
  Settings2,
  Save,
  Trash2,
  Eye,
  RotateCcw,
  Download,
  FileCode,
  Copy,
  ChevronDown,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useFirebase } from '@/firebase';
import { collection, writeBatch, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { useCollection, useMemoFirebase } from '@/firebase';
import { useTranslations } from '@/i18n';
import { useCurrentOrganization } from '@/hooks/organization-provider';
import { parsePain001, isPain001File, downloadPain001 } from '@/lib/sepa';
import { filterMatchableContacts, filterAllForIbanMatching, isNumericLikeName, maskMatchValue } from '@/lib/contacts/filterActiveContacts';
import { assertFiscalTxCanBeSaved } from '@/lib/fiscal/assertFiscalInvariant';
import { acquireProcessLock, releaseProcessLock, getLockFailureMessage } from '@/lib/fiscal/processLocks';
import { normalizeForMatching } from '@/lib/auto-match';
import {
  buildPaymentContactOptions,
  findPaymentBeneficiary,
  resolvePaymentChildContactType,
  resolvePaymentContactOption,
  type PaymentContactType,
} from '@/lib/remittances/payment-contact-resolution';
import { parseContactRoleValue } from '@/lib/contacts/contact-role-options';
import { getContactTypeLabel } from '@/lib/ui/display-labels';

// ═══════════════════════════════════════════════════════════════════════════════
// TIPUS
// ═══════════════════════════════════════════════════════════════════════════════

interface RemittanceSplitterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction;
  existingDonors: Donor[];
  existingSuppliers?: AnyContact[];
  existingEmployees?: AnyContact[];
  onSplitDone: () => void;
}

// Tipus de remesa: IN (donacions) o OUT (pagaments)
type RemittanceDirection = 'IN' | 'OUT';

// Configuració guardada per a un format de banc
interface SavedMapping {
  id: string;
  name: string;
  delimiter: string;
  startRow: number;
  amountColumn: number;
  nameColumn: number | null;
  taxIdColumn: number | null;
  ibanColumn: number | null;
  createdAt: string;
}

// Tipus de matching per traçabilitat
type MatchMethod = 'iban' | 'taxId' | 'name' | null;

// Estat del donant per mostrar a la UI
type DonorMatchStatus = 'active' | 'inactive' | 'archived' | 'deleted';

// Resultat de l'anàlisi de cada fila del CSV
// Nota: Usem "matchedDonor" i "Donor" per compatibilitat, però pot ser proveïdor/treballador
interface ParsedDonation {
  rowIndex: number;
  name: string;
  taxId: string;                    // Valor original de la columna (pot ser ref bancària)
  taxIdValid: boolean;              // true només si isValidSpanishTaxId() passa
  taxIdType: SpanishTaxIdType;      // 'DNI' | 'NIE' | 'CIF' | null
  idCandidate: string;              // Valor cru abans de normalitzar (per mostrar)
  iban: string;
  amount: number;
  // NOUS ESTATS P0:
  // - found: match IBAN amb donant actiu
  // - found_inactive: match IBAN amb donant baixa
  // - found_archived: match IBAN amb donant arxivat
  // - found_deleted: match IBAN amb donant eliminat
  // - ambiguous_iban: IBAN duplicat (>1 donant)
  // - no_iban_match: IBAN no trobat
  status: 'found' | 'found_inactive' | 'found_archived' | 'found_deleted' | 'ambiguous_iban' | 'no_iban_match' | 'new_with_taxid' | 'new_without_taxid';
  matchedDonor: Donor | null;
  matchedDonorStatus?: DonorMatchStatus; // Estat del donant matched (per mostrar badge)
  ambiguousDonors?: Donor[];        // Llista de donants amb IBAN duplicat (per selecció manual)
  matchedContactType?: 'donor' | 'supplier' | 'employee';
  matchMethod?: MatchMethod;        // Com s'ha trobat el match (per traçabilitat)
  matchValueMasked?: string;        // Valor emmascarament per mostrar a la UI (últims 4 IBAN, etc.)
  shouldCreate: boolean;
  zipCode: string;
  // Nota explicativa per la UI
  matchNote?: string;
  // Selecció manual per IBAN ambigu (compte conjunta) o IBAN no trobat
  manualMatchContactId?: string;
  manualMatchContactType?: PaymentContactType;
  // Suggeriment per DNI quan IBAN no trobat (per facilitar assignació)
  suggestedDonorByTaxId?: Donor;
}

type Step = 'upload' | 'mapping' | 'preview' | 'processing';

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITATS
// ═══════════════════════════════════════════════════════════════════════════════

const normalizeString = (str: string): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
};

// Detecta el delimitador més probable
const detectDelimiter = (text: string): string => {
  const firstLines = text.split('\n').slice(0, 10).join('\n');
  const counts = {
    ';': (firstLines.match(/;/g) || []).length,
    ',': (firstLines.match(/,/g) || []).length,
    '\t': (firstLines.match(/\t/g) || []).length,
  };
  
  // Retorna el delimitador més freqüent
  return Object.entries(counts).reduce((a, b) => a[1] > b[1] ? a : b)[0];
};

// Parseja un valor d'import (15,00 EUR -> 15.00)
const parseAmount = (value: string): number => {
  if (!value) return 0;
  // Elimina tot excepte números, comes i punts
  let cleaned = value.replace(/[^\d,.-]/g, '');
  // Si té format europeu (1.234,56), converteix a format americà
  if (cleaned.includes(',')) {
    // Si hi ha punt abans de la coma, és separador de milers
    if (cleaned.indexOf('.') < cleaned.indexOf(',')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      cleaned = cleaned.replace(',', '.');
    }
  }
  return parseFloat(cleaned) || 0;
};

// Detecta automàticament la fila on comencen les dades
// Utilitza consistència entre files i prioritza IBAN/DNI com a indicadors forts
const detectStartRow = (rows: string[][]): number => {
  const ibanPattern = /^(IBAN\s*)?[A-Z]{2}[0-9]{2}[A-Z0-9\s]{10,30}$/i;
  const taxIdPattern = /^[0-9]{7,8}[A-Z]$|^[A-Z][0-9]{7,8}$|^[XYZ][0-9]{7}[A-Z]$/i;

  const isDataRow = (row: string[]): { score: number; hasIban: boolean; hasTaxId: boolean } => {
    if (!row || row.length < 2) return { score: 0, hasIban: false, hasTaxId: false };

    const hasIban = row.some(cell => {
      const cleaned = (cell || '').toString().trim().replace(/\s/g, '');
      return ibanPattern.test(cleaned);
    });
    const hasTaxId = row.some(cell => {
      const cleaned = (cell || '').toString().trim();
      return taxIdPattern.test(cleaned);
    });
    const hasAmount = row.some(cell => {
      const amt = parseAmount((cell || '').toString());
      return amt > 0 && amt < 50000;
    });
    const hasText = row.some(cell => {
      const text = (cell || '').toString();
      return /[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]{3,}/.test(text) &&
             !text.includes('EUR') &&
             !/^(fecha|socio|importe|estado|total|subtotal)/i.test(text);
    });

    let score = 0;
    if (hasIban) score += 3;
    if (hasTaxId) score += 2;
    if (hasAmount) score += 1;
    if (hasText) score += 1;

    return { score, hasIban, hasTaxId };
  };

  const maxSearch = Math.min(rows.length, 50);

  // Primera passada: busca files amb IBAN o DNI (indicadors forts)
  for (let i = 0; i < maxSearch; i++) {
    const current = isDataRow(rows[i]);
    if ((current.hasIban || current.hasTaxId) && current.score >= 3) {
      return i;
    }
  }

  // Segona passada: busca 3 files consecutives amb estructura consistent
  for (let i = 0; i < maxSearch - 2; i++) {
    const current = isDataRow(rows[i]);
    const next1 = isDataRow(rows[i + 1]);
    const next2 = isDataRow(rows[i + 2]);

    if (current.score >= 2 && next1.score >= 2 && next2.score >= 2) {
      return i;
    }
  }

  // Fallback: 2 files consecutives
  for (let i = 0; i < maxSearch - 1; i++) {
    const current = isDataRow(rows[i]);
    const next = isDataRow(rows[i + 1]);

    if (current.score >= 2 && next.score >= 2) {
      return i;
    }
  }

  return 0;
};

// Detecta automàticament les columnes
const detectColumns = (rows: string[][], startRow: number): { amount: number, name: number | null, taxId: number | null, iban: number | null } => {
  const sampleRows = rows.slice(startRow, startRow + 10);
  let amountCol = -1;
  let nameCol: number | null = null;
  let taxIdCol: number | null = null;
  let ibanCol: number | null = null;

  if (sampleRows.length === 0 || sampleRows[0].length === 0) {
    return { amount: 0, name: null, taxId: null, iban: null };
  }

  const numCols = sampleRows[0].length;

  for (let col = 0; col < numCols; col++) {
    const values = sampleRows.map(row => row[col] || '');

    // Detecta columna d'import (números amb format monetari)
    const amountScores = values.filter(v => {
      const amount = parseAmount(v);
      return amount > 0 && amount < 100000;
    }).length;
    if (amountScores > sampleRows.length * 0.7 && amountCol === -1) {
      amountCol = col;
      continue;
    }

    // Detecta columna d'IBAN (format ES + 22 dígits o similar)
    // Suporta formats: "ES1234567890123456789012", "IBAN ES12 3456 7890...", "ES12 3456 7890..."
    const ibanScores = values.filter(v => {
      // Elimina prefix "IBAN " i espais per normalitzar
      const cleaned = v.trim().replace(/^IBAN\s*/i, '').replace(/\s/g, '').toUpperCase();
      // IBAN espanyol: ES + 22 dígits, o altres països: 2 lletres + fins a 32 caràcters
      return /^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$/.test(cleaned);
    }).length;
    if (ibanScores > sampleRows.length * 0.5 && ibanCol === null) {
      ibanCol = col;
      continue;
    }

    // Detecta columna de DNI/CIF (8-9 dígits + lletra, o CIF)
    const taxIdScores = values.filter(v =>
      /^[0-9]{7,8}[A-Za-z]$/.test(v.trim()) || // DNI
      /^[A-Za-z][0-9]{7,8}$/.test(v.trim()) || // CIF
      /^[XYZ][0-9]{7}[A-Za-z]$/.test(v.trim()) // NIE
    ).length;
    if (taxIdScores > sampleRows.length * 0.5) {
      taxIdCol = col;
      continue;
    }

    // Detecta columna de nom (text amb espais, sense números)
    const nameScores = values.filter(v => {
      const cleaned = v.trim();
      return cleaned.length > 5 &&
             /[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]{5,}/.test(cleaned) &&
             !/^[0-9]+$/.test(cleaned) &&
             !cleaned.includes('EUR') &&
             !/^[A-Z]{2}[0-9]{2}/.test(cleaned); // No és IBAN
    }).length;
    if (nameScores > sampleRows.length * 0.5 && nameCol === null) {
      nameCol = col;
    }
  }

  return {
    amount: amountCol >= 0 ? amountCol : 0,
    name: nameCol,
    taxId: taxIdCol,
    iban: ibanCol
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export function RemittanceSplitter({
  open,
  onOpenChange,
  transaction,
  existingDonors,
  existingSuppliers = [],
  existingEmployees = [],
  onSplitDone,
}: RemittanceSplitterProps) {
  // Detectar direcció: IN (donacions, amount > 0) o OUT (pagaments, amount < 0)
  const direction: RemittanceDirection = transaction.amount >= 0 ? 'IN' : 'OUT';
  const isPaymentRemittance = direction === 'OUT';

  // Estats de navegació
  const [step, setStep] = React.useState<Step>('upload');
  const [isProcessing, setIsProcessing] = React.useState(false);

  // Estats de l'arxiu
  const [rawText, setRawText] = React.useState('');
  const [delimiter, setDelimiter] = React.useState(';');
  const [allRows, setAllRows] = React.useState<string[][]>([]);
  
  // Estats de mapejat
  const [startRow, setStartRow] = React.useState(0);
  const [amountColumn, setAmountColumn] = React.useState<number>(0);
  const [nameColumn, setNameColumn] = React.useState<number | null>(null);
  const [taxIdColumn, setTaxIdColumn] = React.useState<number | null>(null);
  const [ibanColumn, setIbanColumn] = React.useState<number | null>(null);
  const [newMappingName, setNewMappingName] = React.useState('');

  // Estats de preview
  const [parsedDonations, setParsedDonations] = React.useState<ParsedDonation[]>([]);
  const [totalAmount, setTotalAmount] = React.useState(0);
  const [defaultZipCode, setDefaultZipCode] = React.useState('08001');
  // Selector expandit de donants per IBAN no trobat
  const [showDonorSelectorForRow, setShowDonorSelectorForRow] = React.useState<number | null>(null);
  const [donorSearchTerm, setDonorSearchTerm] = React.useState('');
  const [isAdvancedMappingOpen, setIsAdvancedMappingOpen] = React.useState(false);

  // Refs i hooks
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const tableContainerRef = React.useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { firestore, user } = useFirebase();
  const { organizationId } = useCurrentOrganization();
  const { t, tr } = useTranslations();

  // Carregar configuracions guardades
  const mappingsQuery = useMemoFirebase(
    () => organizationId ? collection(firestore, 'organizations', organizationId, 'remittanceMappings') : null,
    [firestore, organizationId]
  );
  const { data: savedMappings } = useCollection<SavedMapping>(mappingsQuery);

  // Carregar comptes bancaris (per exportar SEPA amb l'IBAN del deutor)
  const bankAccountsQuery = useMemoFirebase(
    () => organizationId ? collection(firestore, 'organizations', organizationId, 'bankAccounts') : null,
    [firestore, organizationId]
  );
  const { data: bankAccounts } = useCollection<{ id: string; name: string; iban: string }>(bankAccountsQuery);

  // Obtenir l'IBAN del compte bancari de la transacció
  const debtorBankAccount = React.useMemo(() => {
    if (!transaction.bankAccountId || !bankAccounts) return null;
    return bankAccounts.find(ba => ba.id === transaction.bankAccountId) ?? null;
  }, [transaction.bankAccountId, bankAccounts]);

  const paymentContacts = React.useMemo(
    () => [...existingSuppliers, ...existingEmployees],
    [existingEmployees, existingSuppliers]
  );

  const paymentContactOptions = React.useMemo(
    () => buildPaymentContactOptions(paymentContacts),
    [paymentContacts]
  );

  const getPaymentContactLabel = React.useCallback((contactId: string | null | undefined, contactType: PaymentContactType | null | undefined) => {
    const option = resolvePaymentContactOption(paymentContacts, contactId, contactType);
    if (!option) return null;

    const roleLabel = getContactTypeLabel(option.contactType, t.common ?? {});
    return {
      key: option.key,
      name: option.contactName,
      type: option.contactType,
      label: option.isMultiRole ? `${option.contactName} · ${roleLabel}` : option.contactName,
    };
  }, [paymentContacts, t.common]);

  // Reset quan es tanca el diàleg
  React.useEffect(() => {
    if (!open) {
      setStep('upload');
      setIsProcessing(false);
      setRawText('');
      setAllRows([]);
      setParsedDonations([]);
      setTotalAmount(0);
      setNewMappingName('');
    }
  }, [open]);

  // Estadístiques P0: nous estats per matching IBAN-first
  const stats = React.useMemo(() => {
    const found = parsedDonations.filter(d => d.status === 'found').length;
    const foundInactive = parsedDonations.filter(d => d.status === 'found_inactive').length;
    const foundArchived = parsedDonations.filter(d => d.status === 'found_archived').length;
    const foundDeleted = parsedDonations.filter(d => d.status === 'found_deleted').length;
    // ambiguousIban: només comptem els que NO tenen selecció manual
    const ambiguousIbanTotal = parsedDonations.filter(d => d.status === 'ambiguous_iban').length;
    const ambiguousIbanUnresolved = parsedDonations.filter(d =>
      d.status === 'ambiguous_iban' && !d.manualMatchContactId
    ).length;
    // noIbanMatch: només comptem els que NO tenen selecció manual
    const noIbanMatchTotal = parsedDonations.filter(d => d.status === 'no_iban_match').length;
    const noIbanMatchUnresolved = parsedDonations.filter(d =>
      d.status === 'no_iban_match' && !d.manualMatchContactId
    ).length;
    // Legacy (mode OUT)
    const newWithTaxId = parsedDonations.filter(d => d.status === 'new_with_taxid').length;
    const newWithoutTaxId = parsedDonations.filter(d => d.status === 'new_without_taxid').length;

    // Totals per categories
    const totalFound = found + foundInactive + foundArchived + foundDeleted;
    const totalPending = ambiguousIbanUnresolved + noIbanMatchUnresolved;

    // toCreate ja no aplica per mode IN (tot via IBAN), però mantenim per mode OUT
    const toCreate = parsedDonations.filter(d => d.shouldCreate).length;

    return {
      found,
      foundInactive,
      foundArchived,
      foundDeleted,
      ambiguousIban: ambiguousIbanUnresolved, // Per bloqueig: només sense resoldre
      ambiguousIbanTotal, // Per mostrar a UI: tots
      noIbanMatch: noIbanMatchUnresolved, // Per UI: només sense resoldre
      noIbanMatchTotal, // Per mostrar total a UI si cal
      newWithTaxId,
      newWithoutTaxId,
      totalFound,
      totalPending,
      toCreate,
    };
  }, [parsedDonations]);

  // Càlcul del delta en cèntims per validació i observabilitat
  const validationDetails = React.useMemo(() => {
    const parentAbsAmount = Math.abs(transaction.amount);
    const deltaCents = Math.round((parentAbsAmount - totalAmount) * 100);
    const invalidAmounts = parsedDonations.filter(d => !d.amount || d.amount <= 0);
    const missingIbans = isPaymentRemittance
      ? parsedDonations.filter(d => !d.matchedDonor?.iban && !d.iban)
      : [];

    return {
      deltaCents,
      parentAmount: parentAbsAmount,
      totalItems: totalAmount,
      itemCount: parsedDonations.length,
      invalidAmounts: invalidAmounts.length,
      missingIbans: missingIbans.length,
    };
  }, [parsedDonations, totalAmount, transaction.amount, isPaymentRemittance]);

  // Validació per permetre processar: imports quadren i hi ha dades
  const canProcess = React.useMemo(() => {
    // 🛑 GUARDRAIL: No permetre processar si ja és remesa
    // El flux de recuperació és: Desfer → Processar (no hi ha "Reparar")
    if (transaction.isRemittance) return false;
    if (parsedDonations.length === 0) return false;
    // Verificar que tots els imports són vàlids (> 0)
    if (validationDetails.invalidAmounts > 0) return false;
    // Verificar que el total quadra amb el pare (±2 cèntims)
    if (Math.abs(validationDetails.deltaCents) > 2) return false;
    // P0: Bloquejar si hi ha IBAN ambigus sense resoldre (mode IN)
    if (!isPaymentRemittance && stats.ambiguousIban > 0) return false;
    return true;
  }, [transaction.isRemittance, parsedDonations.length, validationDetails, isPaymentRemittance, stats.ambiguousIban]);

  // Motiu de bloqueig per mostrar a l'usuari
  const blockReason = React.useMemo((): string | null => {
    // 🛑 GUARDRAIL: Remesa ja processada
    if (transaction.isRemittance) {
      return t.movements.splitter.alreadyProcessed;
    }
    if (parsedDonations.length === 0) return 'No hi ha dades per processar';
    if (validationDetails.invalidAmounts > 0) {
      return `${validationDetails.invalidAmounts} element(s) amb import invàlid (≤0)`;
    }
    if (Math.abs(validationDetails.deltaCents) > 2) {
      const deltaCentsAbs = Math.abs(validationDetails.deltaCents);
      return `Delta ${deltaCentsAbs > 0 ? '+' : ''}${validationDetails.deltaCents / 100}€ (màx ±0.02€)`;
    }
    // P0: Bloqueig per IBAN ambigu
    if (!isPaymentRemittance && stats.ambiguousIban > 0) {
      return `${stats.ambiguousIban} IBAN(s) ambigu(s) - cal selecció manual`;
    }
    return null;
  }, [transaction.isRemittance, parsedDonations.length, validationDetails, isPaymentRemittance, stats.ambiguousIban]);

  const remittanceDialogContentClassName =
    step === 'mapping' || step === 'preview'
      ? 'max-h-[calc(100dvh-1rem)] w-[calc(100vw-0.75rem)] max-w-[1460px] flex flex-col overflow-hidden p-0 sm:w-[min(calc(100vw-2rem),1460px)]'
      : 'max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[min(96vw,60rem)] overflow-y-auto sm:w-[min(calc(100vw-3rem),60rem)]';

  const mappingHasIdentifier = nameColumn !== null || taxIdColumn !== null || ibanColumn !== null;

  const mappingMissingMessage = !mappingHasIdentifier
    ? tr('movements.splitter.mappingMissingIdentifier', 'Assigna com a minim un camp d identificacio (IBAN, nom o DNI/NIF).')
    : null;

  // Files visibles per al preview del mapejat
  const previewRows = React.useMemo(() => {
    return allRows.slice(startRow, startRow + 8);
  }, [allRows, startRow]);

  // Número de columnes
  const numColumns = React.useMemo(() => {
    return Math.max(...allRows.map(r => r.length), 0);
  }, [allRows]);

  // Agrupar línies ambigües per IBAN (per UI de resolució)
  const ambiguousIbanGroups = React.useMemo(() => {
    const ambiguous = parsedDonations.filter(d => d.status === 'ambiguous_iban');
    const groups: Map<string, { indices: number[]; donors: Donor[]; iban: string }> = new Map();

    ambiguous.forEach((d, _) => {
      const ibanKey = normalizeIBAN(d.iban);
      if (!ibanKey) return;

      if (!groups.has(ibanKey)) {
        groups.set(ibanKey, {
          indices: [],
          donors: d.ambiguousDonors || [],
          iban: d.iban,
        });
      }
      groups.get(ibanKey)!.indices.push(d.rowIndex);
    });

    return Array.from(groups.entries()).map(([ibanKey, data]) => ({
      ibanKey,
      iban: data.iban,
      indices: data.indices,
      donors: data.donors,
      // Comptem quantes línies del grup estan resoltes
      resolvedCount: data.indices.filter(idx =>
        parsedDonations.find(d => d.rowIndex === idx)?.manualMatchContactId
      ).length,
    }));
  }, [parsedDonations]);

  // ═══════════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const fileName = file.name.toLowerCase();
      const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
      const isXml = fileName.endsWith('.xml');

      if (isExcel) {
        parseExcelFile(file);
      } else if (isXml) {
        // Potser és un fitxer SEPA pain.001
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result as string;
          if (isPain001File(text)) {
            parseSepaFile(text);
          } else {
            toast({ variant: 'destructive', title: t.movements.splitter.unknownFormat, description: t.movements.splitter.invalidPain001 });
          }
        };
        reader.readAsText(file, 'UTF-8');
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result as string;
          // Comprovar si és pain.001 encara que no tingui extensió .xml
          if (isPain001File(text)) {
            parseSepaFile(text);
          } else {
            processRawText(text);
          }
        };
        reader.readAsText(file, 'UTF-8');
      }
    }
    event.target.value = '';
  };

  // Parser per fitxers SEPA pain.001 (només mode OUT)
  const parseSepaFile = (xmlContent: string) => {
    if (!isPaymentRemittance) {
      toast({ variant: 'destructive', title: t.movements.splitter.error, description: t.movements.splitter.sepaOnlyImport });
      return;
    }

    try {
      const result = parsePain001(xmlContent);

      if (result.payments.length === 0) {
        toast({ variant: 'destructive', title: 'Fitxer buit', description: 'No s\'han trobat pagaments al fitxer SEPA' });
        return;
      }

      // Validar import total vs pare
      const parentAbsAmount = Math.abs(transaction.amount);
      if (Math.abs(parentAbsAmount - result.totalAmount) > 0.02) {
        toast({
          variant: 'destructive',
          title: 'Import no coincideix',
          description: `El total del fitxer (${result.totalAmount.toFixed(2)} €) no coincideix amb la transacció (${parentAbsAmount.toFixed(2)} €)`,
          duration: 9000,
        });
        return;
      }

      // Convertir pagaments SEPA a ParsedDonation (reutilitzem l'estructura)
      const donations: ParsedDonation[] = result.payments.map((payment, index) => {
        const matchedPaymentContact = findPaymentBeneficiary({
          name: payment.creditorName,
          taxId: '',
          iban: payment.creditorIban,
          contacts: paymentContacts,
        });
        const matchedDonor = matchedPaymentContact.contact as Donor | null;

        return {
          rowIndex: index + 1,
          name: payment.creditorName,
          taxId: '',
          taxIdValid: false,
          taxIdType: null as SpanishTaxIdType,
          idCandidate: '',
          iban: payment.creditorIban,
          amount: payment.amount,
          status: matchedDonor ? 'found' : 'new_without_taxid' as const,
          matchedDonor: matchedDonor ?? null,
          matchedContactType: matchedPaymentContact.contactType,
          shouldCreate: !matchedDonor,
          zipCode: '',
        };
      });

      setParsedDonations(donations);
      setTotalAmount(result.totalAmount);
      setStep('preview');

      toast({
        title: 'Fitxer SEPA importat',
        description: `${result.payments.length} pagaments carregats`,
      });

    } catch (error: any) {
      console.error('Error parsing SEPA:', error);
      toast({ variant: 'destructive', title: 'Error llegint SEPA', description: error.message });
    }
  };

  // Exportar a SEPA pain.001 (només mode OUT)
  const handleExportSepa = () => {
    if (!isPaymentRemittance || parsedDonations.length === 0) return;

    // Validar que tenim IBAN del deutor
    if (!debtorBankAccount?.iban) {
      toast({
        variant: 'destructive',
        title: 'IBAN no configurat',
        description: 'Cal configurar l\'IBAN del compte bancari per exportar el fitxer SEPA',
      });
      return;
    }

    // Validar imports invàlids
    const invalidAmounts = parsedDonations.filter(d => !d.amount || d.amount <= 0);
    if (invalidAmounts.length > 0) {
      toast({
        variant: 'destructive',
        title: t.movements.splitter.invalidAmounts,
        description: `${invalidAmounts.length} element(s) tenen import ≤ 0`,
      });
      return;
    }

    // Validar que el total quadra (±2 cèntims)
    if (Math.abs(validationDetails.deltaCents) > 2) {
      toast({
        variant: 'destructive',
        title: 'Import no quadra',
        description: `Delta: ${validationDetails.deltaCents / 100}€ (màx ±0.02€)`,
      });
      return;
    }

    try {
      // Preparar pagaments
      const payments = parsedDonations.map((d, index) => {
        const manualPaymentContact = d.manualMatchContactId
          ? paymentContacts.find((contact) => contact.id === d.manualMatchContactId) ?? null
          : null;

        return {
          amount: d.amount,
          creditorName: d.name || manualPaymentContact?.name || d.matchedDonor?.name || `Beneficiari ${index + 1}`,
          creditorIban: d.iban || manualPaymentContact?.iban || d.matchedDonor?.iban || '',
          concept: d.name ? `Pagament a ${d.name}` : `Pagament ${index + 1}`,
        };
      });

      // Validar que tots tenen IBAN
      const missingIban = payments.filter(p => !p.creditorIban);
      if (missingIban.length > 0) {
        toast({
          variant: 'destructive',
          title: 'Falten IBANs',
          description: `${missingIban.length} pagaments no tenen IBAN configurat`,
        });
        return;
      }

      // Generar i descarregar
      downloadPain001({
        debtorName: debtorBankAccount.name || t.sepa.organizationFallback,
        debtorIban: debtorBankAccount.iban,
        executionDate: new Date().toISOString().split('T')[0],
        payments,
      }, `pain001_${transaction.date}_${Date.now()}.xml`);

      toast({
        title: 'Fitxer SEPA generat',
        description: `S'ha descarregat el fitxer pain.001 amb ${payments.length} pagaments`,
      });

    } catch (error: any) {
      console.error('Error generating SEPA:', error);
      toast({ variant: 'destructive', title: 'Error generant SEPA', description: error.message });
    }
  };

  const parseExcelFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const XLSX = await import('xlsx');
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });

        // Agafa la primera fulla
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Converteix a matriu de files (totes les cel·les com a string)
        const rows: string[][] = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: '',
          raw: false
        });

        // Filtra files completament buides
        const filteredRows = rows.filter(row =>
          row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '')
        ).map(row =>
          row.map(cell => String(cell ?? '').trim())
        );

        if (filteredRows.length === 0) {
          toast({ variant: 'destructive', title: t.movements.splitter.error, description: t.movements.splitter.emptyExcel });
          return;
        }

        setAllRows(filteredRows);
        setRawText(''); // No tenim text raw per Excel
        setDelimiter(''); // No aplica per Excel

        // Detecta fila inicial i columnes
        const detectedStartRow = detectStartRow(filteredRows);
        setStartRow(detectedStartRow);

        const detected = detectColumns(filteredRows, detectedStartRow);
        setAmountColumn(detected.amount);
        setNameColumn(detected.name);
        setTaxIdColumn(detected.taxId);
        setIbanColumn(detected.iban);

        setStep('mapping');
      } catch (error: any) {
        console.error('Error parsing Excel:', error);
        toast({ variant: 'destructive', title: t.movements.splitter.error, description: `Error llegint Excel: ${error.message}` });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const processRawText = (text: string) => {
    setRawText(text);
    
    // Detecta delimitador
    const detectedDelimiter = detectDelimiter(text);
    setDelimiter(detectedDelimiter);
    
    // Parseja totes les files
    const lines = text.split('\n').filter(line => line.trim());
    const rows = lines.map(line => 
      line.split(detectedDelimiter).map(cell => cell.trim())
    );
    setAllRows(rows);

    // Detecta fila inicial i columnes
    const detectedStartRow = detectStartRow(rows);
    setStartRow(detectedStartRow);

    const detected = detectColumns(rows, detectedStartRow);
    setAmountColumn(detected.amount);
    setNameColumn(detected.name);
    setTaxIdColumn(detected.taxId);
    setIbanColumn(detected.iban);

    setStep('mapping');
  };

  const handleApplySavedMapping = (mapping: SavedMapping) => {
    setDelimiter(mapping.delimiter);
    setStartRow(mapping.startRow);
    setAmountColumn(mapping.amountColumn);
    setNameColumn(mapping.nameColumn);
    setTaxIdColumn(mapping.taxIdColumn);
    setIbanColumn(mapping.ibanColumn ?? null);

    // Re-parseja amb el nou delimitador si cal
    if (mapping.delimiter !== delimiter) {
      const lines = rawText.split('\n').filter(line => line.trim());
      const rows = lines.map(line =>
        line.split(mapping.delimiter).map(cell => cell.trim())
      );
      setAllRows(rows);
    }

    toast({ title: t.movements.splitter.configurationApplied, description: t.movements.splitter.configurationAppliedDescription(mapping.name) });
  };

  const handleSaveMapping = async () => {
    if (!organizationId || !newMappingName.trim()) return;

    try {
      const mappingRef = doc(collection(firestore, 'organizations', organizationId, 'remittanceMappings'));
      const mapping: SavedMapping = {
        id: mappingRef.id,
        name: newMappingName.trim(),
        delimiter,
        startRow,
        amountColumn,
        nameColumn,
        taxIdColumn,
        ibanColumn,
        createdAt: new Date().toISOString(),
      };
      await setDoc(mappingRef, mapping);
      setNewMappingName('');
      toast({ title: t.movements.splitter.configurationSaved, description: t.movements.splitter.configurationSavedDescription(mapping.name) });
    } catch (error) {
      console.error('Error saving mapping:', error);
      toast({ variant: 'destructive', title: t.movements.splitter.error, description: t.movements.splitter.errorSavingConfiguration });
    }
  };

  const handleDeleteMapping = async (mappingId: string) => {
    if (!organizationId) return;
    try {
      await deleteDoc(doc(firestore, 'organizations', organizationId, 'remittanceMappings', mappingId));
      toast({ title: t.movements.splitter.configurationDeleted });
    } catch (error) {
      console.error('Error deleting mapping:', error);
    }
  };

  // Normalitza IBAN eliminant prefix "IBAN ", espais i passant a majúscules
  const normalizeIban = (iban: string): string => {
    if (!iban) return '';
    return iban
      .replace(/^IBAN\s*/i, '') // Elimina prefix "IBAN " (Santander i altres)
      .replace(/\s/g, '')       // Elimina tots els espais
      .toUpperCase();
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // MATCHING P0: IBAN-FIRST per remeses IN
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Determina l'estat del donant per mostrar a la UI
   */
  const getDonorMatchStatus = (donor: Donor): DonorMatchStatus => {
    if ('deletedAt' in donor && donor.deletedAt) return 'deleted';
    if (donor.archivedAt) return 'archived';
    if (donor.status === 'inactive') return 'inactive';
    return 'active';
  };

  /**
   * Matching per remeses IN - IBAN és el criteri ÚNIC i PRIORITARI
   *
   * INVARIANTS P0:
   * 1. IBAN és el criteri de matching principal i prioritari
   * 2. L'estat del donant NO bloqueja el match (active, inactive, archived, deleted → TOTS fan match)
   * 3. IBAN duplicat és l'ÚNIC cas que bloqueja l'automatització
   * 4. DNI/NIF NO és criteri de cobrament (serveix per fiscalitat)
   *
   * @returns { status, donor, donors, method, matchedValue, matchNote }
   */
  const matchDonorForRemittance = (
    iban: string,
    allDonors: Donor[]
  ): {
    status: 'found' | 'found_inactive' | 'found_archived' | 'found_deleted' | 'ambiguous_iban' | 'no_iban_match';
    donor: Donor | null;
    donors?: Donor[];
    donorStatus?: DonorMatchStatus;
    method: MatchMethod;
    matchedValue: string;
    matchNote: string;
  } => {
    // Si no hi ha IBAN, no podem fer match
    if (!iban) {
      return {
        status: 'no_iban_match',
        donor: null,
        method: null,
        matchedValue: '',
        matchNote: 'IBAN no disponible al fitxer',
      };
    }

    const normalizedCsvIban = normalizeIban(iban);

    // Buscar TOTS els donants amb aquest IBAN (sense excloure cap estat)
    const matchedDonors = allDonors.filter(d =>
      d.iban && normalizeIban(d.iban) === normalizedCsvIban
    );

    // Cap resultat → IBAN no trobat
    if (matchedDonors.length === 0) {
      return {
        status: 'no_iban_match',
        donor: null,
        method: null,
        matchedValue: '',
        matchNote: 'IBAN no trobat a Summa',
      };
    }

    // Més d'un resultat → IBAN ambigu (duplicat)
    if (matchedDonors.length > 1) {
      return {
        status: 'ambiguous_iban',
        donor: null,
        donors: matchedDonors,
        method: 'iban',
        matchedValue: iban,
        matchNote: `IBAN duplicat: ${matchedDonors.length} donants`,
      };
    }

    // Exactament 1 resultat → match automàtic (independentment de l'estat)
    const matchedDonor = matchedDonors[0];
    const donorStatus = getDonorMatchStatus(matchedDonor);

    // Determinar estat i nota segons l'estat del donant
    let status: 'found' | 'found_inactive' | 'found_archived' | 'found_deleted';
    let matchNote: string;

    switch (donorStatus) {
      case 'deleted':
        status = 'found_deleted';
        matchNote = 'Registre eliminat, però la donació s\'imputa';
        break;
      case 'archived':
        status = 'found_archived';
        matchNote = 'Registre arxivat, però la donació s\'imputa';
        break;
      case 'inactive':
        status = 'found_inactive';
        matchNote = 'Donació imputada tot i estar de baixa';
        break;
      default:
        status = 'found';
        matchNote = 'Trobat per IBAN';
    }

    return {
      status,
      donor: matchedDonor,
      donorStatus,
      method: 'iban',
      matchedValue: matchedDonor.iban || iban,
      matchNote,
    };
  };

  // Fallback: matching per taxId (només per remeses IN quan no hi ha IBAN)
  // NOTA: Això és un fallback, NO crea donants nous
  const matchDonorByTaxId = (
    taxId: string,
    allDonors: Donor[]
  ): { donor: Donor | null; donorStatus?: DonorMatchStatus } => {
    if (!taxId) return { donor: null };

    const normalizedTaxId = normalizeString(taxId);
    const matchedDonor = allDonors.find(d => normalizeString(d.taxId) === normalizedTaxId);

    if (!matchedDonor) return { donor: null };

    return {
      donor: matchedDonor,
      donorStatus: getDonorMatchStatus(matchedDonor),
    };
  };

  // Buscar beneficiari per mode OUT (treballadors i proveïdors)
  // ORDRE IMPORTANT: Treballadors PRIMER (nòmines), Proveïdors DESPRÉS
  // Criteri: 1) IBAN, 2) NIF/CIF, 3) Nom exacte (normalitzat)
  // NO fuzzy matching, NO codi postal
  const findBeneficiary = (
    name: string,
    taxId: string,
    iban: string
  ): { contact: Donor | null; contactType: 'supplier' | 'employee' | undefined } => {
    const result = findPaymentBeneficiary({
      name,
      taxId,
      iban,
      contacts: paymentContacts,
    });

    return {
      contact: result.contact as Donor | null,
      contactType: result.contactType,
    };
  };

  const handleContinueToPreview = () => {
    // Permetre matching si hi ha almenys una columna d'identificació (nom, DNI o IBAN)
    if (nameColumn === null && taxIdColumn === null && ibanColumn === null) {
      toast({
        variant: 'destructive',
        title: t.movements.splitter.missingInfo,
        description: t.movements.splitter.missingInfoDescription
      });
      return;
    }

    setIsProcessing(true);

    try {
      const donations: ParsedDonation[] = [];
      let total = 0;

      const dataRows = allRows.slice(startRow);

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];

        const amount = parseAmount(row[amountColumn] || '');
        const name = nameColumn !== null ? (row[nameColumn] || '').trim() : '';

        // Obtenir taxId - pot venir de la columna taxId o ser detectat a "Referencia externa"
        let taxId = taxIdColumn !== null ? (row[taxIdColumn] || '').trim().toUpperCase() : '';

        // Si no tenim taxId directament, mirar si algun altre camp conté un DNI
        // Format Santander: la columna "Referencia externa" pot contenir el DNI
        if (!taxId) {
          for (let col = 0; col < row.length; col++) {
            if (col === amountColumn || col === nameColumn || col === ibanColumn) continue;
            const cellValue = (row[col] || '').trim().toUpperCase();
            // Detecta format DNI: 7-8 dígits + lletra, o NIE: XYZ + 7 dígits + lletra
            if (/^[0-9]{7,8}[A-Z]$/.test(cellValue) || /^[XYZ][0-9]{7}[A-Z]$/.test(cellValue)) {
              taxId = cellValue;
              break;
            }
          }
        }

        // Normalitzar IBAN (elimina prefix "IBAN " i espais)
        const rawIban = ibanColumn !== null ? (row[ibanColumn] || '').trim() : '';
        const iban = rawIban.replace(/^IBAN\s*/i, '').replace(/\s/g, '').toUpperCase();

        // Saltar files sense import o sense identificació
        if (amount <= 0 || (!name && !taxId && !iban)) continue;

        // Saltar files que semblen subtotals
        if (name.toLowerCase().includes('subtotal') || name.toLowerCase().includes('total')) continue;

        total += amount;

        // Guardem el valor cru per mostrar (referència bancària, etc.)
        const idCandidate = taxId;

        // Validació fiscal REAL: només és taxId vàlid si passa isValidSpanishTaxId()
        const taxIdValid = isValidSpanishTaxId(taxId);
        const taxIdType = getSpanishTaxIdType(taxId);

        // Normalitzar el taxId NOMÉS si és vàlid, sinó buidar-lo
        const normalizedTaxId = taxIdValid ? normalizeTaxId(taxId) : '';

        // Matching diferent segons mode IN (donants) o OUT (proveïdors/treballadors)
        let matchedDonor: Donor | null = null;
        let matchedContactType: 'donor' | 'supplier' | 'employee' | undefined;
        let matchMethod: MatchMethod = null;
        let matchValueMasked: string | undefined;
        let status: ParsedDonation['status'];

        if (isPaymentRemittance) {
          // Mode OUT: buscar a proveïdors i treballadors
          // Usem el taxId original per matching (pot haver-hi coincidència per altres camps)
          const result = findBeneficiary(name, taxId, iban);
          matchedDonor = result.contact;
          matchedContactType = result.contactType ?? undefined;
          // findBeneficiary no retorna method, però segueix l'ordre: IBAN > taxId > nom
          // Podríem expandir-ho en el futur si cal

          if (matchedDonor) {
            status = 'found';
          } else if (taxIdValid) {
            // NOMÉS és new_with_taxid si és un DNI/NIE/CIF vàlid
            status = 'new_with_taxid';
          } else {
            // Tot el que no passa validació fiscal → new_without_taxid (inclou refs bancàries)
            status = 'new_without_taxid';
          }
        } else {
          // ═══════════════════════════════════════════════════════════════════
          // MODE IN: MATCHING IBAN-FIRST (P0)
          // ═══════════════════════════════════════════════════════════════════
          // INVARIANTS:
          // 1. IBAN és el criteri de matching principal i prioritari
          // 2. L'estat del donant NO bloqueja el match
          // 3. IBAN duplicat és l'ÚNIC cas que bloqueja l'automatització
          // 4. DNI/NIF NO és criteri de cobrament
          // ═══════════════════════════════════════════════════════════════════

          // Usar TOTS els donants per matching IBAN (sense excloure cap estat)
          const allDonorsForMatching = filterAllForIbanMatching(existingDonors);
          const result = matchDonorForRemittance(iban, allDonorsForMatching);

          matchedDonor = result.donor;
          if (result.donor) {
            matchedContactType = 'donor';
          }
          matchMethod = result.method;
          status = result.status;

          // Variables addicionals per al nou matching
          let matchedDonorStatus: DonorMatchStatus | undefined = result.donorStatus;
          let ambiguousDonors: Donor[] | undefined = result.donors;
          let matchNote: string = result.matchNote;

          // Generar valor emmascarament per mostrar a la UI
          if (result.method && result.matchedValue) {
            matchValueMasked = maskMatchValue(result.method, result.matchedValue);
          }

          // Suggeriment per DNI quan IBAN no trobat
          let suggestedDonorByTaxId: Donor | undefined;
          if (status === 'no_iban_match' && taxIdValid && normalizedTaxId) {
            // Buscar donant amb el mateix DNI (podria ser que l'IBAN no estigui actualitzat)
            const taxIdMatch = matchDonorByTaxId(normalizedTaxId, allDonorsForMatching);
            if (taxIdMatch.donor) {
              suggestedDonorByTaxId = taxIdMatch.donor;
              matchNote = `IBAN no trobat, però DNI coincideix amb ${taxIdMatch.donor.name}`;
            }
          }

          // Push donation amb nous camps
          donations.push({
            rowIndex: startRow + i + 1,
            name,
            taxId: normalizedTaxId,
            taxIdValid,
            taxIdType,
            idCandidate,
            iban,
            amount,
            status,
            matchedDonor,
            matchedDonorStatus,
            ambiguousDonors,
            matchedContactType,
            matchMethod,
            matchValueMasked,
            // shouldCreate només per estats que permeten processament automàtic
            // Els pendents (no_iban_match, ambiguous_iban) NO es creen automàticament
            shouldCreate: false, // Mai crear automàticament - tot via IBAN
            zipCode: defaultZipCode,
            matchNote,
            suggestedDonorByTaxId,
          });
          continue; // Salt el push general de més avall
        }

        donations.push({
          rowIndex: startRow + i + 1,
          name,
          taxId: normalizedTaxId,          // Només guardem taxId si és vàlid
          taxIdValid,
          taxIdType,
          idCandidate,                     // Valor original (ref bancària, etc.)
          iban,
          amount,
          status,
          matchedDonor,
          matchedContactType,
          matchMethod,                     // Traçabilitat: com s'ha trobat el match
          matchValueMasked,                // Valor emmascarament per mostrar a la UI
          shouldCreate: false, // Mode OUT: mai crear automàticament
          zipCode: defaultZipCode,
        });
      }

      // Validar import total (comparar valors absoluts, tolerància ±0.02€)
      const parentAbsAmount = Math.abs(transaction.amount);
      if (Math.abs(parentAbsAmount - total) > 0.02) {
        toast({
          variant: 'destructive',
          title: t.movements.splitter.amountMismatch,
          description: t.movements.splitter.amountMismatchDescription(`${total.toFixed(2)} €`, `${parentAbsAmount.toFixed(2)} €`),
          duration: 9000,
        });
        setIsProcessing(false);
        return;
      }

      setParsedDonations(donations);
      setTotalAmount(total);
      setStep('preview');

    } catch (error: any) {
      console.error('Error processing data:', error);
      toast({ variant: 'destructive', title: t.movements.splitter.error, description: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleCreate = (index: number) => {
    setParsedDonations(prev => prev.map((d, i) => 
      i === index ? { ...d, shouldCreate: !d.shouldCreate } : d
    ));
  };

  const handleToggleAllNewWithTaxId = (checked: boolean) => {
    setParsedDonations(prev => prev.map(d => 
      d.status === 'new_with_taxid' ? { ...d, shouldCreate: checked } : d
    ));
  };

  const handleToggleAllNewWithoutTaxId = (checked: boolean) => {
    setParsedDonations(prev => prev.map(d => 
      d.status === 'new_without_taxid' ? { ...d, shouldCreate: checked } : d
    ));
  };

  const handleZipCodeChange = (index: number, zipCode: string) => {
    setParsedDonations(prev => prev.map((d, i) => 
      i === index ? { ...d, zipCode } : d
    ));
  };

  const handleApplyDefaultZipCode = () => {
    setParsedDonations(prev => prev.map(d =>
      d.status !== 'found' ? { ...d, zipCode: defaultZipCode } : d
    ));
  };

  // Assignar donant manualment a una línia ambigua
  const handleAssignDonorToLine = (rowIndex: number, donorId: string) => {
    setParsedDonations(prev => prev.map(d =>
      d.rowIndex === rowIndex
        ? { ...d, manualMatchContactId: donorId, manualMatchContactType: undefined }
        : d
    ));
  };

  // Assignar donant a totes les línies d'un grup IBAN (compte conjunta)
  const handleAssignDonorToGroup = (ibanKey: string, donorId: string) => {
    setParsedDonations(prev => prev.map(d => {
      if (d.status === 'ambiguous_iban' && normalizeIBAN(d.iban) === ibanKey) {
        return { ...d, manualMatchContactId: donorId, manualMatchContactType: undefined };
      }
      return d;
    }));
  };

  const handleAssignPaymentContactToLine = (rowIndex: number, serializedValue: string) => {
    if (!serializedValue) {
      setParsedDonations((prev) => prev.map((donation) =>
        donation.rowIndex === rowIndex
          ? { ...donation, manualMatchContactId: undefined, manualMatchContactType: undefined }
          : donation
      ));
      return;
    }

    const { contactId, contactType } = parseContactRoleValue(serializedValue);
    if (!contactId || (contactType !== 'supplier' && contactType !== 'employee')) {
      return;
    }

    setParsedDonations((prev) => prev.map((donation) =>
      donation.rowIndex === rowIndex
        ? { ...donation, manualMatchContactId: contactId, manualMatchContactType: contactType }
        : donation
    ));
  };

  const renderPaymentManualMatchControl = React.useCallback((donation: ParsedDonation) => {
    if (!isPaymentRemittance) return null;
    if (donation.status !== 'new_with_taxid' && donation.status !== 'new_without_taxid') return null;
    if (paymentContactOptions.length === 0) return null;

    const selectedOption = getPaymentContactLabel(
      donation.manualMatchContactId,
      donation.manualMatchContactType ?? null
    );

    return (
      <div className="space-y-1.5 pt-1">
        {selectedOption ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-green-700 font-medium">{selectedOption.name}</span>
            <Badge variant="secondary" className="text-xs px-1.5 py-0">
              {getContactTypeLabel(selectedOption.type, t.common ?? {})}
            </Badge>
          </div>
        ) : null}
        <Select
          value={selectedOption?.key ?? '__none__'}
          onValueChange={(value) => handleAssignPaymentContactToLine(donation.rowIndex, value === '__none__' ? '' : value)}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue placeholder={tr('movements.splitter.selectExistingPaymentContact', 'Vincula proveidor o treballador')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">
              {selectedOption
                ? tr('movements.splitter.clearExistingPaymentContact', 'Treure vincle manual')
                : tr('movements.splitter.keepCreateOrPending', 'Deixar com està')}
            </SelectItem>
            {paymentContactOptions.map((option) => (
              <SelectItem key={option.key} value={option.key}>
                {option.isMultiRole
                  ? `${option.contactName} · ${getContactTypeLabel(option.contactType, t.common ?? {})}`
                  : option.contactName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }, [
    getPaymentContactLabel,
    handleAssignPaymentContactToLine,
    isPaymentRemittance,
    paymentContactOptions,
    t.common,
    tr,
  ]);

  // Navegació ràpida: scroll a primera fila amb status donat
  const handleScrollToStatus = (status: 'ambiguous_iban' | 'no_iban_match') => {
    if (!tableContainerRef.current) return;

    const row = tableContainerRef.current.querySelector(`[data-status="${status}"]`);
    if (row) {
      row.scrollIntoView({ block: 'center', behavior: 'smooth' });
      // Highlight temporal
      row.classList.add('ring-2', 'ring-amber-400', 'ring-offset-1');
      setTimeout(() => {
        row.classList.remove('ring-2', 'ring-amber-400', 'ring-offset-1');
      }, 1500);
    }
  };

  // Reactivar un donant individual
  const handleReactivateDonor = async (index: number) => {
    const donation = parsedDonations[index];
    if (!donation.matchedDonor || !organizationId) return;

    try {
      const contactRef = doc(firestore, 'organizations', organizationId, 'contacts', donation.matchedDonor.id);
      await updateDoc(contactRef, {
        status: 'active',
        inactiveSince: null,
      });

      // Actualitzar l'estat local: canviar status a 'found' i actualitzar matchedDonor
      setParsedDonations(prev => prev.map((d, i) => {
        if (i === index && d.matchedDonor) {
          return {
            ...d,
            status: 'found',
            matchedDonor: (({ inactiveSince: _inactiveSince, ...matchedDonor }) => ({
              ...matchedDonor,
              status: 'active',
            }))(d.matchedDonor),
          };
        }
        return d;
      }));

      toast({
        title: t.movements.splitter.donorReactivated,
        description: t.movements.splitter.donorReactivatedDescription(donation.matchedDonor.name),
      });

    } catch (error: any) {
      console.error('Error reactivating donor:', error);
      toast({ variant: 'destructive', title: t.movements.splitter.error, description: error.message });
    }
  };

  // Reactivar tots els donants inactius
  const handleReactivateAllInactive = async () => {
    if (!organizationId) return;

    const inactiveDonations = parsedDonations.filter(d => d.status === 'found_inactive' && d.matchedDonor);
    if (inactiveDonations.length === 0) return;

    setIsProcessing(true);

    try {
      // Processar en chunks per evitar límit de 500 operacions de Firestore
      const BATCH_SIZE = 50;

      for (let i = 0; i < inactiveDonations.length; i += BATCH_SIZE) {
        const chunk = inactiveDonations.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(firestore);

        for (const donation of chunk) {
          if (donation.matchedDonor) {
            const contactRef = doc(firestore, 'organizations', organizationId, 'contacts', donation.matchedDonor.id);
            batch.update(contactRef, {
              status: 'active',
              inactiveSince: null,
            });
          }
        }

        await batch.commit();
        // Delay per permetre que la UI es repinti (augmentat per evitar bloquejos)
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Actualitzar l'estat local
      setParsedDonations(prev => prev.map(d => {
        if (d.status === 'found_inactive' && d.matchedDonor) {
          return {
            ...d,
            status: 'found',
            matchedDonor: (({ inactiveSince: _inactiveSince, ...matchedDonor }) => ({
              ...matchedDonor,
              status: 'active',
            }))(d.matchedDonor),
          };
        }
        return d;
      }));

      toast({
        title: t.movements.splitter.allDonorsReactivated,
        description: t.movements.splitter.allDonorsReactivatedDescription(inactiveDonations.length),
      });

    } catch (error: any) {
      console.error('Error reactivating donors:', error);
      toast({ variant: 'destructive', title: t.movements.splitter.error, description: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProcess = async () => {
    if (!organizationId) return;

    // Guardrail: no processar si no es compleixen les condicions
    if (!canProcess) {
      toast({
        variant: 'destructive',
        title: t.movements.splitter.cannotProcess,
        description: blockReason || t.movements.splitter.validationFailed,
      });
      return;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // MODE IN: Cridar API server-side (atòmic, idempotent, amb invariants)
    // MODE OUT: Mantenir comportament client-side (pendent migració futura)
    // ═══════════════════════════════════════════════════════════════════════
    if (!isPaymentRemittance) {
      await handleProcessServerSide();
    } else {
      await handleProcessClientSide();
    }
  };

  /**
   * Processament server-side per remeses IN (donacions)
   * Crida POST /api/remittances/in/process amb payload construït del parsing
   */
  const handleProcessServerSide = async () => {
    if (!organizationId || !user) return;

    const parentTxId = transaction.id;

    setStep('processing');
    setIsProcessing(true);
    try {
      // ═══════════════════════════════════════════════════════════════════════
      // Construir payload per l'API
      // ═══════════════════════════════════════════════════════════════════════

      // Filtrar items resolubles (amb contactId)
      const resolvableDonations = parsedDonations.filter(d =>
        d.status === 'found' ||
        d.status === 'found_inactive' ||
        d.status === 'found_archived' ||
        d.status === 'found_deleted' ||
        (d.status === 'ambiguous_iban' && !!d.manualMatchContactId) ||
        (d.status === 'no_iban_match' && !!d.manualMatchContactId)
      );

      // Filtrar pendents
      const pendingDonations = parsedDonations.filter(d =>
        (d.status === 'no_iban_match' && !d.manualMatchContactId) ||
        (d.status === 'ambiguous_iban' && !d.manualMatchContactId)
      );

      // Construir items per l'API
      const items = resolvableDonations.map(d => {
        const contactId = d.manualMatchContactId || d.matchedDonor?.id;
        if (!contactId) {
          throw new Error(`Item sense contactId a rowIndex ${d.rowIndex}`);
        }
        return {
          contactId,
          amountCents: Math.round(Math.abs(d.amount) * 100),
          iban: d.iban || d.matchedDonor?.iban || null,
          name: d.name || d.matchedDonor?.name || null,
          taxId: d.taxId || d.matchedDonor?.taxId || null,
          sourceRowIndex: d.rowIndex,
        };
      });

      // Construir pendingItems per l'API
      const pendingItems = pendingDonations.map(d => ({
        nameRaw: d.name || '',
        taxId: d.taxId || null,
        iban: d.iban || null,
        amountCents: Math.round(Math.abs(d.amount) * 100),
        reason: d.status === 'ambiguous_iban' ? 'AMBIGUOUS_IBAN' : 'NO_IBAN_MATCH',
        sourceRowIndex: d.rowIndex,
        ambiguousDonorIds: d.ambiguousDonors?.map(ad => ad.id),
      }));

      // ═══════════════════════════════════════════════════════════════════════
      // Cridar API server-side
      // ═══════════════════════════════════════════════════════════════════════
      const idToken = await user.getIdToken();
      const apiEndpoint = '/api/remittances/in/process';

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          orgId: organizationId,
          parentTxId,
          items,
          ...(pendingItems.length > 0 ? { pendingItems } : {}),
          category: transaction.category || null,
          bankAccountId: transaction.bankAccountId || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        // Error del servidor
        const errorMessage = result.error || 'Error processant remesa';
        const errorCode = result.code || 'UNKNOWN_ERROR';

        // Missatges específics per invariants
        if (errorCode === 'R-SUM-1') {
          toast({
            variant: 'destructive',
            title: t.movements.splitter.validationError,
            description: 'La suma dels items no coincideix amb l\'import del pare. Revisa les dades.',
            duration: 9000,
          });
        } else if (errorCode === 'LOCKED_BY_OTHER') {
          toast({
            variant: 'destructive',
            title: t.movements.splitter.operationBlocked,
            description: errorMessage,
            duration: 5000,
          });
        } else {
          toast({
            variant: 'destructive',
            title: t.movements.splitter.error,
            description: errorMessage,
            duration: 9000,
          });
        }

        setStep('preview');
        setIsProcessing(false);
        return;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // Èxit
      // ═══════════════════════════════════════════════════════════════════════
      if (result.idempotent) {
        toast({
          title: 'Remesa ja processada',
          description: 'Aquesta remesa ja s\'havia processat anteriorment.',
          variant: 'default',
        });
      } else {
        if (result.pendingCount && result.pendingCount > 0) {
          toast({
            title: t.movements.splitter.remittancePartial ?? 'Remesa parcial',
            description: typeof t.movements.splitter.remittancePartialDescription === 'function'
              ? t.movements.splitter.remittancePartialDescription(result.pendingCount)
              : `S'han creat ${result.createdCount} quotes. ${result.pendingCount} han quedat pendents.`,
            variant: 'default',
          });
        } else {
          toast({
            title: t.movements.splitter.remittanceProcessed,
            description: t.movements.splitter.remittanceProcessedDescription(result.createdCount || 0, 0),
          });
        }
      }

      setIsProcessing(false);
      setStep('upload');
      await new Promise(resolve => setTimeout(resolve, 100));
      onSplitDone();

    } catch (error: any) {
      console.error('[Splitter] Error processant remesa:', error);
      toast({
        variant: 'destructive',
        title: t.movements.splitter.error,
        description: error.message,
        duration: 9000,
      });
      setStep('preview');
      setIsProcessing(false);
    }
  };

  /**
   * Processament client-side per remeses OUT (pagaments)
   * Manté el comportament original fins a migració futura
   */
  const handleProcessClientSide = async () => {
    if (!organizationId) return;

    const parentTxId = transaction.id;
    const userId = user?.uid;
    let lockAcquired = false;

    // ═══════════════════════════════════════════════════════════════════════
    // LOCK: Adquirir lock per evitar doble processament concurrent
    // ═══════════════════════════════════════════════════════════════════════
    if (userId) {
      const lockResult = await acquireProcessLock({
        firestore,
        orgId: organizationId,
        parentTxId,
        operation: 'remittanceSplit',
        uid: userId,
      });

      if (!lockResult.ok) {
        console.warn(`[Splitter] ⚠️ Lock failed for parent ${parentTxId}:`, lockResult.reason);
        toast({
          variant: 'destructive',
          title: t.movements.splitter.operationBlocked,
          description: getLockFailureMessage(lockResult),
        });
        return;
      }

      lockAcquired = true;
    }

    setStep('processing');
    setIsProcessing(true);
    try {
      const transactionsRef = collection(firestore, 'organizations', organizationId, 'transactions');
      const contactsRef = collection(firestore, 'organizations', organizationId, 'contacts');
      const remittancesRef = collection(firestore, 'organizations', organizationId, 'remittances');

      const newDonorIds: Map<number, string> = new Map();
      const CHUNK_SIZE = 50;

      // 0. Crear document de remesa
      const remittanceRef = doc(remittancesRef);
      const remittanceId = remittanceRef.id;
      const now = new Date().toISOString();

      // Mode OUT: comportament original
      const resolvableDonations = parsedDonations.filter(d =>
        d.status === 'found' ||
        d.status === 'found_inactive' ||
        d.status === 'found_archived' ||
        d.status === 'found_deleted' ||
        !!d.manualMatchContactId ||
        (d.status === 'new_with_taxid' && !d.manualMatchContactId && d.name && d.amount > 0)
      );

      const pendingDonations = parsedDonations.filter(d =>
        !d.manualMatchContactId &&
        (
          d.status === 'new_without_taxid' ||
          (d.status === 'new_with_taxid' && (!d.name || d.amount <= 0))
        )
      );

      // 1. Crear nous contactes (mode OUT)
      const contactsToCreate = resolvableDonations.filter(
        (d) => d.status === 'new_with_taxid' && !d.manualMatchContactId
      );

      for (let i = 0; i < contactsToCreate.length; i += CHUNK_SIZE) {
        const chunk = contactsToCreate.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(firestore);

        for (const item of chunk) {
          const newContactRef = doc(contactsRef);
          const newContactData = {
            type: 'supplier' as const,
            name: item.name || `Proveïdor ${item.taxId}`,
            taxId: item.taxId,
            zipCode: '',
            createdAt: now,
          };

          batch.set(newContactRef, newContactData);
          newDonorIds.set(item.rowIndex, newContactRef.id);
        }

        await batch.commit();
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // 2. Crear transaccions filles NOMÉS per resoluble
      const childTransactionIds: string[] = [];
      let resolvedTotalCents = 0;

      for (let i = 0; i < resolvableDonations.length; i += CHUNK_SIZE) {
        const chunk = resolvableDonations.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(firestore);

        for (const item of chunk) {
          const newTxRef = doc(transactionsRef);
          childTransactionIds.push(newTxRef.id);

          let contactId: string | null = null;
          if (item.manualMatchContactId) {
            contactId = item.manualMatchContactId;
          } else if (item.matchedDonor) {
            contactId = item.matchedDonor.id;
          } else if (item.status === 'new_with_taxid') {
            contactId = newDonorIds.get(item.rowIndex) || null;
          }

          const displayName = item.name || item.taxId || t.movements.splitter.anonymous;
          const category = transaction.category || 'supplierPayments';
          const finalAmount = -Math.abs(item.amount);
          const description = `Pagament: ${displayName}`;
          const resolvedContactType = resolvePaymentChildContactType({
            contactId,
            status: item.status,
            manualMatchContactType: item.manualMatchContactType ?? null,
            matchedContactType: item.matchedContactType,
          });

          resolvedTotalCents += Math.round(Math.abs(item.amount) * 100);

          const newTxData: Omit<Transaction, 'id'> & { id: string } = {
            id: newTxRef.id,
            date: transaction.date,
            description,
            amount: finalAmount,
            category,
            document: null,
            contactId,
            projectId: transaction.projectId ?? null,
            source: 'remittance',
            parentTransactionId: transaction.id,
            bankAccountId: transaction.bankAccountId ?? null,
            isRemittanceItem: true,
            remittanceId,
            ...(resolvedContactType ? { contactType: resolvedContactType } : {}),
          };

          batch.set(newTxRef, newTxData);
        }

        await batch.commit();
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // 3. Guardar pendents a subcol·lecció
      let pendingTotalCents = 0;
      if (pendingDonations.length > 0) {
        const pendingRef = collection(firestore, 'organizations', organizationId, 'remittances', remittanceId, 'pending');

        for (let i = 0; i < pendingDonations.length; i += CHUNK_SIZE) {
          const chunk = pendingDonations.slice(i, i + CHUNK_SIZE);
          const batch = writeBatch(firestore);

          for (const item of chunk) {
            const pendingDocRef = doc(pendingRef);
            const reason: import('@/lib/data').RemittancePendingReason = !item.taxId ? 'NO_TAXID' :
                     !item.name || item.amount <= 0 ? 'INVALID_DATA' :
                     'NO_MATCH';

            pendingTotalCents += Math.round(Math.abs(item.amount) * 100);

            batch.set(pendingDocRef, {
              id: pendingDocRef.id,
              nameRaw: item.name || '',
              taxId: item.taxId || null,
              iban: item.iban || null,
              amountCents: Math.round(Math.abs(item.amount) * 100),
              reason,
              sourceRowIndex: item.rowIndex,
              createdAt: now,
            });
          }

          await batch.commit();
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Calcular totals en cèntims
      const expectedTotalCents = Math.round(parsedDonations.reduce((sum, d) => sum + Math.abs(d.amount), 0) * 100);
      const remittanceStatus = pendingDonations.length > 0 ? 'partial' : 'complete';

      // 4. Crear document de remesa amb totals
      await setDoc(remittanceRef, {
        direction: direction.toLowerCase(),
        type: 'payments',
        parentTransactionId: transaction.id,
        transactionIds: childTransactionIds,
        totalAmount: Math.abs(totalAmount),
        itemCount: parsedDonations.length,
        createdAt: now,
        createdBy: user?.uid ?? null,
        bankAccountId: transaction.bankAccountId ?? null,
        resolvedCount: resolvableDonations.length,
        pendingCount: pendingDonations.length,
        expectedTotalCents,
        resolvedTotalCents,
        pendingTotalCents,
        validation: {
          deltaCents: validationDetails.deltaCents,
          parentAmount: validationDetails.parentAmount,
          totalItems: validationDetails.totalItems,
          validatedAt: now,
          validatedByUid: user?.uid ?? null,
        },
      });
      // 5. Marcar transacció pare
      const updateBatch = writeBatch(firestore);
      updateBatch.update(doc(transactionsRef, transaction.id), {
        isRemittance: true,
        remittanceItemCount: parsedDonations.length,
        remittanceDirection: direction,
        remittanceType: 'payments',
        remittanceId,
        remittanceStatus,
        remittanceResolvedCount: resolvableDonations.length,
        remittancePendingCount: pendingDonations.length,
        remittanceExpectedTotalCents: expectedTotalCents,
        remittanceResolvedTotalCents: resolvedTotalCents,
        remittancePendingTotalCents: pendingTotalCents,
        category: transaction.category || 'supplierPayments',
        contactId: null,
        contactType: null,
      });
      await updateBatch.commit();

      if (pendingDonations.length > 0) {
        toast({
          title: t.movements.splitter.remittancePartial ?? 'Remesa parcial',
          description: typeof t.movements.splitter.remittancePartialDescription === 'function'
            ? t.movements.splitter.remittancePartialDescription(pendingDonations.length)
            : `S'han creat ${resolvableDonations.length} quotes. ${pendingDonations.length} han quedat pendents.`,
          variant: 'default',
        });
      } else {
        toast({
          title: t.movements.splitter.paymentsRemittanceProcessed,
          description: t.movements.splitter.paymentsRemittanceProcessedDescription(parsedDonations.length, contactsToCreate.length),
        });
      }

      setIsProcessing(false);
      setStep('upload');
      await new Promise(resolve => setTimeout(resolve, 100));
      onSplitDone();

    } catch (error: any) {
      console.error("Error processing remittance:", error);
      toast({ variant: 'destructive', title: t.movements.splitter.error, description: error.message, duration: 9000 });
      setStep('preview');
      setIsProcessing(false);
    } finally {
      // Alliberar lock sempre (encara que hi hagi error)
      if (lockAcquired && userId) {
        await releaseProcessLock({ firestore, orgId: organizationId, parentTxId });
      }
    }
  };


  // ═══════════════════════════════════════════════════════════════════════════
  // RENDERITZACIÓ
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={remittanceDialogContentClassName}>
        
        {/* ═══════════════════════════════════════════════════════════════════
            STEP 1: UPLOAD
            ═══════════════════════════════════════════════════════════════════ */}
        {step === 'upload' && (
          <>
            <DialogHeader>
              <DialogTitle>
                {isPaymentRemittance
                  ? t.movements.splitter.paymentsTitle
                  : t.movements.splitter.title}
              </DialogTitle>
              <DialogDescription>
                {isPaymentRemittance
                  ? t.movements.splitter.paymentsUploadDescription
                  : t.movements.splitter.uploadDescription}
              </DialogDescription>
            </DialogHeader>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>{t.movements.splitter.compatibleBanks}</AlertTitle>
              <AlertDescription>
                {t.movements.splitter.compatibleBanksDescription}
              </AlertDescription>
            </Alert>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv,.txt,.xlsx,.xls,.xml"
              className="hidden"
              disabled={isProcessing}
            />

            <div className="flex flex-col gap-2">
              <Button onClick={handleFileClick} disabled={isProcessing} className="w-full">
                {isProcessing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileUp className="mr-2 h-4 w-4" />
                )}
                {t.movements.splitter.selectCsvFile}
              </Button>

              {/* Botó SEPA només per mode OUT */}
              {isPaymentRemittance && (
                <Button onClick={handleFileClick} disabled={isProcessing} variant="outline" className="w-full">
                  <FileCode className="mr-2 h-4 w-4" />
                  {t.movements.splitter.importSepa}
                </Button>
              )}
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  {t.movements.splitter.cancel}
                </Button>
              </DialogClose>
            </DialogFooter>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            STEP 2: MAPPING
            ═══════════════════════════════════════════════════════════════════ */}
        {step === 'mapping' && (
          <>
            <div className="shrink-0 border-b px-4 py-4 sm:px-6">
              <DialogHeader className="pr-8">
                <DialogTitle className="flex items-center gap-2">
                  <Settings2 className="h-5 w-5" />
                  {t.movements.splitter.configureMappingTitle}
                </DialogTitle>
                <DialogDescription>
                  {t.movements.splitter.configureMappingDescription}
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
              <div className="space-y-6">
                {savedMappings && savedMappings.length > 0 && (
                  <div className="rounded-lg border bg-muted/50 p-4">
                    <Label className="text-sm font-medium">{t.movements.splitter.savedConfigurations}</Label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {savedMappings.map(mapping => (
                        <div key={mapping.id} className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleApplySavedMapping(mapping)}
                          >
                            {mapping.name}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive"
                            onClick={() => handleDeleteMapping(mapping.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] xl:items-start">
                  <div className="rounded-lg border p-4">
                    <Label className="font-medium">{tr('movements.splitter.basicConfigTitle', 'Configuracio basica')}</Label>
                    <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {rawText && (
                        <div className="space-y-1">
                          <Label className="text-xs">{t.movements.splitter.delimiter}</Label>
                          <Select value={delimiter} onValueChange={(v) => {
                            setDelimiter(v);
                            const lines = rawText.split('\n').filter(line => line.trim());
                            const rows = lines.map(line => line.split(v).map(cell => cell.trim()));
                            setAllRows(rows);
                          }}>
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value=";">{t.movements.splitter.semicolon}</SelectItem>
                              <SelectItem value=",">{t.movements.splitter.comma}</SelectItem>
                              <SelectItem value={"\t"}>{t.movements.splitter.tab}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div className="space-y-1">
                        <Label className="text-xs">{t.movements.splitter.startRow}</Label>
                        <Input
                          type="number"
                          min={0}
                          max={allRows.length - 1}
                          value={startRow}
                          onChange={(e) => setStartRow(parseInt(e.target.value) || 0)}
                          className="h-8"
                        />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <Label className="text-xs">{t.movements.splitter.totalRows}</Label>
                        <div className="flex h-8 items-center text-sm text-muted-foreground">
                          {t.movements.splitter.totalRowsCount(allRows.length, allRows.length - startRow)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-lg border border-border/80 bg-muted/20 p-4">
                    <Label className="font-medium">{t.movements.splitter.fieldMapping}</Label>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                      <div className="space-y-1">
                        <Label className="text-xs flex items-center gap-1">
                          <span className="w-3 h-3 rounded bg-green-500"></span>
                          {t.movements.splitter.amountMandatory}
                        </Label>
                        <Select
                          value={String(amountColumn)}
                          onValueChange={(v) => setAmountColumn(parseInt(v))}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: numColumns }, (_, i) => (
                              <SelectItem key={i} value={String(i)}>
                                Columna {i}: {previewRows[0]?.[i]?.substring(0, 20) || '-'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs flex items-center gap-1">
                          <span className="w-3 h-3 rounded bg-cyan-500"></span>
                          {t.movements.splitter.iban}
                        </Label>
                        <Select
                          value={ibanColumn !== null ? String(ibanColumn) : 'none'}
                          onValueChange={(v) => setIbanColumn(v === 'none' ? null : parseInt(v))}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{t.movements.splitter.notAvailable}</SelectItem>
                            {Array.from({ length: numColumns }, (_, i) => (
                              <SelectItem key={i} value={String(i)}>
                                Columna {i}: {previewRows[0]?.[i]?.substring(0, 20) || '-'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1 sm:col-span-2 2xl:col-span-1">
                        <Label className="text-xs flex items-center gap-1">
                          <span className="w-3 h-3 rounded bg-blue-500"></span>
                          {t.movements.splitter.name}
                        </Label>
                        <Select
                          value={nameColumn !== null ? String(nameColumn) : 'none'}
                          onValueChange={(v) => setNameColumn(v === 'none' ? null : parseInt(v))}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{t.movements.splitter.notAvailable}</SelectItem>
                            {Array.from({ length: numColumns }, (_, i) => (
                              <SelectItem key={i} value={String(i)}>
                                Columna {i}: {previewRows[0]?.[i]?.substring(0, 20) || '-'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 rounded-lg border border-border/80 bg-card p-4">
                  <Label className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    {t.movements.splitter.preview(previewRows.length)}
                  </Label>
                  <div className="space-y-3 xl:hidden">
                    {previewRows.map((row, rowIdx) => (
                      <div key={rowIdx} className="rounded-lg border border-border/80 bg-card p-4">
                        <div className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Fila {startRow + rowIdx + 1}
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {Array.from({ length: numColumns }, (_, colIdx) => (
                            <div
                              key={colIdx}
                              className={`rounded-md border p-2 text-sm ${
                                colIdx === amountColumn ? 'bg-green-50 border-green-200' :
                                colIdx === nameColumn ? 'bg-blue-50 border-blue-200' :
                                colIdx === taxIdColumn ? 'bg-purple-50 border-purple-200' :
                                colIdx === ibanColumn ? 'bg-cyan-50 border-cyan-200' :
                                'bg-background'
                              }`}
                            >
                              <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                {t.movements.splitter.columnPrefix(colIdx)}
                              </div>
                              <div className="break-words text-xs">{row[colIdx] || '-'}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="hidden max-h-[340px] overflow-auto rounded-md border border-border/80 bg-card xl:block">
                    <Table className="w-full min-w-[960px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12 text-xs">#</TableHead>
                          {Array.from({ length: numColumns }, (_, i) => (
                            <TableHead key={i} className="min-w-[120px] text-xs">
                              {t.movements.splitter.columnPrefix(i)}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewRows.map((row, rowIdx) => (
                          <TableRow key={rowIdx}>
                            <TableCell className="text-xs text-muted-foreground">
                              {startRow + rowIdx + 1}
                            </TableCell>
                            {Array.from({ length: numColumns }, (_, colIdx) => (
                              <TableCell
                                key={colIdx}
                                className={`max-w-[220px] whitespace-normal break-words text-xs ${
                                  colIdx === amountColumn ? 'bg-green-100 dark:bg-green-900/30' :
                                  colIdx === nameColumn ? 'bg-blue-100 dark:bg-blue-900/30' :
                                  colIdx === taxIdColumn ? 'bg-purple-100 dark:bg-purple-900/30' :
                                  colIdx === ibanColumn ? 'bg-cyan-100 dark:bg-cyan-900/30' :
                                  ''
                                }`}
                              >
                                {row[colIdx] || '-'}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)] xl:items-start">
                  <Collapsible open={isAdvancedMappingOpen} onOpenChange={setIsAdvancedMappingOpen} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between gap-4">
                      <Label className="font-medium">{tr('movements.splitter.optionalFieldsTitle', 'Mes camps')}</Label>
                      <CollapsibleTrigger asChild>
                        <Button type="button" variant="ghost" size="sm" className="gap-2 px-2">
                          {tr('movements.splitter.showOptionalFields', 'Mostrar opcionals')}
                          <ChevronDown className={`h-4 w-4 transition-transform ${isAdvancedMappingOpen ? 'rotate-180' : ''}`} />
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                    <CollapsibleContent className="pt-4">
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-xs flex items-center gap-1">
                            <span className="w-3 h-3 rounded bg-purple-500"></span>
                            {t.movements.splitter.taxId}
                          </Label>
                          <Select
                            value={taxIdColumn !== null ? String(taxIdColumn) : 'none'}
                            onValueChange={(v) => setTaxIdColumn(v === 'none' ? null : parseInt(v))}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">{t.movements.splitter.notAvailable}</SelectItem>
                              {Array.from({ length: numColumns }, (_, i) => (
                                <SelectItem key={i} value={String(i)}>
                                  Columna {i}: {previewRows[0]?.[i]?.substring(0, 20) || '-'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  <div className="rounded-lg border p-4">
                    <Label className="font-medium">{tr('movements.splitter.saveConfigTitle', 'Guardar configuracio')}</Label>
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row xl:flex-col">
                      <Input
                        placeholder={t.movements.splitter.configName}
                        value={newMappingName}
                        onChange={(e) => setNewMappingName(e.target.value)}
                        className="h-8 flex-1"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSaveMapping}
                        disabled={!newMappingName.trim()}
                        className="xl:w-full"
                      >
                        <Save className="mr-1 h-3 w-3" />
                        {t.movements.splitter.save}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="shrink-0 border-t px-4 py-4 sm:px-6">
              {mappingMissingMessage ? (
                <p className="mb-3 text-sm text-muted-foreground">{mappingMissingMessage}</p>
              ) : null}
              <DialogFooter className="gap-2 sm:justify-between sm:space-x-0">
                <Button variant="outline" onClick={() => setStep('upload')}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {t.movements.splitter.back}
                </Button>
                <Button onClick={handleContinueToPreview} disabled={isProcessing || !mappingHasIdentifier}>
                  {isProcessing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="mr-2 h-4 w-4" />
                  )}
                  {t.movements.splitter.continue}
                </Button>
              </DialogFooter>
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            STEP 3: PREVIEW - Wide modal with fixed header/footer
            ═══════════════════════════════════════════════════════════════════ */}
        {step === 'preview' && (
          <>
            <div className="shrink-0 border-b px-6 py-4">
              {/* Títol i descripció */}
              <DialogHeader className="space-y-3 pr-8 pb-0">
                <DialogTitle>
                  {isPaymentRemittance
                    ? t.movements.splitter.paymentsReviewTitle
                    : t.movements.splitter.reviewTitle}
                </DialogTitle>
                <DialogDescription>
                  {isPaymentRemittance
                    ? t.movements.splitter.paymentsReviewDescription
                    : t.movements.splitter.reviewDescription}
                </DialogDescription>
                {/* P0: Header resum compacte - Format: "314 trobades · 3 pendents · Total 4.390,00 €" */}
                <div className="flex flex-wrap items-center gap-3">
                  {/* Mode IN: mostrar trobades per IBAN (totalFound) */}
                  {!isPaymentRemittance ? (
                    <>
                    {/* Trobades per IBAN (tots els estats: active, inactive, archived, deleted) */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-green-50 border border-green-200 text-sm">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                      <span className="font-semibold text-green-700">{stats.totalFound}</span>
                      <span className="text-green-600">{tr('movements.splitter.foundCountLabel', 'trobades')}</span>
                    </div>

                    {/* Desglossat per estats especials */}
                    {stats.foundInactive > 0 && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-sm">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                        <span className="font-semibold text-amber-700">{stats.foundInactive}</span>
                        <span className="text-amber-600">{tr('movements.splitter.inactiveLabel', 'Baixa')}</span>
                      </div>
                    )}
                    {stats.foundArchived > 0 && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-100 border border-gray-300 text-sm">
                        <AlertTriangle className="h-3.5 w-3.5 text-gray-600" />
                        <span className="font-semibold text-gray-700">{stats.foundArchived}</span>
                        <span className="text-gray-600">{tr('movements.splitter.archivedLabel', 'Arxivat')}</span>
                      </div>
                    )}
                    {stats.foundDeleted > 0 && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-50 border border-red-200 text-sm">
                        <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                        <span className="font-semibold text-red-700">{stats.foundDeleted}</span>
                        <span className="text-red-600">{tr('movements.splitter.deletedLabel', 'Eliminat')}</span>
                      </div>
                    )}

                    {/* Pendents (IBAN no trobat o ambigu) */}
                    {stats.totalPending > 0 && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-orange-50 border border-orange-200 text-sm">
                        <AlertCircle className="h-3.5 w-3.5 text-orange-600" />
                        <span className="font-semibold text-orange-700">{stats.totalPending}</span>
                        <span className="text-orange-600">{tr('movements.splitter.pendingCountLabel', 'pendents')}</span>
                      </div>
                    )}

                    {/* Desglossat pendents */}
                    {stats.ambiguousIban > 0 && (
                      <button
                        type="button"
                        onClick={() => handleScrollToStatus('ambiguous_iban')}
                        className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-100 border border-red-300 text-xs hover:bg-red-200 transition-colors cursor-pointer"
                        title={t.movements.splitter.goToAmbiguous(stats.ambiguousIban)}
                      >
                        <span className="font-semibold text-red-700">{stats.ambiguousIban}</span>
                        <span className="text-red-600">{tr('movements.splitter.ambiguousIbanLabel', 'IBAN ambigu')}</span>
                        <ArrowRight className="h-3 w-3 text-red-500" />
                      </button>
                    )}
                    {stats.noIbanMatch > 0 && (
                      <button
                        type="button"
                        onClick={() => handleScrollToStatus('no_iban_match')}
                        className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-orange-100 border border-orange-300 text-xs hover:bg-orange-200 transition-colors cursor-pointer"
                        title={t.movements.splitter.goToNotFound(stats.noIbanMatch)}
                      >
                        <span className="font-semibold text-orange-700">{stats.noIbanMatch}</span>
                        <span className="text-orange-600">{tr('movements.splitter.noIbanMatchLabel', 'IBAN no trobat')}</span>
                        <ArrowRight className="h-3 w-3 text-orange-500" />
                      </button>
                    )}
                  </>
                ) : (
                  /* Mode OUT: comportament original */
                  <>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted text-sm">
                      <span className="font-semibold">{parsedDonations.length}</span>
                      <span className="text-muted-foreground">{t.movements.splitter.payments}</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-green-50 border border-green-200 text-sm">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                      <span className="font-semibold text-green-700">{stats.found}</span>
                      <span className="text-green-600">{t.movements.splitter.found}</span>
                    </div>
                    {stats.foundInactive > 0 && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-sm">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                        <span className="font-semibold text-amber-700">{stats.foundInactive}</span>
                        <span className="text-amber-600">{t.movements.splitter.foundInactiveBadge}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleReactivateAllInactive}
                          disabled={isProcessing}
                          className="h-5 px-1.5 text-xs text-amber-700 hover:text-amber-900 hover:bg-amber-100 ml-1"
                        >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    {stats.newWithTaxId > 0 && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200 text-sm">
                        <UserPlus className="h-3.5 w-3.5 text-blue-600" />
                        <span className="font-semibold text-blue-700">{stats.newWithTaxId}</span>
                        <span className="text-blue-600">{t.movements.splitter.newWithTaxId}</span>
                      </div>
                    )}
                    {stats.newWithoutTaxId > 0 && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-orange-50 border border-orange-200 text-sm">
                        <AlertCircle className="h-3.5 w-3.5 text-orange-600" />
                        <span className="font-semibold text-orange-700">{stats.newWithoutTaxId}</span>
                        <span className="text-orange-600">{t.movements.splitter.newWithoutTaxId}</span>
                      </div>
                    )}
                    </>
                  )}

                  {/* Separador visual amb més contrast (el de 1px quedava massa subtil) */}
                  <div className="mx-1 h-5 w-[1.5px] shrink-0 bg-border/90" aria-hidden="true" />

                  {/* Import total compacte */}
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm ${
                    Math.abs(validationDetails.deltaCents) <= 2 && (!stats.ambiguousIban || isPaymentRemittance)
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-red-50 border border-red-200'
                  }`}>
                    <CheckCircle2 className={`h-3.5 w-3.5 ${
                      Math.abs(validationDetails.deltaCents) <= 2 && (!stats.ambiguousIban || isPaymentRemittance) ? 'text-green-600' : 'text-red-600'
                    }`} />
                    <span className="font-semibold">{formatCurrencyEU(totalAmount)}</span>
                    <span className="text-muted-foreground">/ {formatCurrencyEU(Math.abs(transaction.amount))}</span>
                    {validationDetails.deltaCents !== 0 && (
                      <span className={`text-xs ml-1 ${Math.abs(validationDetails.deltaCents) <= 2 ? 'text-green-600' : 'text-red-600'}`}>
                        (Δ {validationDetails.deltaCents > 0 ? '+' : ''}{(validationDetails.deltaCents / 100).toFixed(2)}€)
                      </span>
                    )}
                  </div>
                </div>
              </DialogHeader>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-4">
                {/* Banner d'alerta quan delta > ±2 cèntims */}
                {Math.abs(validationDetails.deltaCents) > 2 && (
                  <Alert variant="destructive" className="py-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle className="text-sm">Imports no quadren</AlertTitle>
                    <AlertDescription className="text-xs">
                      Diferència: {validationDetails.deltaCents > 0 ? '+' : ''}{(validationDetails.deltaCents / 100).toFixed(2)}€
                      (màxim permès: ±0.02€). Revisa els imports o torna a importar el fitxer.
                    </AlertDescription>
                  </Alert>
                )}

              {/* Opcions per crear contactes - compacte */}
              {/* Per mode IN: mostra opcions de CP i checkboxes de creació de donants */}
              {/* Per mode OUT: només mostra checkboxes (no CP) */}
              {(stats.newWithTaxId > 0 || stats.newWithoutTaxId > 0) && (
                <div className="flex flex-wrap items-center gap-4 px-3 py-2 rounded-md bg-muted/50 border text-sm">
                  {/* CP només per mode IN (donants) */}
                  {!isPaymentRemittance && (
                    <>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="defaultZipCode" className="text-xs whitespace-nowrap text-muted-foreground">
                          {t.movements.splitter.defaultZipCode}:
                        </Label>
                        <Input
                          id="defaultZipCode"
                          value={defaultZipCode}
                          onChange={(e) => setDefaultZipCode(e.target.value)}
                          className="w-20 h-7 text-xs"
                          placeholder={t.movements.splitter.zipCodePlaceholder}
                        />
                        <Button variant="ghost" size="sm" onClick={handleApplyDefaultZipCode} className="h-7 px-2 text-xs">
                          {t.movements.splitter.applyToAll}
                        </Button>
                      </div>
                      <div className="h-4 w-[1.5px] shrink-0 bg-border/90" aria-hidden="true" />
                    </>
                  )}

                  {/* Info: els nous donants amb taxId es creen automàticament, els altres van a pendents */}
                  {stats.newWithTaxId > 0 && (
                    <div className="flex items-center space-x-1.5 text-xs text-blue-600">
                      <UserPlus className="h-3.5 w-3.5" />
                      <span>{t.movements.splitter.willCreateWithTaxId?.(stats.newWithTaxId) ?? `${stats.newWithTaxId} es crearan (amb DNI)`}</span>
                    </div>
                  )}
                  {stats.newWithoutTaxId > 0 && (
                    <div className="flex items-center space-x-1.5 text-xs text-orange-600">
                      <AlertCircle className="h-3.5 w-3.5" />
                      <span>{t.movements.splitter.willBePendingWithNote?.(stats.newWithoutTaxId) ?? t.movements.splitter.willBePending?.(stats.newWithoutTaxId) ?? `${stats.newWithoutTaxId} quedaran pendents (sense DNI)`}</span>
                    </div>
                  )}
                </div>
              )}

              {isPaymentRemittance && parsedDonations.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2">
                  <span className="text-sm text-muted-foreground">
                    {t.movements.splitter.exportSepaTooltip}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportSepa}
                    disabled={isProcessing || !debtorBankAccount?.iban || !canProcess}
                    title={
                      !debtorBankAccount?.iban
                        ? t.movements.splitter.configureIban
                        : !canProcess
                        ? blockReason || t.movements.splitter.validationFailed
                        : t.movements.splitter.exportSepaTooltip
                    }
                  >
                    <Download className="mr-1 h-3 w-3" />
                    {t.movements.splitter.exportSepa}
                  </Button>
                </div>
              )}

              {/* InfoBox informatiu: només si hi ha pendents i és remesa IN */}
              {stats.newWithoutTaxId > 0 && !isPaymentRemittance && (
                <div className="px-3 py-3 rounded-md bg-orange-50 border border-orange-200 text-orange-900 text-sm">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div className="space-y-2">
                      <p className="font-medium">
                        {t.movements.splitter.pendingPreProcessTitle ?? "Algunes línies no es poden processar ara"}
                      </p>
                      <p className="text-xs text-orange-800">
                        {t.movements.splitter.pendingPreProcessBody ?? "Aquesta remesa conté donacions que no porten DNI/NIF fiscal vàlid i l'IBAN no coincideix amb cap donant existent."}
                      </p>
                      <div className="pt-1">
                        <p className="font-medium text-xs">
                          {t.movements.splitter.pendingPreProcessNextTitle ?? "Què passarà després de processar"}
                        </p>
                        <ol className="list-decimal list-inside text-xs text-orange-800 mt-1 space-y-0.5">
                          <li>{t.movements.splitter.pendingPreProcessNextStep1 ?? "Aquestes línies quedaran com a \"Pendents\"."}</li>
                          <li>{t.movements.splitter.pendingPreProcessNextStep2 ?? "Podràs veure l'IBAN detectat."}</li>
                          <li>{t.movements.splitter.pendingPreProcessNextStep3 ?? "Podràs crear un donant o afegir l'IBAN a un existent."}</li>
                          <li>{t.movements.splitter.pendingPreProcessNextStep4 ?? "I clicar \"Reprocessar pendents\" per completar la remesa."}</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                </div>
              )}
                <div ref={tableContainerRef} className="max-h-[420px] overflow-auto rounded-md border">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide">
                          {isPaymentRemittance ? t.movements.splitter.beneficiary : t.movements.splitter.name}
                        </TableHead>
                        <TableHead className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide">{t.movements.splitter.taxId}</TableHead>
                        <TableHead className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide">IBAN</TableHead>
                        <TableHead className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-right">{t.movements.splitter.amount}</TableHead>
                        <TableHead className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide">{t.movements.splitter.status}</TableHead>
                        <TableHead className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide">{t.movements.splitter.inDatabase}</TableHead>
                        {/* CP només per mode IN (donants) */}
                        {!isPaymentRemittance && (
                          <TableHead className="w-[100px] px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide">{t.movements.splitter.zipCode}</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedDonations.map((donation, index) => (
                    <TableRow
                      key={index}
                      data-status={donation.status}
                      data-row-index={index}
                      className={
                        // P0: Colors segons estat
                        donation.status === 'found' ? 'bg-green-50/50' :
                        donation.status === 'found_inactive' ? 'bg-amber-50/50' :
                        donation.status === 'found_archived' ? 'bg-gray-50/50' :
                        donation.status === 'found_deleted' ? 'bg-red-50/30' :
                        donation.status === 'ambiguous_iban' ? 'bg-red-100/50' :
                        donation.status === 'no_iban_match' ? 'bg-orange-50/50' :
                        donation.status === 'new_with_taxid' ? 'bg-blue-50/50' :
                        'bg-orange-50/50'
                      }
                    >
                      <TableCell className="px-2 py-1.5 text-xs font-medium">{donation.name || '-'}</TableCell>
                      <TableCell className="px-2 py-1.5 font-mono text-xs">
                        {donation.taxIdValid ? (
                          <span className="text-green-700" title={`${donation.taxIdType}: ${donation.taxId}`}>
                            {donation.taxId}
                            <span className="ml-1 text-[10px] text-green-600">({donation.taxIdType})</span>
                          </span>
                        ) : donation.idCandidate ? (
                          <span className="text-orange-600" title={t.movements?.splitter?.nonFiscalIdLabel ?? 'ID no fiscal'}>
                            {donation.idCandidate}
                            <span className="ml-1 text-[10px] text-orange-500">(ref)</span>
                          </span>
                        ) : '-'}
                      </TableCell>
                      {/* IBAN - P0: SEMPRE visible, criteri principal per mode IN */}
                      <TableCell className="px-2 py-1.5 font-mono text-xs">
                        {donation.iban ? (
                          <span className={
                            // P0: Color segons estat de matching IBAN
                            donation.status === 'found' || donation.status === 'found_inactive' ||
                            donation.status === 'found_archived' || donation.status === 'found_deleted'
                              ? 'text-green-700 font-medium' // Match IBAN
                              : donation.status === 'ambiguous_iban'
                              ? 'text-red-700 font-bold' // IBAN duplicat
                              : donation.status === 'no_iban_match'
                              ? 'text-orange-700 font-medium' // IBAN no trobat
                              : 'text-muted-foreground'
                          }>
                            {donation.iban.replace(/(.{4})/g, '$1 ').trim().slice(0, 19)}···
                          </span>
                        ) : (
                          <span className="text-orange-600 italic">{tr('movements.splitter.withoutIbanLabel', 'sense IBAN')}</span>
                        )}
                      </TableCell>
                      <TableCell className="px-2 py-1.5 text-right text-xs font-mono whitespace-nowrap tabular-nums">
                        {formatCurrencyEU(donation.amount)}
                      </TableCell>
                      <TableCell className="px-2 py-1.5 text-xs">
                        {/* P0: Columna Estat amb nous badges */}
                        {donation.status === 'found' && (
                          <Badge variant="outline" className="text-[11px] px-2 py-0.5 bg-green-100 text-green-800 border-green-300">
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            {tr('movements.splitter.foundByIbanLabel', 'Trobat per IBAN')}
                          </Badge>
                        )}
                        {donation.status === 'found_inactive' && (
                          <Badge variant="outline" className="text-[11px] px-2 py-0.5 bg-amber-100 text-amber-800 border-amber-300">
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            {tr('movements.splitter.inactiveLabel', 'Baixa')}
                          </Badge>
                        )}
                        {donation.status === 'found_archived' && (
                          <Badge variant="outline" className="text-[11px] px-2 py-0.5 bg-gray-100 text-gray-800 border-gray-300">
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            {tr('movements.splitter.archivedLabel', 'Arxivat')}
                          </Badge>
                        )}
                        {donation.status === 'found_deleted' && (
                          <Badge variant="outline" className="text-[11px] px-2 py-0.5 bg-red-100 text-red-800 border-red-300">
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            {tr('movements.splitter.deletedLabel', 'Eliminat')}
                          </Badge>
                        )}
                        {donation.status === 'ambiguous_iban' && (
                          <Badge variant="outline" className="text-[11px] px-2 py-0.5 bg-red-100 text-red-800 border-red-300">
                            <AlertCircle className="mr-1 h-3 w-3" />
                            {tr('movements.splitter.ambiguousIbanLabel', 'IBAN ambigu')}
                          </Badge>
                        )}
                        {donation.status === 'no_iban_match' && (
                          <Badge variant="outline" className="text-[11px] px-2 py-0.5 bg-orange-100 text-orange-800 border-orange-300">
                            <AlertCircle className="mr-1 h-3 w-3" />
                            {tr('movements.splitter.noIbanMatchLabel', 'IBAN no trobat')}
                          </Badge>
                        )}
                        {/* Mode OUT legacy */}
                        {donation.status === 'new_with_taxid' && (
                          <Badge variant="outline" className="text-[11px] px-2 py-0.5 bg-blue-100 text-blue-800 border-blue-300">
                            <UserPlus className="mr-1 h-3 w-3" />
                            {t.movements.splitter.newValidTaxIdLabel ?? `Nou (${donation.taxIdType} vàlid)`}
                          </Badge>
                        )}
                        {donation.status === 'new_without_taxid' && (
                          <Badge variant="outline" className="text-[11px] px-2 py-0.5 bg-orange-100 text-orange-800 border-orange-300">
                            <AlertCircle className="mr-1 h-3 w-3" />
                            {donation.idCandidate
                              ? (t.movements.splitter.nonFiscalIdLabel ?? 'ID no fiscal')
                              : t.movements.splitter.withoutTaxIdBadge}
                          </Badge>
                        )}
                      </TableCell>
                      {/* P0: Columna Nota explicativa */}
                      <TableCell className="px-2 py-1.5 text-xs">
                        {/* Donant trobat (qualsevol estat) */}
                        {donation.matchedDonor ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className={
                                donation.status === 'found' ? 'text-green-700' :
                                donation.status === 'found_inactive' ? 'text-amber-700' :
                                donation.status === 'found_archived' ? 'text-gray-700' :
                                donation.status === 'found_deleted' ? 'text-red-700' :
                                'text-green-700'
                              }>
                                {donation.matchedDonor.name}
                              </span>
                              {/* Badge traçabilitat IBAN */}
                              {donation.matchMethod === 'iban' && donation.matchValueMasked && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 text-green-600 border-green-300">
                                  IBAN {donation.matchValueMasked}
                                </Badge>
                              )}
                            </div>
                            {/* Nota segons estat */}
                            {donation.matchNote && (
                              <div className="text-[11px] text-muted-foreground italic">
                                {donation.matchNote}
                              </div>
                            )}
                            {/* Badge tipus de contacte per mode OUT */}
                            {isPaymentRemittance && donation.matchedContactType && (
                              <Badge variant="secondary" className="text-xs px-1.5 py-0">
                                {donation.matchedContactType === 'supplier'
                                  ? t.movements.splitter.supplierBadge
                                  : donation.matchedContactType === 'employee'
                                  ? t.movements.splitter.employeeBadge
                                  : ''}
                              </Badge>
                            )}
                          </div>
                        ) : donation.status === 'ambiguous_iban' ? (
                          /* IBAN ambigu: selector per resoldre */
                          <div className="space-y-2">
                            {donation.manualMatchContactId ? (
                              /* Ja resolt: mostrar qui amb DNI */
                              <div className="space-y-1">
                                {(() => {
                                  const selectedDonor = donation.ambiguousDonors?.find(d => d.id === donation.manualMatchContactId);
                                  return (
                                    <div className="flex items-center gap-2">
                                      <div>
                                        <span className="text-green-700 font-medium block">
                                          {selectedDonor?.name || t.movements.splitter.ambiguousResolved}
                                        </span>
                                        {selectedDonor?.taxId && (
                                          <span className="text-[11px] text-green-600">
                                            DNI: {selectedDonor.taxId}
                                          </span>
                                        )}
                                      </div>
                                      <Badge variant="outline" className="text-[10px] px-1 py-0 text-green-600 border-green-300">
                                        {t.movements.splitter.ambiguousManualSelection}
                                      </Badge>
                                    </div>
                                  );
                                })()}
                                <button
                                  type="button"
                                  onClick={() => handleAssignDonorToLine(donation.rowIndex, '')}
                                  className="text-[11px] text-muted-foreground hover:underline"
                                >
                                  {t.movements.splitter.ambiguousChangeSelection}
                                </button>
                              </div>
                            ) : (
                              /* Pendent: mostrar selector amb DNI */
                              <>
                                <div className="flex items-center gap-2">
                                  <span className="text-amber-600 font-medium">
                                    {t.movements.splitter.ambiguousIbanTitle(donation.ambiguousDonors?.length ?? 0)}
                                  </span>
                                  <span className="text-[11px] text-muted-foreground">
                                    {t.movements.splitter.ambiguousIbanSubtitle}
                                  </span>
                                </div>
                                {/* Microcopy explicatiu */}
                                <div className="text-[11px] text-muted-foreground italic">
                                  {t.movements.splitter.ambiguousIbanHelp}
                                </div>
                                {/* IBAN complet per diagnòstic */}
                                {donation.iban && (
                                  <div className="flex items-center gap-1.5">
                                    <code className="text-xs font-mono text-foreground bg-muted px-1.5 py-0.5 rounded">
                                      {formatIBANDisplay(donation.iban)}
                                    </code>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard.writeText(normalizeIBAN(donation.iban));
                                        toast({ description: t.movements.splitter.ibanCopied });
                                      }}
                                      className="p-0.5 hover:bg-muted rounded"
                                      title="Copiar IBAN"
                                    >
                                      <Copy className="h-3 w-3 text-muted-foreground" />
                                    </button>
                                  </div>
                                )}
                                {/* Selector de donant amb DNI */}
                                {donation.ambiguousDonors && donation.ambiguousDonors.length > 0 && (
                                  <div className="flex flex-col gap-1.5">
                                    <span className="text-[11px] text-muted-foreground">
                                      {t.movements.splitter.ambiguousAssignTo}
                                    </span>
                                    <div className="flex flex-col gap-1">
                                      {donation.ambiguousDonors.map(donor => (
                                        <button
                                          key={donor.id}
                                          type="button"
                                          onClick={() => handleAssignDonorToLine(donation.rowIndex, donor.id)}
                                          className="px-3 py-2 text-left bg-primary/5 hover:bg-primary/10 text-primary rounded border border-primary/20 transition-colors"
                                        >
                                          <span className="font-medium block">{donor.name}</span>
                                          {donor.taxId && (
                                            <span className="text-[11px] text-primary/70">DNI: {donor.taxId}</span>
                                          )}
                                        </button>
                                      ))}
                                    </div>
                                    {/* Botó per assignar tot el grup */}
                                    {(ambiguousIbanGroups.find(g => g.ibanKey === normalizeIBAN(donation.iban))?.indices.length ?? 0) > 1 && (
                                      <div className="mt-1.5 pt-1.5 border-t border-dashed">
                                        <span className="text-[10px] text-muted-foreground block mb-1">
                                          {t.movements.splitter.ambiguousAssignAllLabel}
                                        </span>
                                        <div className="flex flex-col gap-1">
                                          {donation.ambiguousDonors.map(donor => (
                                            <button
                                              key={`group-${donor.id}`}
                                              type="button"
                                              onClick={() => handleAssignDonorToGroup(normalizeIBAN(donation.iban), donor.id)}
                                              className="px-2 py-1 text-left text-[11px] bg-amber-50 hover:bg-amber-100 text-amber-800 rounded border border-amber-200 transition-colors"
                                            >
                                              {t.movements.splitter.ambiguousAssignAllTo(
                                                donor.name,
                                                donor.taxId ? `DNI ${donor.taxId}` : ''
                                              )}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        ) : donation.status === 'no_iban_match' ? (
                          /* IBAN no trobat: accions per resoldre */
                          <div className="space-y-2">
                            {donation.manualMatchContactId ? (
                              /* Ja assignat manualment */
                              <div className="space-y-1">
                                {(() => {
                                  const assignedDonor = existingDonors.find(d => d.id === donation.manualMatchContactId);
                                  return (
                                    <div className="flex items-center gap-2">
                                      <div>
                                        <span className="text-green-700 font-medium block">
                                          {t.movements.splitter.ibanNotFoundAssignedTo(assignedDonor?.name || '')}
                                        </span>
                                        {assignedDonor?.taxId && (
                                          <span className="text-[11px] text-green-600">
                                            DNI: {assignedDonor.taxId}
                                          </span>
                                        )}
                                      </div>
                                      <Badge variant="outline" className="text-[10px] px-1 py-0 text-green-600 border-green-300">
                                        {t.movements.splitter.ambiguousManualSelection}
                                      </Badge>
                                    </div>
                                  );
                                })()}
                                <button
                                  type="button"
                                  onClick={() => handleAssignDonorToLine(donation.rowIndex, '')}
                                  className="text-[11px] text-muted-foreground hover:underline"
                                >
                                  {t.movements.splitter.ambiguousChangeSelection}
                                </button>
                              </div>
                            ) : (
                              /* Pendent: mostrar opcions */
                              <>
                                <div className="flex items-center gap-2">
                                  <span className="text-orange-600 font-medium">
                                    {t.movements.splitter.ibanNotFoundTitle}
                                  </span>
                                </div>
                                {/* Microcopy explicatiu */}
                                <div className="text-[11px] text-muted-foreground italic">
                                  {t.movements.splitter.ibanNotFoundHelp}
                                </div>
                                {/* IBAN complet per diagnòstic */}
                                {donation.iban && (
                                  <div className="flex items-center gap-1.5">
                                    <code className="text-xs font-mono text-foreground bg-muted px-1.5 py-0.5 rounded">
                                      {formatIBANDisplay(donation.iban)}
                                    </code>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard.writeText(normalizeIBAN(donation.iban));
                                        toast({ description: t.movements.splitter.ibanCopied });
                                      }}
                                      className="p-0.5 hover:bg-muted rounded"
                                      title="Copiar IBAN"
                                    >
                                      <Copy className="h-3 w-3 text-muted-foreground" />
                                    </button>
                                  </div>
                                )}
                                {/* Suggeriment per DNI si existeix */}
                                {donation.suggestedDonorByTaxId && (
                                  <div className="p-2 bg-blue-50 rounded border border-blue-200">
                                    <div className="text-[11px] text-blue-700 mb-1.5">
                                      {t.movements.splitter.ibanNotFoundSuggestedByTaxId(
                                        donation.suggestedDonorByTaxId.name,
                                        donation.suggestedDonorByTaxId.taxId || ''
                                      )}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleAssignDonorToLine(donation.rowIndex, donation.suggestedDonorByTaxId!.id)}
                                      className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                                    >
                                      {t.movements.splitter.ibanNotFoundAssignSuggested}
                                    </button>
                                  </div>
                                )}
                                {/* Accions */}
                                <div className="flex flex-wrap gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setShowDonorSelectorForRow(donation.rowIndex)}
                                    className="px-2 py-1 text-[11px] bg-primary/10 hover:bg-primary/20 text-primary rounded border border-primary/30 transition-colors"
                                  >
                                    {t.movements.splitter.ibanNotFoundAssignExisting}
                                  </button>
                                  <span className="text-[10px] text-muted-foreground self-center">
                                    {t.movements.splitter.ibanNotFoundLeavePending}
                                  </span>
                                </div>
                                {/* Selector de donant expandit */}
                                {showDonorSelectorForRow === donation.rowIndex && (
                                  <div className="mt-2 p-2 bg-muted/50 rounded border">
                                    <div className="text-[11px] text-muted-foreground mb-2">
                                      {t.movements.splitter.ibanNotFoundSelectDonor}
                                    </div>
                                    <Input
                                      placeholder="Cerca per nom o DNI..."
                                      value={donorSearchTerm}
                                      onChange={(e) => setDonorSearchTerm(e.target.value)}
                                      className="mb-2 h-7 text-xs"
                                      autoFocus
                                    />
                                    <div className="max-h-32 overflow-y-auto space-y-1">
                                      {existingDonors
                                        .filter(d => {
                                          if (!donorSearchTerm.trim()) return true;
                                          const search = normalizeForMatching(donorSearchTerm);
                                          return normalizeForMatching(d.name).includes(search) ||
                                                 normalizeForMatching(d.taxId ?? '').includes(search);
                                        })
                                        .slice(0, 50)
                                        .map(donor => (
                                          <button
                                            key={donor.id}
                                            type="button"
                                            onClick={() => {
                                              handleAssignDonorToLine(donation.rowIndex, donor.id);
                                              setShowDonorSelectorForRow(null);
                                              setDonorSearchTerm('');
                                            }}
                                            className="w-full px-2 py-1.5 text-left text-[11px] bg-white hover:bg-primary/5 rounded border transition-colors"
                                          >
                                            <span className="font-medium block">{donor.name}</span>
                                            {donor.taxId && (
                                              <span className="text-muted-foreground">DNI: {donor.taxId}</span>
                                            )}
                                          </button>
                                        ))}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setShowDonorSelectorForRow(null);
                                        setDonorSearchTerm('');
                                      }}
                                      className="mt-2 text-[10px] text-muted-foreground hover:underline"
                                    >
                                      {t.common.cancel}
                                    </button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        ) : donation.status === 'new_with_taxid' ? (
                          /* Mode OUT: nou amb taxId */
                          <div className="space-y-0.5">
                            <span className="text-blue-600 font-medium">
                              {isPaymentRemittance
                                ? t.movements.splitter.createSupplier
                                : t.movements.splitter.willBeCreated}
                            </span>
                            <div className="text-[11px] text-blue-500">
                              {donation.name} · {donation.taxIdType}: {donation.taxId}
                            </div>
                            {renderPaymentManualMatchControl(donation)}
                          </div>
                        ) : (
                          /* Mode OUT: sense taxId */
                          <div className="space-y-0.5">
                            <span className="text-orange-600 italic">{t.movements.splitter.willBePendingLabel ?? 'Quedarà pendent'}</span>
                            <div className="text-[11px] text-orange-500">
                              {donation.idCandidate
                                ? (t.movements.splitter.nonFiscalIdReason ?? 'ID no és DNI/CIF vàlid')
                                : (t.movements.splitter.noTaxIdReason ?? 'Sense identificador fiscal')}
                            </div>
                            {renderPaymentManualMatchControl(donation)}
                          </div>
                        )}
                      </TableCell>
                      {/* CP només per mode IN (donants) i només per nous amb taxId */}
                      {!isPaymentRemittance && (
                        <TableCell className="px-2 py-1.5 text-xs">
                          {donation.status === 'new_with_taxid' && (
                            <Input
                              value={donation.zipCode}
                              onChange={(e) => handleZipCodeChange(index, e.target.value)}
                              className="w-20 h-7 text-xs"
                              placeholder={t.movements.splitter.zipCode}
                            />
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>

            <div className="shrink-0 border-t px-6 py-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">
                  {isPaymentRemittance
                    ? t.movements.splitter.paymentsActionSummary(stats.toCreate, parsedDonations.length)
                    : t.movements.splitter.actionSummary(stats.toCreate, parsedDonations.length)}
                </span>
                {!canProcess && blockReason ? (
                  <span className="text-sm text-muted-foreground">{blockReason}</span>
                ) : null}
              </div>
              <DialogFooter className="gap-2 sm:justify-between sm:space-x-0">
                <Button variant="outline" onClick={() => setStep('mapping')}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {t.movements.splitter.backToMapping}
                </Button>
                <Button
                  onClick={handleProcess}
                  disabled={isProcessing || !canProcess}
                  title={blockReason || undefined}
                >
                  {isProcessing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {isPaymentRemittance
                    ? t.movements.splitter.processPayments(parsedDonations.length)
                    : t.movements.splitter.processDonations(parsedDonations.length)}
                </Button>
              </DialogFooter>
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            STEP 4: PROCESSING
            ═══════════════════════════════════════════════════════════════════ */}
        {step === 'processing' && (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-lg font-medium">{t.movements.splitter.processingRemittance}</p>
            <p className="text-sm text-muted-foreground">
              {t.movements.splitter.creatingDonorsAndTransactions(stats.toCreate, parsedDonations.length)}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
