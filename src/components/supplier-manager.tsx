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
import { PlusCircle, Edit, Trash2, Building2, Upload, Search, X, Factory, Download, MoreVertical } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import type { Supplier, Category } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { useCollection, useFirebase, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import { findExistingContact } from '@/lib/contact-matching';
import { collection, query, where } from 'firebase/firestore';
import { updateContactViaApi } from '@/services/contacts';
import { useCurrentOrganization } from '@/hooks/organization-provider';
import { SupplierImporter } from './supplier-importer';
import { useTranslations } from '@/i18n';
import { exportSuppliersToExcel } from '@/lib/suppliers-export';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { MobileListItem } from '@/components/mobile/mobile-list-item';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { MOBILE_ACTIONS_BAR, MOBILE_CTA_PRIMARY } from '@/lib/ui/mobile-actions';
import { filterValidSelectItems } from '@/lib/ui/safe-select-options';
import { CannotArchiveContactDialog } from '@/components/contacts/cannot-archive-contact-dialog';

type SupplierFormData = Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>;

const emptyFormData: SupplierFormData = {
  type: 'supplier',
  name: '',
  taxId: '',
  zipCode: '',
  category: undefined,
  address: '',
  email: '',
  phone: '',
  iban: '',
  paymentTerms: '',
  notes: '',
  defaultCategoryId: undefined,
};

export function SupplierManager() {
  const { firestore, auth, user } = useFirebase();
  const { organizationId } = useCurrentOrganization();
  const { toast } = useToast();
  const { t, tr } = useTranslations();
  const isMobile = useIsMobile();

  const contactsCollection = useMemoFirebase(
    () => organizationId ? collection(firestore, 'organizations', organizationId, 'contacts') : null,
    [firestore, organizationId]
  );

  const suppliersQuery = useMemoFirebase(
    () => contactsCollection ? query(contactsCollection, where('type', '==', 'supplier')) : null,
    [contactsCollection]
  );

  const { data: suppliersRaw } = useCollection<Supplier & { archivedAt?: string }>(suppliersQuery);
  // Filtrar proveïdors arxivats (soft-deleted)
  const suppliers = React.useMemo(
    () => suppliersRaw?.filter(s => !s.archivedAt),
    [suppliersRaw]
  );

  // Categories de despesa per al selector de categoria per defecte
  const categoriesCollection = useMemoFirebase(
    () => organizationId ? collection(firestore, 'organizations', organizationId, 'categories') : null,
    [firestore, organizationId]
  );
  const { data: allCategories } = useCollection<Category>(categoriesCollection);
  const expenseCategories = React.useMemo(
    () => filterValidSelectItems(
      allCategories?.filter(c => c.type === 'expense') || [],
      'supplier-manager.expenseCategories'
    ),
    [allCategories]
  );
  const categoryTranslations = t.categories as Record<string, string>;

  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isAlertOpen, setIsAlertOpen] = React.useState(false);
  const [isImportOpen, setIsImportOpen] = React.useState(false);
  const [editingSupplier, setEditingSupplier] = React.useState<Supplier | null>(null);
  const [supplierToDelete, setSupplierToDelete] = React.useState<Supplier | null>(null);
  const [formData, setFormData] = React.useState<SupplierFormData>(emptyFormData);

  // Cercador intel·ligent
  const [searchQuery, setSearchQuery] = React.useState('');

  // Filtrar proveïdors per cerca
  const filteredSuppliers = React.useMemo(() => {
    if (!suppliers) return [];
    if (!searchQuery.trim()) return suppliers;

    const query = searchQuery.toLowerCase().trim();
    return suppliers.filter(supplier => {
      const searchFields = [
        supplier.name,
        supplier.taxId,
        supplier.email,
        supplier.phone,
        supplier.zipCode,
        supplier.address,
      ].filter(Boolean).map(f => f!.toLowerCase());

      return searchFields.some(field => field.includes(query));
    });
  }, [suppliers, searchQuery]);

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      type: 'supplier',
      name: supplier.name,
      taxId: supplier.taxId,
      zipCode: supplier.zipCode,
      category: supplier.category,
      address: supplier.address || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      iban: supplier.iban || '',
      paymentTerms: supplier.paymentTerms || '',
      notes: supplier.notes || '',
      defaultCategoryId: supplier.defaultCategoryId,
    });
    setIsDialogOpen(true);
  };

  // Estat per modal informatiu "no es pot arxivar"
  const [cannotArchiveOpen, setCannotArchiveOpen] = React.useState(false);
  const [cannotArchiveActiveCount, setCannotArchiveActiveCount] = React.useState(0);
  const [cannotArchiveArchivedCount, setCannotArchiveArchivedCount] = React.useState(0);
  const [isCheckingArchive, setIsCheckingArchive] = React.useState(false);

  // Pre-check via API amb dryRun abans d'obrir modal
  const handleDeleteRequest = async (supplier: Supplier) => {
    if (!organizationId || !user) return;

    setSupplierToDelete(supplier);
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
          contactId: supplier.id,
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
          description: result.error || t.common.unknownError,
        });
        setSupplierToDelete(null);
      }
    } catch (err) {
      console.error('[SupplierManager] Error checking archive:', err);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: t.common.dbConnectionError,
      });
      setSupplierToDelete(null);
    } finally {
      setIsCheckingArchive(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ARXIVAT (v1.36): Flux via API-first per garantir integritat referencial
  // ═══════════════════════════════════════════════════════════════════════════
  const handleDeleteConfirm = async () => {
    if (!supplierToDelete || !organizationId || !user) {
      setIsAlertOpen(false);
      setSupplierToDelete(null);
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
          contactId: supplierToDelete.id,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: t.suppliers.supplierDeleted,
          description: t.suppliers.supplierDeletedDescription(supplierToDelete.name),
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
          description: result.error || t.common.unknownError,
        });
      }
    } catch (err) {
      console.error('[SupplierManager] Error arxivant contacte:', err);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: t.common.dbConnectionError,
      });
    }

    setIsAlertOpen(false);
    setSupplierToDelete(null);
  };

  const handleOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingSupplier(null);
      setFormData(emptyFormData);
    }
  };

  const handleAddNew = () => {
    setEditingSupplier(null);
    setFormData(emptyFormData);
    setIsDialogOpen(true);
  };

  const handleFormChange = (field: keyof SupplierFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!formData.name || !formData.taxId) {
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: t.suppliers.errorRequiredFields
      });
      return;
    }

    if (!contactsCollection) {
      toast({ variant: 'destructive', title: t.common.error, description: t.common.dbConnectionError });
      return;
    }

    const now = new Date().toISOString();
    const dataToSave = {
      ...formData,
      category: formData.category || null,
      address: formData.address || null,
      email: formData.email || null,
      phone: formData.phone || null,
      iban: formData.iban || null,
      paymentTerms: formData.paymentTerms || null,
      notes: formData.notes || null,
      zipCode: formData.zipCode || '',
      defaultCategoryId: formData.defaultCategoryId || null,
      updatedAt: now,
    };

    if (editingSupplier) {
      // Update via Admin API (bypass archived field guardrails)
      try {
        await updateContactViaApi({
          orgId: organizationId!,
          docId: editingSupplier.id,
          data: dataToSave,
          auth,
        });
        toast({ title: t.suppliers.supplierUpdated, description: t.suppliers.supplierUpdatedDescription(formData.name) });
      } catch (err) {
        toast({
          variant: 'destructive',
          title: t.common.error,
          description: err instanceof Error ? err.message : t.common.unknownError,
        });
        return;
      }
    } else {
      // Validar si ja existeix un contacte amb el mateix NIF/IBAN/email
      const existingMatch = findExistingContact(
        suppliers as any[] || [],
        formData.taxId || undefined,
        formData.iban || undefined,
        formData.email || undefined
      );

      if (existingMatch.found && existingMatch.contact) {
        const existing = existingMatch.contact;
        toast({
          variant: 'destructive',
          title: tr('contacts.duplicateDetectedTitle'),
          description: tr('contacts.duplicateDetectedDescription')
            .replace('{name}', existing.name)
            .replace('{field}', existingMatch.matchedBy === 'taxId' ? 'NIF' : existingMatch.matchedBy === 'iban' ? 'IBAN' : 'email'),
          duration: 8000,
        });
        return;
      }

      addDocumentNonBlocking(contactsCollection, { ...dataToSave, roles: { supplier: true }, createdAt: now });
      toast({ title: t.suppliers.supplierCreated, description: t.suppliers.supplierCreatedDescription(formData.name) });
    }
    handleOpenChange(false);
  };

  const handleImportComplete = (count: number) => {
    // El toast ja es mostra dins del SupplierImporter
  };

  const dialogTitle = editingSupplier ? t.suppliers.editTitle : t.suppliers.addTitle;
  const dialogDescription = editingSupplier 
    ? t.suppliers.editDescription 
    : t.suppliers.addDescription;

  return (
    <>
      <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
        <Card>
          <CardHeader className={cn("flex flex-col gap-4", "sm:flex-row sm:items-center sm:justify-between")}>
            <div>
              <CardTitle className="text-2xl font-bold tracking-tight font-headline">
                {t.suppliers.title}
              </CardTitle>
              <CardDescription>
                {t.suppliers.description}
              </CardDescription>
            </div>
            <div className={cn(MOBILE_ACTIONS_BAR, "sm:justify-end")}>
              <DialogTrigger asChild>
                <Button onClick={handleAddNew} className={MOBILE_CTA_PRIMARY}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  {t.suppliers.add}
                </Button>
              </DialogTrigger>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={() => setIsImportOpen(true)} title={t.suppliers.import}>
                  <Upload className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => suppliers && suppliers.length > 0 && exportSuppliersToExcel(suppliers, expenseCategories, categoryTranslations)}
                  disabled={!suppliers || suppliers.length === 0}
                  title={tr('contacts.exportToExcel')}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Cercador intel·ligent */}
            <div className="mb-4">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t.suppliers.searchPlaceholder}
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
            </div>

            {/* Vista mòbil */}
            {isMobile ? (
              <div className="flex flex-col gap-2">
                {!suppliersRaw && (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={`skeleton-${i}`} className="border border-border/50 rounded-lg p-3">
                      <Skeleton className="h-4 w-32 mb-2" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  ))
                )}
                {filteredSuppliers.map((supplier) => (
                  <MobileListItem
                    key={supplier.id}
                    title={supplier.name}
                    leadingIcon={<Building2 className="h-4 w-4" />}
                    meta={[
                      { label: 'CIF', value: supplier.taxId },
                      ...(supplier.defaultCategoryId ? [{
                        value: (() => {
                          const cat = expenseCategories.find(c => c.id === supplier.defaultCategoryId);
                          return cat ? (categoryTranslations[cat.name] || cat.name) : '-';
                        })()
                      }] : []),
                      ...(supplier.email ? [{ value: supplier.email }] : []),
                    ]}
                    actions={
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(supplier)}>
                            <Edit className="mr-2 h-4 w-4" />
                            {t.suppliers.editSupplier ?? 'Editar'}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteRequest(supplier)}
                            className="text-rose-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {t.suppliers.deleteSupplier ?? 'Eliminar'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    }
                  />
                ))}
                {filteredSuppliers.length === 0 && (
                  <EmptyState
                    icon={searchQuery ? Search : Factory}
                    title={
                      searchQuery
                        ? (t.emptyStates?.suppliers?.noResults ?? t.suppliers.noSearchResults)
                        : (t.emptyStates?.suppliers?.noData ?? t.suppliers.noData)
                    }
                    description={
                      searchQuery
                        ? (t.emptyStates?.suppliers?.noResultsDesc ?? undefined)
                        : (t.emptyStates?.suppliers?.noDataDesc ?? undefined)
                    }
                    className="py-12"
                  />
                )}
              </div>
            ) : (
              /* Vista desktop (taula) */
              <div className="rounded-md border">
                <Table className="w-full table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.suppliers.name}</TableHead>
                      <TableHead>{t.suppliers.taxId}</TableHead>
                      <TableHead>{t.contacts.defaultCategory}</TableHead>
                      <TableHead>{t.suppliers.contactInfo}</TableHead>
                      <TableHead className="text-right">{t.suppliers.actions}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSuppliers.map((supplier) => (
                      <TableRow key={supplier.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            {supplier.name}
                          </div>
                        </TableCell>
                        <TableCell>{supplier.taxId}</TableCell>
                        <TableCell>
                          {supplier.defaultCategoryId ? (
                            <Badge variant="outline">
                              {(() => {
                                const cat = expenseCategories.find(c => c.id === supplier.defaultCategoryId);
                                return cat ? (categoryTranslations[cat.name] || cat.name) : '-';
                              })()}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {supplier.email && <div>{supplier.email}</div>}
                            {supplier.phone && <div className="text-muted-foreground">{supplier.phone}</div>}
                            {!supplier.email && !supplier.phone && <span className="text-muted-foreground">-</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted/40"
                            onClick={() => handleEdit(supplier)}
                            aria-label={t.suppliers.editSupplier ?? 'Editar proveïdor'}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            onClick={() => handleDeleteRequest(supplier)}
                            aria-label={t.suppliers.deleteSupplier ?? 'Eliminar proveïdor'}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredSuppliers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="p-0">
                          <EmptyState
                            icon={searchQuery ? Search : Factory}
                            title={
                              searchQuery
                                ? (t.emptyStates?.suppliers?.noResults ?? t.suppliers.noSearchResults)
                                : (t.emptyStates?.suppliers?.noData ?? t.suppliers.noData)
                            }
                            description={
                              searchQuery
                                ? (t.emptyStates?.suppliers?.noResultsDesc ?? undefined)
                                : (t.emptyStates?.suppliers?.noDataDesc ?? undefined)
                            }
                            className="border-0 rounded-none py-12"
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <DialogContent className="flex max-h-[min(92vh,960px)] !w-[min(calc(100vw-1.5rem),78rem)] !max-w-[78rem] flex-col overflow-hidden p-0 sm:!w-[min(calc(100vw-3rem),78rem)]">
          {/* Header fix */}
          <DialogHeader className="flex-shrink-0 border-b px-4 py-5 pr-10 sm:px-6">
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{dialogDescription}</DialogDescription>
          </DialogHeader>

          {/* Cos amb scroll si cal */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 sm:px-6">
            {/* ═══════════════════════════════════════════════════════════════════
                BLOC 1: Dades bàsiques i identificació (2 columnes)
                ═══════════════════════════════════════════════════════════════════ */}
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
              <div className="space-y-4 rounded-xl border bg-background p-4 shadow-sm">
              <h4 className="text-sm font-medium text-muted-foreground">{t.suppliers.basicData}</h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Columna esquerra: Identificació */}
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">{t.suppliers.name}<span className="ml-1 text-muted-foreground">*</span></Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleFormChange('name', e.target.value)}
                      placeholder={t.suppliers.namePlaceholder}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="taxId">{t.suppliers.taxId}<span className="ml-1 text-muted-foreground">*</span></Label>
                    <Input
                      id="taxId"
                      value={formData.taxId}
                      onChange={(e) => handleFormChange('taxId', e.target.value.toUpperCase())}
                      placeholder="B12345678"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t.form?.taxIdHelp ?? "8 dígits + lletra (DNI) o lletra + 7 dígits + lletra (NIE/CIF)."}
                    </p>
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
                        {expenseCategories.map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>{categoryTranslations[cat.name] || cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Columna dreta: Contacte */}
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="email">{t.suppliers.email}</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email || ''}
                      onChange={(e) => handleFormChange('email', e.target.value)}
                      placeholder="facturacio@empresa.com"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="phone">{t.suppliers.phone}</Label>
                    <Input
                      id="phone"
                      value={formData.phone || ''}
                      onChange={(e) => handleFormChange('phone', e.target.value)}
                      placeholder="934 000 000"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="zipCode">{t.suppliers.zipCode}</Label>
                    <Input
                      id="zipCode"
                      value={formData.zipCode}
                      onChange={(e) => handleFormChange('zipCode', e.target.value)}
                      placeholder="08001"
                    />
                  </div>
                </div>
              </div>

              {/* Adreça a tota amplada */}
              <div className="space-y-1.5">
                <Label htmlFor="address">{t.suppliers.address}</Label>
                <Input
                  id="address"
                  value={formData.address || ''}
                  onChange={(e) => handleFormChange('address', e.target.value)}
                  placeholder={t.suppliers.addressPlaceholder}
                />
              </div>
              </div>

              <div className="space-y-5">
                <div className="space-y-4 rounded-xl border bg-muted/10 p-4 shadow-sm">
                  <h4 className="text-sm font-medium text-muted-foreground">{t.suppliers.paymentData}</h4>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-1">
                    <div className="space-y-1.5">
                      <Label htmlFor="iban">{t.suppliers.iban}</Label>
                      <Input
                        id="iban"
                        value={formData.iban || ''}
                        onChange={(e) => handleFormChange('iban', e.target.value.toUpperCase().replace(/\s/g, ''))}
                        placeholder="ES00 0000 0000 0000 0000 0000"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="paymentTerms">{t.suppliers.paymentTerms}</Label>
                      <Input
                        id="paymentTerms"
                        value={formData.paymentTerms || ''}
                        onChange={(e) => handleFormChange('paymentTerms', e.target.value)}
                        placeholder={t.suppliers.paymentTermsPlaceholder}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border bg-muted/10 p-4 shadow-sm">
                  <h4 className="text-sm font-medium text-muted-foreground">{t.suppliers.notes}</h4>
                  <Textarea
                    id="notes"
                    value={formData.notes || ''}
                    onChange={(e) => handleFormChange('notes', e.target.value)}
                    placeholder={t.suppliers.notesPlaceholder}
                    rows={5}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer fix */}
          <DialogFooter className="flex-shrink-0 border-t bg-background px-4 py-4 sm:px-6">
            <DialogClose asChild>
              <Button variant="outline">{t.common.cancel}</Button>
            </DialogClose>
            <Button onClick={handleSave}>
              {editingSupplier ? t.suppliers.save : t.suppliers.add}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.suppliers.confirmDeleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.suppliers.confirmDeleteDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSupplierToDelete(null)}>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>{t.common.delete}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SupplierImporter
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        onImportComplete={handleImportComplete}
      />

      <CannotArchiveContactDialog
        open={cannotArchiveOpen}
        onOpenChange={(open) => {
          setCannotArchiveOpen(open);
          if (!open) setSupplierToDelete(null);
        }}
        contactName={supplierToDelete?.name || ''}
        activeCount={cannotArchiveActiveCount}
        archivedCount={cannotArchiveArchivedCount}
      />
    </>
  );
}
