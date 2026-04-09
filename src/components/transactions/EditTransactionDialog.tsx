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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Heart, Building2, Users } from 'lucide-react';
import { useTranslations } from '@/i18n';
import type { Transaction, Project, AnyContact, ContactType } from '@/lib/data';
import {
  buildContactRoleOptions,
  parseContactRoleValue,
  resolveContactRoleOption,
} from '@/lib/contacts/contact-role-options';
import { getContactTypeLabel } from '@/lib/ui/display-labels';

interface EditFormData {
  description: string;
  amount: string;
  note: string;
  contactId: string | null;
  contactType: ContactType | null;
  projectId: string | null;
}

interface EditTransactionDialogProps {
  open: boolean;
  transaction: Transaction | null;
  projects: Project[] | null;
  availableContacts: AnyContact[] | null;
  onSave: (data: EditFormData) => void;
  onClose: () => void;
}

export const EditTransactionDialog = React.memo(function EditTransactionDialog({
  open,
  transaction,
  projects,
  availableContacts,
  onSave,
  onClose,
}: EditTransactionDialogProps) {
  const { t } = useTranslations();

  // Moviments importats (amb bankAccountId) tenen camps bancaris bloquejats
  const isBankTransaction = transaction?.bankAccountId != null;

  // Local state for form - only synced when dialog opens
  const [formData, setFormData] = React.useState<EditFormData>({
    description: '',
    amount: '',
    note: '',
    contactId: null,
    contactType: null,
    projectId: null,
  });

  const contactOptions = React.useMemo(
    () => buildContactRoleOptions(availableContacts ?? []),
    [availableContacts]
  );

  const donorOptions = React.useMemo(
    () => contactOptions.filter((option) => option.contactType === 'donor'),
    [contactOptions]
  );

  const supplierOptions = React.useMemo(
    () => contactOptions.filter((option) => option.contactType === 'supplier'),
    [contactOptions]
  );

  const employeeOptions = React.useMemo(
    () => contactOptions.filter((option) => option.contactType === 'employee'),
    [contactOptions]
  );

  const getOptionLabel = React.useCallback((contactType: ContactType, contactName: string, isMultiRole: boolean) => {
    const roleLabel = getContactTypeLabel(contactType, t.common ?? {});
    return isMultiRole ? `${contactName} · ${roleLabel}` : contactName;
  }, [t.common]);

  const selectedContactValue = React.useMemo(() => {
    const selectedOption = resolveContactRoleOption(
      availableContacts ?? [],
      formData.contactId,
      formData.contactType
    );

    return selectedOption?.key ?? 'null';
  }, [availableContacts, formData.contactId, formData.contactType]);

  React.useEffect(() => {
    if (!transaction) return;

    const selectedOption = resolveContactRoleOption(
      availableContacts ?? [],
      transaction.contactId ?? null,
      transaction.contactType ?? null
    );

    setFormData({
      description: transaction.description,
      amount: String(transaction.amount),
      note: transaction.note || '',
      contactId: selectedOption?.contactId ?? transaction.contactId ?? null,
      contactType: selectedOption?.contactType ?? transaction.contactType ?? null,
      projectId: transaction.projectId || null,
    });
  }, [transaction]);

  React.useEffect(() => {
    if (!open || !formData.contactId || formData.contactType) return;

    const selectedOption = resolveContactRoleOption(
      availableContacts ?? [],
      formData.contactId,
      null
    );

    if (!selectedOption) return;

    setFormData((prev) => (
      prev.contactId === selectedOption.contactId && !prev.contactType
        ? { ...prev, contactType: selectedOption.contactType }
        : prev
    ));
  }, [availableContacts, formData.contactId, formData.contactType, open]);

  const handleSave = React.useCallback(() => {
    onSave(formData);
  }, [onSave, formData]);

  const handleOpenChange = React.useCallback((isOpen: boolean) => {
    if (!isOpen) {
      onClose();
    }
  }, [onClose]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.movements.table.editTransaction}</DialogTitle>
          <DialogDescription>
            {t.movements.table.editTransactionDescription}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">
              {t.movements.table.bankConcept}
            </Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="col-span-3"
              disabled={isBankTransaction}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="note" className="text-right">
              {t.movements.table.noteLabel}
            </Label>
            <Input
              id="note"
              value={formData.note}
              onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
              className="col-span-3"
              placeholder={t.movements.table.descriptionPlaceholder}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="amount" className="text-right">
              {t.movements.table.amount}
            </Label>
            <Input
              id="amount"
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
              className="col-span-3"
              disabled={isBankTransaction}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="contact" className="text-right">
              {t.movements.table.contact}
            </Label>
            <Select
              value={selectedContactValue}
              onValueChange={(value) => {
                if (value === 'null') {
                  setFormData(prev => ({ ...prev, contactId: null, contactType: null }));
                  return;
                }

                const { contactId, contactType } = parseContactRoleValue(value);
                setFormData(prev => ({ ...prev, contactId, contactType }));
              }}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder={t.movements.table.selectContact} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="null">{t.common.none}</SelectItem>
                {donorOptions.length > 0 && (
                  <>
                    <SelectItem value="__donors_label__" disabled className="text-xs text-muted-foreground">
                      {t.movements.table.donorsSection}
                    </SelectItem>
                    {donorOptions.map((option) => (
                      <SelectItem key={option.key} value={option.key}>
                        <span className="flex items-center gap-2">
                          <Heart className="h-3 w-3 text-red-500" />
                          {getOptionLabel(option.contactType, option.contactName, option.isMultiRole)}
                        </span>
                      </SelectItem>
                    ))}
                  </>
                )}
                {supplierOptions.length > 0 && (
                  <>
                    <SelectItem value="__suppliers_label__" disabled className="text-xs text-muted-foreground">
                      {t.movements.table.suppliersSection}
                    </SelectItem>
                    {supplierOptions.map((option) => (
                      <SelectItem key={option.key} value={option.key}>
                        <span className="flex items-center gap-2">
                          <Building2 className="h-3 w-3 text-blue-500" />
                          {getOptionLabel(option.contactType, option.contactName, option.isMultiRole)}
                        </span>
                      </SelectItem>
                    ))}
                  </>
                )}
                {employeeOptions.length > 0 && (
                  <>
                    <SelectItem value="__employees_label__" disabled className="text-xs text-muted-foreground">
                      {t.contactCombobox.employees}
                    </SelectItem>
                    {employeeOptions.map((option) => (
                      <SelectItem key={option.key} value={option.key}>
                        <span className="flex items-center gap-2">
                          <Users className="h-3 w-3 text-green-600" />
                          {getOptionLabel(option.contactType, option.contactName, option.isMultiRole)}
                        </span>
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="project" className="text-right">
              {t.movements.table.project}
            </Label>
            <Select
              value={formData.projectId || 'null'}
              onValueChange={(value) => setFormData(prev => ({ ...prev, projectId: value === 'null' ? null : value }))}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder={t.projects.selectFunder} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="null">{t.common.none}</SelectItem>
                {projects?.map(project => (
                  <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t.common.cancel}</Button>
          </DialogClose>
          <Button onClick={handleSave}>{t.movements.table.saveChanges}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
