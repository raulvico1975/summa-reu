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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Edit, Star, StarOff, Power, PowerOff, Loader2, Download, Upload, Building2, MoreVertical } from 'lucide-react';
import { useBankAccounts } from '@/hooks/use-bank-accounts';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from '@/i18n';
import { useCurrentOrganization } from '@/hooks/organization-provider';
import { useFirebase } from '@/firebase';
import type { BankAccount } from '@/lib/data';
import type { CreateBankAccountData, UpdateBankAccountData } from '@/lib/bank-accounts';
import { exportBankAccountsToExcel } from '@/lib/bank-accounts-export';
import { BankAccountImporter } from '@/components/bank-accounts/bank-account-importer';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { MobileListItem } from '@/components/mobile/mobile-list-item';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { MOBILE_ACTIONS_BAR, MOBILE_CTA_PRIMARY } from '@/lib/ui/mobile-actions';

interface FormData {
  name: string;
  iban: string;
  bankName: string;
  creditorId: string;
}

const EMPTY_FORM: FormData = {
  name: '',
  iban: '',
  bankName: '',
  creditorId: '',
};

export function BankAccountsManager() {
  const { userRole, organizationId } = useCurrentOrganization();
  const { t, tr, language } = useTranslations();
  const { toast } = useToast();
  const { user } = useFirebase();
  const isMobile = useIsMobile();
  const {
    bankAccounts,
    allBankAccounts,
    isLoading,
    create,
    update,
    setDefault,
    activate,
  } = useBankAccounts();

  const canEdit = userRole === 'admin';

  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingAccount, setEditingAccount] = React.useState<BankAccount | null>(null);
  const [formData, setFormData] = React.useState<FormData>(EMPTY_FORM);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isImportOpen, setIsImportOpen] = React.useState(false);

  // Mostrar també els inactius si hi ha
  const inactiveAccounts = React.useMemo(
    () => allBankAccounts.filter((acc) => acc.isActive === false),
    [allBankAccounts]
  );

  // Guardrail: detectar si només queda 1 compte actiu
  const isLastActiveAccount = bankAccounts.length === 1;

  const handleOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingAccount(null);
      setFormData(EMPTY_FORM);
    }
  };

  const handleAddNew = () => {
    setEditingAccount(null);
    setFormData(EMPTY_FORM);
    setIsDialogOpen(true);
  };

  const handleEdit = (account: BankAccount) => {
    setEditingAccount(account);
    setFormData({
      name: account.name,
      iban: account.iban ?? '',
      bankName: account.bankName ?? '',
      creditorId: account.creditorId ?? '',
    });
    setIsDialogOpen(true);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: t.settings.bankAccounts.errorNameEmpty,
      });
      return;
    }

    setIsSaving(true);

    try {
      if (editingAccount) {
        const updateData: UpdateBankAccountData = {
          name: formData.name.trim(),
          iban: formData.iban.trim() || null,
          bankName: formData.bankName.trim() || null,
          creditorId: formData.creditorId.trim() || null,
        };
        await update(editingAccount.id, updateData);
        toast({
          title: t.settings.bankAccounts.accountUpdated,
          description: t.settings.bankAccounts.accountUpdatedDescription(formData.name),
        });
      } else {
        const createData: CreateBankAccountData = {
          name: formData.name.trim(),
          iban: formData.iban.trim() || null,
          bankName: formData.bankName.trim() || null,
          creditorId: formData.creditorId.trim() || null,
          isDefault: bankAccounts.length === 0, // Primer compte és default
        };
        await create(createData);
        toast({
          title: t.settings.bankAccounts.accountCreated,
          description: t.settings.bankAccounts.accountCreatedDescription(formData.name),
        });
      }
      handleOpenChange(false);
    } catch (err) {
      console.error('[BankAccountsManager] Error saving:', err);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: t.common.dbConnectionError,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetDefault = async (account: BankAccount) => {
    try {
      await setDefault(account.id);
      toast({
        title: t.settings.bankAccounts.defaultSet,
        description: t.settings.bankAccounts.defaultSetDescription(account.name),
      });
    } catch (err) {
      console.error('[BankAccountsManager] Error setting default:', err);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: t.common.dbConnectionError,
      });
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ARXIVAT (v1.36): Flux via API-first
  // ═══════════════════════════════════════════════════════════════════════════

  const handleToggleActive = async (account: BankAccount) => {
    if (!user || !organizationId) return;

    try {
      if (account.isActive === false) {
        // Reactivar: via hook (Firestore client)
        await activate(account.id);
        toast({
          title: t.settings.bankAccounts.accountActivated,
          description: t.settings.bankAccounts.accountActivatedDescription(account.name),
        });
      } else {
        // Eliminar: via API-first
        const idToken = await user.getIdToken();
        const response = await fetch('/api/bank-accounts/archive', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            orgId: organizationId,
            bankAccountId: account.id,
          }),
        });

        const result = await response.json();

        if (result.success) {
          toast({
            title: t.settings.bankAccounts.accountDeactivated,
            description: t.settings.bankAccounts.accountDeactivatedDescription(account.name),
          });
        } else if (result.code === 'HAS_TRANSACTIONS') {
          toast({
            variant: 'destructive',
            title: t.settings.bankAccounts.cannotDeactivate,
            description: t.settings.bankAccounts.hasTransactionsError?.(result.transactionCount),
          });
        } else if (result.code === 'LAST_ACTIVE_ACCOUNT') {
          toast({
            variant: 'destructive',
            title: t.settings.bankAccounts.cannotDeactivate,
            description: t.settings.bankAccounts.cannotDeactivateLast,
          });
        } else {
          toast({
            variant: 'destructive',
            title: t.common.error,
            description: result.error || t.common.unknownError,
          });
        }
      }
    } catch (err) {
      console.error('[BankAccountsManager] Error toggling active:', err);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: t.common.dbConnectionError,
      });
    }
  };

  const dialogTitle = editingAccount
    ? t.settings.bankAccounts.editTitle
    : t.settings.bankAccounts.addTitle;
  const dialogDescription = editingAccount
    ? t.settings.bankAccounts.editDescription
    : t.settings.bankAccounts.addDescription;

  return (
    <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
      <Card>
        <CardHeader className={cn("flex flex-col gap-4", "sm:flex-row sm:items-center sm:justify-between")}>
          <div>
            <CardTitle>{t.settings.bankAccounts.title}</CardTitle>
            <CardDescription>{t.settings.bankAccounts.description}</CardDescription>
          </div>
          {canEdit && (
            <div className={cn(MOBILE_ACTIONS_BAR, "sm:justify-end")}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={handleAddNew} className={MOBILE_CTA_PRIMARY}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  {t.settings.bankAccounts.addAccount}
                </Button>
              </DialogTrigger>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setIsImportOpen(true)}
                  title={tr('settings.bankAccounts.importFromExcel')}
                >
                  <Upload className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => allBankAccounts.length > 0 && exportBankAccountsToExcel(allBankAccounts, undefined, language)}
                  disabled={allBankAccounts.length === 0}
                  title={tr('settings.bankAccounts.exportToExcel')}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            isMobile ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={`skeleton-${i}`} className="border border-border/50 rounded-lg p-3">
                    <Skeleton className="h-4 w-32 mb-2" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )
          ) : bankAccounts.length === 0 && inactiveAccounts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t.settings.bankAccounts.noAccounts}
            </div>
          ) : isMobile ? (
            /* Vista mòbil */
            <div className="flex flex-col gap-2">
              {/* Comptes actius */}
              {bankAccounts.map((account) => (
                <MobileListItem
                  key={account.id}
                  title={account.name}
                  leadingIcon={<Building2 className="h-4 w-4" />}
                  badges={[
                    account.isDefault && (
                      <Badge key="default" variant="secondary" className="text-xs">
                        {t.settings.bankAccounts.default}
                      </Badge>
                    ),
                    <Badge key="status" variant="default" className="text-xs">
                      {t.settings.bankAccounts.active}
                    </Badge>
                  ].filter(Boolean) as React.ReactNode[]}
                  meta={[
                    ...(account.iban ? [{ label: 'IBAN', value: account.iban }] : []),
                    ...(account.bankName ? [{ value: account.bankName }] : []),
                  ]}
                  actions={
                    canEdit ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(account)}>
                            <Edit className="mr-2 h-4 w-4" />
                            {t.common.edit}
                          </DropdownMenuItem>
                          {!account.isDefault && (
                            <DropdownMenuItem onClick={() => handleSetDefault(account)}>
                              <Star className="mr-2 h-4 w-4" />
                              {t.settings.bankAccounts.setAsDefault}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleToggleActive(account)}
                            disabled={isLastActiveAccount}
                            className="text-orange-600"
                          >
                            <PowerOff className="mr-2 h-4 w-4" />
                            {t.settings.bankAccounts.deactivate}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : undefined
                  }
                />
              ))}
              {/* Comptes inactius */}
              {inactiveAccounts.map((account) => (
                <MobileListItem
                  key={account.id}
                  className="opacity-60"
                  title={account.name}
                  leadingIcon={<Building2 className="h-4 w-4" />}
                  badges={[
                    <Badge key="status" variant="outline" className="text-xs">
                      {t.settings.bankAccounts.inactive}
                    </Badge>
                  ]}
                  meta={[
                    ...(account.iban ? [{ label: 'IBAN', value: account.iban }] : []),
                    ...(account.bankName ? [{ value: account.bankName }] : []),
                  ]}
                  actions={
                    canEdit ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(account)}>
                            <Edit className="mr-2 h-4 w-4" />
                            {t.common.edit}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleToggleActive(account)}
                            className="text-green-600"
                          >
                            <Power className="mr-2 h-4 w-4" />
                            {t.settings.bankAccounts.activate}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : undefined
                  }
                />
              ))}
            </div>
          ) : (
            /* Vista desktop */
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.settings.bankAccounts.name}</TableHead>
                    <TableHead>{t.settings.bankAccounts.iban}</TableHead>
                    <TableHead>{t.settings.bankAccounts.bankName}</TableHead>
                    <TableHead>{t.settings.bankAccounts.status}</TableHead>
                    {canEdit && <TableHead className="text-right">{t.settings.actions}</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Comptes actius */}
                  {bankAccounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-medium">
                        {account.name}
                        {account.isDefault && (
                          <Badge variant="secondary" className="ml-2">
                            {t.settings.bankAccounts.default}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {account.iban || '-'}
                      </TableCell>
                      <TableCell>{account.bankName || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="default">{t.settings.bankAccounts.active}</Badge>
                      </TableCell>
                      {canEdit && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(account)}
                            title={t.common.edit}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {!account.isDefault && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleSetDefault(account)}
                              title={t.settings.bankAccounts.setAsDefault}
                            >
                              <Star className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleActive(account)}
                            disabled={isLastActiveAccount}
                            title={isLastActiveAccount ? t.settings.bankAccounts.cannotDeactivateLast : t.settings.bankAccounts.deactivate}
                            className={isLastActiveAccount ? "text-muted-foreground cursor-not-allowed" : "text-orange-500 hover:text-orange-600"}
                          >
                            <PowerOff className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {/* Comptes inactius */}
                  {inactiveAccounts.map((account) => (
                    <TableRow key={account.id} className="opacity-60">
                      <TableCell className="font-medium">{account.name}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {account.iban || '-'}
                      </TableCell>
                      <TableCell>{account.bankName || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{t.settings.bankAccounts.inactive}</Badge>
                      </TableCell>
                      {canEdit && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(account)}
                            title={t.common.edit}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleActive(account)}
                            title={t.settings.bankAccounts.activate}
                            className="text-green-500 hover:text-green-600"
                          >
                            <Power className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {canEdit && (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{dialogDescription}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                {t.settings.bankAccounts.name} *
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={handleFormChange}
                className="col-span-3"
                placeholder={t.settings.bankAccounts.namePlaceholder}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="iban" className="text-right">
                {t.settings.bankAccounts.iban}
              </Label>
              <Input
                id="iban"
                value={formData.iban}
                onChange={handleFormChange}
                className="col-span-3 font-mono"
                placeholder={tr('settings.bankAccounts.ibanPlaceholder')}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="bankName" className="text-right">
                {t.settings.bankAccounts.bankName}
              </Label>
              <Input
                id="bankName"
                value={formData.bankName}
                onChange={handleFormChange}
                className="col-span-3"
                placeholder={t.settings.bankAccounts.bankNamePlaceholder}
              />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="creditorId" className="text-right pt-2">
                {tr('settings.bankAccounts.creditorIdLabel')}
              </Label>
              <div className="col-span-3 space-y-1">
                <Input
                  id="creditorId"
                  value={formData.creditorId}
                  onChange={handleFormChange}
                  className="font-mono"
                  placeholder={tr('settings.bankAccounts.creditorIdPlaceholder')}
                />
                <p className="text-xs text-muted-foreground">
                  {tr('settings.bankAccounts.creditorIdHint')}
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isSaving}>
                {t.common.cancel}
              </Button>
            </DialogClose>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t.settings.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      )}

      <BankAccountImporter
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
      />
    </Dialog>
  );
}
