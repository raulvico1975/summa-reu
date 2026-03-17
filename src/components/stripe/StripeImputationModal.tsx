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
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { Loader2, AlertTriangle, Upload, CheckCircle2 } from 'lucide-react';
import { collection, doc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { useCurrentOrganization } from '@/hooks/organization-provider';
import { useToast } from '@/hooks/use-toast';
import type { Donor } from '@/lib/data';
import type { Donation } from '@/lib/types/donations';
import { createStripeDonations, STRIPE_DUPLICATE_PAYMENT_ERROR, type StripeDonationPaymentInput } from '@/lib/stripe/createStripeDonations';
import {
  findAllMatchingPayoutGroups,
  groupStripeRowsByTransfer,
  parseStripeCsv,
  type StripePayoutGroup,
} from '@/components/stripe-importer/useStripeImporter';
import { DonorSearchCombobox } from '@/components/donor-search-combobox';

interface BankTransactionSummary {
  id: string;
  amount: number;
  date: string;
  description: string;
}

interface StripeImputationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bankTransaction: BankTransactionSummary;
  donors: Donor[];
  onComplete?: () => void;
}

interface ParsedPaymentRow {
  stripePaymentId: string;
  amount: number;
  fee: number;
  date: string;
  customerEmail: string;
  description: string | null;
  contactId: string | null;
}

export function StripeImputationModal({
  open,
  onOpenChange,
  bankTransaction,
  donors,
  onComplete,
}: StripeImputationModalProps) {
  const { firestore } = useFirebase();
  const { organizationId } = useCurrentOrganization();
  const { toast } = useToast();
  const [isParsing, setIsParsing] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [warning, setWarning] = React.useState<string | null>(null);
  const [parsedPayments, setParsedPayments] = React.useState<ParsedPaymentRow[]>([]);
  const [matchingGroups, setMatchingGroups] = React.useState<StripePayoutGroup[]>([]);
  const [selectedTransferId, setSelectedTransferId] = React.useState<string | null>(null);
  const [isConfirmed, setIsConfirmed] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (!open) {
      setIsParsing(false);
      setIsSaving(false);
      setWarning(null);
      setParsedPayments([]);
      setMatchingGroups([]);
      setSelectedTransferId(null);
      setIsConfirmed(false);
    }
  }, [open]);

  const donorByEmail = React.useMemo(() => {
    return new Map(
      donors
        .filter((donor) => donor.email)
        .map((donor) => [donor.email!.toLowerCase().trim(), donor.id])
    );
  }, [donors]);

  const selectedGroup = React.useMemo(
    () => matchingGroups.find((group) => group.transferId === selectedTransferId) ?? null,
    [matchingGroups, selectedTransferId]
  );

  const allRowsAssigned = React.useMemo(
    () => parsedPayments.length > 0 && parsedPayments.every((row) => !!row.contactId),
    [parsedPayments]
  );

  const handleFile = React.useCallback(async (file: File) => {
    setIsParsing(true);
    setWarning(null);

    try {
      const text = await file.text();
      const parsed = parseStripeCsv(text);
      const groups = groupStripeRowsByTransfer(parsed.rows);
      const allMatches = findAllMatchingPayoutGroups(groups, bankTransaction.amount);
      const group = allMatches[0] ?? null;

      if (!group) {
        throw new Error('ERR_NO_PAYOUT_MATCH');
      }

      setMatchingGroups(allMatches.length > 0 ? allMatches : [group]);
      setSelectedTransferId(group.transferId);
      setWarning(
        parsed.warnings.length > 0
          ? "S'han exclòs pagaments reemborsats del CSV."
          : allMatches.length > 1
            ? 'Hi ha diversos payouts que quadren amb aquest abonament. Selecciona el correcte.'
            : null
      );

      const nextPayments = group.rows.map((row) => ({
        stripePaymentId: row.id,
        amount: row.amount,
        fee: row.fee,
        date: row.createdDate,
        customerEmail: row.customerEmail,
        description: row.description,
        contactId: donorByEmail.get(row.customerEmail.toLowerCase().trim()) ?? null,
      }));

      setParsedPayments(nextPayments);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error processant el CSV';
      toast({
        variant: 'destructive',
        title: 'No s\'ha pogut imputar Stripe',
        description: message,
      });
      setParsedPayments([]);
      setMatchingGroups([]);
      setSelectedTransferId(null);
    } finally {
      setIsParsing(false);
    }
  }, [bankTransaction.amount, donorByEmail, toast]);

  const handleUploadChange = React.useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await handleFile(file);
    event.target.value = '';
  }, [handleFile]);

  const handleSelectGroup = React.useCallback((transferId: string) => {
    const group = matchingGroups.find((item) => item.transferId === transferId);
    if (!group) return;

    setSelectedTransferId(transferId);
    setParsedPayments(
      group.rows.map((row) => ({
        stripePaymentId: row.id,
        amount: row.amount,
        fee: row.fee,
        date: row.createdDate,
        customerEmail: row.customerEmail,
        description: row.description,
        contactId: donorByEmail.get(row.customerEmail.toLowerCase().trim()) ?? null,
      }))
    );
  }, [donorByEmail, matchingGroups]);

  const setPaymentContact = React.useCallback((stripePaymentId: string, contactId: string | null) => {
    setParsedPayments((current) =>
      current.map((payment) =>
        payment.stripePaymentId === stripePaymentId ? { ...payment, contactId } : payment
      )
    );
  }, []);

  const findDonationByStripePaymentId = React.useCallback(async (stripePaymentId: string): Promise<Donation | null> => {
    if (!organizationId) return null;
    const donationsRef = collection(firestore, 'organizations', organizationId, 'donations');
    const snapshot = await getDocs(query(donationsRef, where('stripePaymentId', '==', stripePaymentId)));
    const firstDoc = snapshot.docs[0];
    if (!firstDoc) return null;
    return { id: firstDoc.id, ...(firstDoc.data() as Donation) };
  }, [firestore, organizationId]);

  const handleConfirm = React.useCallback(async () => {
    if (!organizationId) return;
    if (!allRowsAssigned) {
      toast({
        variant: 'destructive',
        title: 'Falten donants per assignar',
        description: 'Cada pagament Stripe ha de quedar vinculat a un donant abans de confirmar.',
      });
      return;
    }

    setIsSaving(true);
    try {
      const payments: StripeDonationPaymentInput[] = parsedPayments.map((payment) => ({
        stripePaymentId: payment.stripePaymentId,
        amount: payment.amount,
        fee: payment.fee,
        contactId: payment.contactId,
        date: payment.date,
        customerEmail: payment.customerEmail,
        description: payment.description,
      }));

      const { donations, adjustment } = await createStripeDonations({
        parentTransactionId: bankTransaction.id,
        payments,
        bankAmount: bankTransaction.amount,
        adjustmentDate: bankTransaction.date,
        findDonationByStripePaymentId,
      });

      const batch = writeBatch(firestore);
      const donationsRef = collection(firestore, 'organizations', organizationId, 'donations');

      donations.forEach((donation) => {
        const ref = doc(donationsRef);
        batch.set(ref, donation);
      });

      if (adjustment) {
        const ref = doc(donationsRef);
        batch.set(ref, adjustment);
      }

      await batch.commit();

      toast({
        title: 'Imputacio Stripe completada',
        description: `S'han creat ${donations.length} donacions Stripe${adjustment ? ' i 1 ajust' : ''}.`,
      });

      onOpenChange(false);
      onComplete?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconegut';
      toast({
        variant: 'destructive',
        title: 'Error a la imputacio Stripe',
        description: message === STRIPE_DUPLICATE_PAYMENT_ERROR
          ? 'Aquest pagament Stripe ja ha estat imputat.'
          : message,
      });
    } finally {
      setIsSaving(false);
    }
  }, [allRowsAssigned, bankTransaction.amount, bankTransaction.date, bankTransaction.id, findDonationByStripePaymentId, firestore, onComplete, onOpenChange, organizationId, parsedPayments, toast]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Imputar Stripe</DialogTitle>
          <DialogDescription>
            Carrega el CSV de Stripe i vincula cada pagament brut al seu donant. El moviment bancari pare es manté intacte.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertTitle>Abonament bancari</AlertTitle>
            <AlertDescription>
              {bankTransaction.description} · {bankTransaction.amount.toFixed(2)} €
            </AlertDescription>
          </Alert>

          <div className="flex items-center gap-3">
            <Input ref={inputRef} type="file" accept=".csv,text/csv" onChange={handleUploadChange} />
            <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={isParsing}>
              {isParsing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Pujar CSV
            </Button>
          </div>

          {warning && (
            <Alert variant="default">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Revisa aquest punt</AlertTitle>
              <AlertDescription>{warning}</AlertDescription>
            </Alert>
          )}

          {matchingGroups.length > 1 && (
            <div className="space-y-2">
              <Label>Payout detectat</Label>
              <Select value={selectedTransferId ?? undefined} onValueChange={handleSelectGroup}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona payout" />
                </SelectTrigger>
                <SelectContent>
                  {matchingGroups.map((group) => (
                    <SelectItem key={group.transferId} value={group.transferId}>
                      {group.transferId} · net {group.net.toFixed(2)} €
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedGroup && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Pagaments detectats</AlertTitle>
              <AlertDescription>
                {selectedGroup.rows.length} pagaments · brut {selectedGroup.gross.toFixed(2)} € · comissions {selectedGroup.fees.toFixed(2)} € · net {selectedGroup.net.toFixed(2)} €
              </AlertDescription>
            </Alert>
          )}

          {parsedPayments.length > 0 && (
            <div className="max-h-[420px] overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Import brut</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Donant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedPayments.map((payment) => (
                    <TableRow key={payment.stripePaymentId}>
                      <TableCell>{payment.amount.toFixed(2)} €</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{payment.customerEmail || 'Sense email'}</TableCell>
                      <TableCell className="min-w-[260px]">
                        <DonorSearchCombobox
                          donors={donors}
                          value={payment.contactId}
                          onSelect={(donorId) => setPaymentContact(payment.stripePaymentId, donorId)}
                          placeholder="Assigna donant"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Checkbox id="confirm-stripe-imputation" checked={isConfirmed} onCheckedChange={(value) => setIsConfirmed(value === true)} />
            <Label htmlFor="confirm-stripe-imputation">
              Confirmo que les donacions brutes i els donants assignats són correctes.
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel·lar
          </Button>
          <Button onClick={handleConfirm} disabled={isSaving || parsedPayments.length === 0 || !allRowsAssigned || !isConfirmed}>
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Confirmar imputació
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
