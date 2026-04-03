'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useFirebase, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import { useCurrentOrganization } from '@/hooks/organization-provider';
import { collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from '@/i18n';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface CreateSupplierModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Nom inicial per pre-omplir el camp (ex: text buscat al combobox) */
  initialName?: string;
  /** Callback quan es crea el proveïdor, rep l'ID del contacte creat */
  onCreated: (contactId: string) => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function CreateSupplierModal({
  open,
  onOpenChange,
  initialName = '',
  onCreated,
}: CreateSupplierModalProps) {
  const { firestore } = useFirebase();
  const { organizationId } = useCurrentOrganization();
  const { toast } = useToast();
  const { t } = useTranslations();

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [name, setName] = React.useState('');
  const [taxId, setTaxId] = React.useState('');
  const [iban, setIban] = React.useState('');

  // Collection ref
  const contactsCollection = useMemoFirebase(
    () => organizationId ? collection(firestore, 'organizations', organizationId, 'contacts') : null,
    [firestore, organizationId]
  );

  // Reset form when modal opens
  React.useEffect(() => {
    if (open) {
      setName(initialName);
      setTaxId('');
      setIban('');
    }
  }, [open, initialName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: t.importers.supplier.errors.missingName,
      });
      return;
    }

    if (!contactsCollection || !organizationId) {
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: t.common.dbConnectionError,
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const now = new Date().toISOString();

      const supplierData = {
        type: 'supplier' as const,
        roles: { supplier: true },
        name: name.trim(),
        taxId: taxId.trim() || '',
        zipCode: '',
        iban: iban.trim() || null,
        createdAt: now,
        updatedAt: now,
      };

      // addDocumentNonBlocking retorna una Promise amb el DocRef
      const docRef = await addDocumentNonBlocking(contactsCollection, supplierData);

      if (!docRef) {
        throw new Error('No s\'ha pogut crear el document');
      }

      toast({
        title: t.suppliers.supplierCreated,
        description: t.suppliers.supplierCreatedDescription(name.trim()),
      });

      onCreated(docRef.id);
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating supplier:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: t.common.actionError,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!w-[min(calc(100vw-1.5rem),42rem)] !max-w-[42rem] p-0 sm:!w-[min(calc(100vw-3rem),42rem)]">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="border-b px-4 py-5 pr-10 sm:px-6">
            <DialogTitle>{t.suppliers.addTitle}</DialogTitle>
            <DialogDescription>
              {t.suppliers.addDescription}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 px-4 py-4 sm:grid-cols-2 sm:px-6">
            {/* Nom (obligatori) */}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="supplier-name">
                {t.suppliers.name} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="supplier-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.suppliers.namePlaceholder}
                autoFocus
              />
            </div>

            {/* CIF/NIF (opcional) */}
            <div className="space-y-2">
              <Label htmlFor="supplier-taxid">{t.suppliers.taxId}</Label>
              <Input
                id="supplier-taxid"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value.toUpperCase())}
                placeholder="B12345678"
              />
            </div>

            {/* IBAN (opcional) */}
            <div className="space-y-2">
              <Label htmlFor="supplier-iban">{t.suppliers.iban}</Label>
              <Input
                id="supplier-iban"
                value={iban}
                onChange={(e) => setIban(e.target.value.toUpperCase().replace(/\s/g, ''))}
                placeholder="ES12 3456 7890 1234 5678 9012"
              />
            </div>
          </div>

          <DialogFooter className="border-t px-4 py-4 sm:px-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t.suppliers.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
