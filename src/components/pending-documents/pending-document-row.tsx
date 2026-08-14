'use client';

import * as React from 'react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTranslations, type TranslationsContextType } from '@/i18n';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Calendar } from '@/components/ui/calendar';
import {
  Check,
  AlertCircle,
  FileText,
  ExternalLink,
  CalendarIcon,
  ChevronsUpDown,
  Sparkles,
  Loader2,
  Archive,
  RotateCcw,
  MoreHorizontal,
  ArrowUpRight,
  Link2,
  RefreshCw,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { format, parseISO, isValid } from 'date-fns';
import { ca } from 'date-fns/locale';
import { getDownloadURL, ref } from 'firebase/storage';
import { useFirebase } from '@/firebase';
import type { PendingDocument, PendingDocumentStatus } from '@/lib/pending-documents/types';
import type { Contact, Category } from '@/lib/data';
import { isDocumentReadyToConfirm, getMissingFields, getEditableFields } from '@/lib/pending-documents/api';
import { formatCurrencyEU } from '@/lib/normalize';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface PendingDocumentRowProps {
  doc: PendingDocument;
  contacts: Contact[];
  categories: Category[];
  canOperate?: boolean;
  canMatch?: boolean;
  onUpdate: (docId: string, field: string, value: string | number | null) => void;
  onConfirm: (doc: PendingDocument) => void;
  onArchive: (doc: PendingDocument) => void;
  onRestore: (doc: PendingDocument) => void;
  isConfirming?: boolean;
  isArchiving?: boolean;
  /** Base path for navigation to matched transaction */
  movimentsPath?: string;
  /** Selection mode */
  isSelectable?: boolean;
  isSelected?: boolean;
  onSelect?: (docId: string, selected: boolean) => void;
  /** Reconciliation */
  onReconcile?: (doc: PendingDocument) => void;
  /** Re-link document to matched transaction */
  onRelinkDocument?: (doc: PendingDocument) => void;
  isRelinking?: boolean;
  /** Delete matched document (undo reconciliation) */
  onDeleteMatched?: (doc: PendingDocument) => void;
  isDeletingMatched?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function getContactName(contactId: string | null, contacts: Contact[]): string {
  if (!contactId) return '';
  const contact = contacts.find(c => c.id === contactId);
  return contact?.name || '';
}

// ═══════════════════════════════════════════════════════════════════════════
// STATUS BADGE
// ═══════════════════════════════════════════════════════════════════════════

function StatusBadge({ status, t }: { status: PendingDocumentStatus; t: TranslationsContextType['t'] }) {
  switch (status) {
    case 'draft':
      return (
        <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
          {t.pendingDocs.statuses.draft}
        </Badge>
      );
    case 'confirmed':
      return (
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
          {t.pendingDocs.statuses.confirmed}
        </Badge>
      );
    case 'sepa_generated':
      return (
        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
          {t.pendingDocs.statuses.sepaGenerated}
        </Badge>
      );
    case 'matched':
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          {t.pendingDocs.statuses.matched}
        </Badge>
      );
    case 'archived':
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
          {t.pendingDocs.statuses.archived}
        </Badge>
      );
    default:
      return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function PendingDocumentRow({
  doc,
  contacts,
  categories,
  canOperate = false,
  canMatch = false,
  onUpdate,
  onConfirm,
  onArchive,
  onRestore,
  isConfirming = false,
  isArchiving = false,
  movimentsPath,
  isSelectable = false,
  isSelected = false,
  onSelect,
  onReconcile,
  onRelinkDocument,
  isRelinking = false,
  onDeleteMatched,
  isDeletingMatched = false,
}: PendingDocumentRowProps) {
  const { storage } = useFirebase();
  const { t } = useTranslations();
  const categoryTranslations = t.categories as Record<string, string>;

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return '';
    const category = categories.find(c => c.id === categoryId);
    if (!category) return '';
    return categoryTranslations[category.name] ?? category.name;
  };

  const [fileUrl, setFileUrl] = React.useState<string | null>(null);
  const [isLoadingUrl, setIsLoadingUrl] = React.useState(false);

  // Comboboxes open state
  const [supplierOpen, setSupplierOpen] = React.useState(false);
  const [categoryOpen, setCategoryOpen] = React.useState(false);
  const [dateOpen, setDateOpen] = React.useState(false);

  // Local state for text inputs (debounced)
  const [localAmount, setLocalAmount] = React.useState(doc.amount?.toString() || '');
  const [localInvoiceNumber, setLocalInvoiceNumber] = React.useState(doc.invoiceNumber || '');

  // Update local state when doc changes
  React.useEffect(() => {
    setLocalAmount(doc.amount?.toString() || '');
  }, [doc.amount]);

  React.useEffect(() => {
    setLocalInvoiceNumber(doc.invoiceNumber || '');
  }, [doc.invoiceNumber]);

  // Debounced update for text fields
  const debouncedUpdateRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleTextChange = React.useCallback((field: string, value: string) => {
    if (!canOperate) return;

    if (debouncedUpdateRef.current) {
      clearTimeout(debouncedUpdateRef.current);
    }

    debouncedUpdateRef.current = setTimeout(() => {
      if (field === 'amount') {
        const numValue = parseFloat(value.replace(',', '.'));
        onUpdate(doc.id, field, isNaN(numValue) ? null : numValue);
      } else {
        onUpdate(doc.id, field, value.trim() || null);
      }
    }, 500);
  }, [canOperate, doc.id, onUpdate]);

  // Cleanup debounce on unmount
  React.useEffect(() => {
    return () => {
      if (debouncedUpdateRef.current) {
        clearTimeout(debouncedUpdateRef.current);
      }
    };
  }, []);

  // Get file URL on demand
  const handleOpenFile = React.useCallback(async () => {
    if (fileUrl) {
      window.open(fileUrl, '_blank');
      return;
    }

    if (!storage || isLoadingUrl) return;

    setIsLoadingUrl(true);
    try {
      const storageRef = ref(storage, doc.file.storagePath);
      const url = await getDownloadURL(storageRef);
      setFileUrl(url);
      window.open(url, '_blank');
    } catch (error) {
      console.error('Error getting file URL:', error);
    } finally {
      setIsLoadingUrl(false);
    }
  }, [storage, doc.file.storagePath, fileUrl, isLoadingUrl]);

  // Determinar quins camps són editables segons l'estat
  const editability = getEditableFields(doc.status);
  const isEditable = canOperate && editability.allEditable;
  const canEditCategory = canOperate && editability.editableFields.includes('categoryId');
  const isReady = isDocumentReadyToConfirm(doc);
  const missingFields = getMissingFields(doc);

  // Filter suppliers (contacts with type 'supplier' or role supplier)
  const suppliers = React.useMemo(() =>
    contacts.filter(c => c.type === 'supplier' || c.roles?.supplier),
    [contacts]
  );

  // Filter expense categories
  const expenseCategories = React.useMemo(() =>
    categories.filter(c => c.type === 'expense'),
    [categories]
  );

  // Parse date for calendar
  const invoiceDate = doc.invoiceDate ? parseISO(doc.invoiceDate) : undefined;
  const validInvoiceDate = invoiceDate && isValid(invoiceDate) ? invoiceDate : undefined;

  // Has AI extraction with evidence
  const hasEvidence = doc.extracted?.source === 'ai' && doc.extracted.evidence;
  const confidence = doc.extracted?.confidence;

  return (
    <TableRow className={cn(!isReady && isEditable && 'bg-amber-50/30', isSelected && 'bg-primary/5')}>
      {/* Checkbox de selecció */}
      {isSelectable && (
        <TableCell className="w-[40px] pr-0">
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => onSelect?.(doc.id, !!checked)}
            aria-label={`Seleccionar ${doc.invoiceNumber || doc.file.filename}`}
          />
        </TableCell>
      )}

      {/* Fitxer */}
      <TableCell>
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <button
            onClick={handleOpenFile}
            className="text-sm font-medium truncate max-w-[150px] hover:underline text-left"
            title={doc.file.filename}
          >
            {doc.file.filename}
          </button>
          {isLoadingUrl ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <ExternalLink className="h-3 w-3 text-muted-foreground" />
          )}
          {hasEvidence && (
            <Tooltip>
              <TooltipTrigger>
                <Sparkles className={cn(
                  'h-3 w-3',
                  confidence === 'high' ? 'text-green-500' :
                  confidence === 'medium' ? 'text-amber-500' : 'text-red-500'
                )} />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs font-medium mb-1">{t.pendingDocs.extraction.aiExtracted} ({confidence})</p>
                {doc.extracted?.evidence?.invoiceNumber && (
                  <p className="text-xs text-muted-foreground">{t.pendingDocs.extraction.evidenceInvoice}: "{doc.extracted.evidence.invoiceNumber}"</p>
                )}
                {doc.extracted?.evidence?.amount && (
                  <p className="text-xs text-muted-foreground">{t.pendingDocs.extraction.evidenceAmount}: "{doc.extracted.evidence.amount}"</p>
                )}
                {doc.extracted?.evidence?.supplierName && (
                  <p className="text-xs text-muted-foreground">{t.pendingDocs.extraction.evidenceSupplier}: "{doc.extracted.evidence.supplierName}"</p>
                )}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </TableCell>

      {/* Import */}
      <TableCell className="text-right">
        {isEditable ? (
          <div className="flex items-center justify-end gap-1">
            <Input
              type="text"
              inputMode="decimal"
              value={localAmount}
              onChange={(e) => {
                setLocalAmount(e.target.value);
                handleTextChange('amount', e.target.value);
              }}
              placeholder="0.00"
              className={cn(
                'w-20 h-8 text-right text-sm',
                missingFields.includes('amount') && 'border-amber-400 bg-amber-50'
              )}
            />
            <span className="text-sm text-muted-foreground">€</span>
          </div>
        ) : (
          <span>{doc.amount !== null ? formatCurrencyEU(doc.amount) : '—'}</span>
        )}
      </TableCell>

      {/* Data */}
      <TableCell>
        {isEditable ? (
          <Popover open={dateOpen} onOpenChange={setDateOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  'w-[110px] justify-start text-left font-normal h-8',
                  !validInvoiceDate && 'text-muted-foreground',
                  missingFields.includes('invoiceDate') && 'border-amber-400 bg-amber-50'
                )}
              >
                <CalendarIcon className="mr-1 h-3 w-3" />
                {validInvoiceDate ? format(validInvoiceDate, 'dd/MM/yyyy') : 'Data'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={validInvoiceDate}
                onSelect={(date) => {
                  if (date) {
                    onUpdate(doc.id, 'invoiceDate', format(date, 'yyyy-MM-dd'));
                  }
                  setDateOpen(false);
                }}
                locale={ca}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        ) : (
          <span>{doc.invoiceDate || '—'}</span>
        )}
      </TableCell>

      {/* Tipus */}
      <TableCell>
        {isEditable ? (
          <Select
            value={doc.type}
            onValueChange={(value) => onUpdate(doc.id, 'type', value)}
          >
            <SelectTrigger className="w-[75px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="invoice">{t.pendingDocs.types.invoice}</SelectItem>
              <SelectItem value="payroll">{t.pendingDocs.types.payroll}</SelectItem>
              <SelectItem value="receipt">{t.pendingDocs.types.receipt}</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <Badge variant="outline" className="text-xs">
            {doc.type === 'invoice' ? t.pendingDocs.types.invoice : doc.type === 'payroll' ? t.pendingDocs.types.payroll : doc.type === 'receipt' ? t.pendingDocs.types.receipt : '?'}
          </Badge>
        )}
      </TableCell>

      {/* Nº factura */}
      <TableCell>
        {isEditable ? (
          <Input
            type="text"
            value={localInvoiceNumber}
            onChange={(e) => {
              setLocalInvoiceNumber(e.target.value);
              handleTextChange('invoiceNumber', e.target.value);
            }}
            placeholder="Nº"
            className={cn(
              'w-24 h-8 text-sm',
              missingFields.includes('invoiceNumber') && 'border-amber-400 bg-amber-50',
              doc.type === 'receipt' && 'opacity-50'
            )}
            disabled={doc.type === 'receipt'}
          />
        ) : (
          <span>{doc.invoiceNumber || '—'}</span>
        )}
      </TableCell>

      {/* Proveïdor (Combobox) */}
      <TableCell>
        {isEditable ? (
          <Popover open={supplierOpen} onOpenChange={setSupplierOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={supplierOpen}
                size="sm"
                className={cn(
                  'w-[140px] justify-between h-8 font-normal',
                  !doc.supplierId && 'text-muted-foreground',
                  missingFields.includes('supplierId') && 'border-amber-400 bg-amber-50'
                )}
              >
                <span className="truncate">
                  {doc.supplierId ? getContactName(doc.supplierId, contacts) : `${t.pendingDocs.filters.supplier}...`}
                </span>
                <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[250px] p-0" align="start">
              <Command>
                <CommandInput placeholder={`${t.pendingDocs.actions.search}...`} className="h-9" />
                <CommandList>
                  <CommandEmpty>{t.pendingDocs.filters.noSupplier}</CommandEmpty>
                  <CommandGroup>
                    {suppliers.map((supplier) => (
                      <CommandItem
                        key={supplier.id}
                        value={supplier.name}
                        onSelect={() => {
                          onUpdate(doc.id, 'supplierId', supplier.id);
                          setSupplierOpen(false);
                        }}
                      >
                        <div className="flex flex-col">
                          <span className="text-sm">{supplier.name}</span>
                          {(supplier.taxId || (supplier as any).iban) && (
                            <span className="text-xs text-muted-foreground">
                              {supplier.taxId}{(supplier as any).iban ? ` · ${(supplier as any).iban.slice(-8)}` : ''}
                            </span>
                          )}
                        </div>
                        <Check
                          className={cn(
                            'ml-auto h-4 w-4',
                            doc.supplierId === supplier.id ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        ) : (
          <span>{getContactName(doc.supplierId, contacts) || '—'}</span>
        )}
      </TableCell>

      {/* Categoria - editable per drafts i sepa_generated */}
      <TableCell>
        {canEditCategory ? (
          <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={categoryOpen}
                size="sm"
                className={cn(
                  'w-[120px] justify-between h-8 font-normal',
                  !doc.categoryId && 'text-muted-foreground',
                  missingFields.includes('categoryId') && 'border-amber-400 bg-amber-50'
                )}
              >
                <span className="truncate">
                  {doc.categoryId ? getCategoryName(doc.categoryId) : `${t.pendingDocs.filters.category}...`}
                </span>
                <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0" align="start">
              <Command>
                <CommandInput placeholder={`${t.pendingDocs.actions.search}...`} className="h-9" />
                <CommandList>
                  <CommandEmpty>{t.pendingDocs.filters.noCategory}</CommandEmpty>
                  <CommandGroup>
                    {expenseCategories.map((category) => (
                      <CommandItem
                        key={category.id}
                        value={categoryTranslations[category.name] || category.name}
                        onSelect={() => {
                          onUpdate(doc.id, 'categoryId', category.id);
                          setCategoryOpen(false);
                        }}
                      >
                        {categoryTranslations[category.name] || category.name}
                        <Check
                          className={cn(
                            'ml-auto h-4 w-4',
                            doc.categoryId === category.id ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        ) : (
          <span>{getCategoryName(doc.categoryId) || '—'}</span>
        )}
      </TableCell>

      {/* Estat */}
      <TableCell>
        <div className="flex items-center gap-1">
          <StatusBadge status={doc.status} t={t} />
          {/* Badge suggeriment */}
          {doc.suggestedTransactionIds && doc.suggestedTransactionIds.length > 0 && (
            <Badge
              variant="outline"
              className={cn(
                'bg-cyan-50 text-cyan-700 border-cyan-200',
                canMatch && onReconcile && 'cursor-pointer hover:bg-cyan-100'
              )}
              onClick={canMatch && onReconcile ? () => onReconcile(doc) : undefined}
            >
              <Link2 className="h-3 w-3 mr-1" />
              {t.pendingDocs.suggested}
            </Badge>
          )}
        </div>
      </TableCell>

      {/* Accions */}
      <TableCell>
        <div className="flex items-center gap-1">
          {/* Reconcile button when suggestions exist */}
          {canMatch && doc.suggestedTransactionIds && doc.suggestedTransactionIds.length > 0 && onReconcile && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onReconcile(doc)}
                  className="h-8 text-cyan-600 hover:text-cyan-700"
                >
                  <Link2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t.pendingDocs.suggestedTooltip}</TooltipContent>
            </Tooltip>
          )}

          {/* Confirm button for drafts */}
          {isEditable && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onConfirm(doc)}
                    disabled={!isReady || isConfirming}
                    className="h-8"
                  >
                    {isConfirming ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isReady ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                    )}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {isReady ? t.pendingDocs.actions.confirm : `${t.pendingDocs.missing}: ${missingFields.join(', ')}`}
              </TooltipContent>
            </Tooltip>
          )}

          {/* Dropdown menu with more actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {/* View file */}
              <DropdownMenuItem onClick={handleOpenFile}>
                <ExternalLink className="mr-2 h-4 w-4" />
                {t.pendingDocs.actions.viewFile}
              </DropdownMenuItem>

              {/* Link to matched transaction */}
              {doc.status === 'matched' && doc.matchedTransactionId && movimentsPath && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <a href={`${movimentsPath}?transaction=${doc.matchedTransactionId}`}>
                      <ArrowUpRight className="mr-2 h-4 w-4" />
                      {t.pendingDocs.actions.viewTransaction}
                    </a>
                  </DropdownMenuItem>
                </>
              )}

              {/* Re-link document: HIDDEN - funcionalitat obsoleta
              {canMatch && doc.status === 'matched' && doc.matchedTransactionId && onRelinkDocument && (
                <DropdownMenuItem
                  onClick={() => onRelinkDocument(doc)}
                  disabled={isRelinking}
                >
                  {isRelinking ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  {t.pendingDocs.actions.relinkDocument}
                </DropdownMenuItem>
              )}
              */}

              {/* Undo reconciliation without deleting files */}
              {canMatch && doc.status === 'matched' && onDeleteMatched && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDeleteMatched(doc)}
                    disabled={isDeletingMatched}
                  >
                    {isDeletingMatched ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="mr-2 h-4 w-4" />
                    )}
                    {t.pendingDocs.actions.unmatch}
                  </DropdownMenuItem>
                </>
              )}

              {/* Archive (for draft, confirmed, sepa_generated) */}
              {canOperate && (doc.status === 'draft' || doc.status === 'confirmed' || doc.status === 'sepa_generated') && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onArchive(doc)}
                    disabled={isArchiving}
                    className="text-amber-600"
                  >
                    {isArchiving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Archive className="mr-2 h-4 w-4" />
                    )}
                    {t.pendingDocs.actions.archive}
                  </DropdownMenuItem>
                </>
              )}

              {/* Restore (for archived) */}
              {canOperate && doc.status === 'archived' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onRestore(doc)}
                    disabled={isArchiving}
                  >
                    {isArchiving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="mr-2 h-4 w-4" />
                    )}
                    {t.pendingDocs.actions.restore}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  );
}
