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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { Calendar } from '@/components/ui/calendar';
import {
  AlertCircle,
  Check,
  CalendarIcon,
  FileText,
  Loader2,
  Download,
  ExternalLink,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrencyEU } from '@/lib/normalize';
import { format, parseISO, isValid } from 'date-fns';
import { ca } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { useFirebase } from '@/firebase';
import { useCurrentOrganization } from '@/hooks/organization-provider';
import { useBankAccounts } from '@/hooks/use-bank-accounts';
import type { PendingDocument } from '@/lib/pending-documents/types';
import type { Contact, BankAccount } from '@/lib/data';
import {
  validateDocsForSepa,
  createSepaRemittance,
  type ValidDocInfo,
  type InvalidDocInfo,
} from '@/lib/pending-documents/sepa-remittance';
import { useTranslations } from '@/i18n';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface SepaGenerationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDocuments: PendingDocument[];
  contacts: Contact[];
  onComplete: () => void;
}

type ModalStep = 'validation' | 'configuration' | 'generating' | 'success';

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function SepaGenerationModal({
  open,
  onOpenChange,
  selectedDocuments,
  contacts,
  onComplete,
}: SepaGenerationModalProps) {
  const { firestore, storage } = useFirebase();
  const { organizationId, organization } = useCurrentOrganization();
  const { bankAccounts, isLoading: isLoadingBankAccounts } = useBankAccounts();
  const { toast } = useToast();
  const { t } = useTranslations();

  // State
  const [step, setStep] = React.useState<ModalStep>('validation');
  const [validDocs, setValidDocs] = React.useState<ValidDocInfo[]>([]);
  const [invalidDocs, setInvalidDocs] = React.useState<InvalidDocInfo[]>([]);

  // Configuration state
  const [selectedBankAccountId, setSelectedBankAccountId] = React.useState<string>('');
  const [executionDate, setExecutionDate] = React.useState<Date>(new Date());
  const [filename, setFilename] = React.useState<string>('');
  const [datePickerOpen, setDatePickerOpen] = React.useState(false);

  // Result state
  const [result, setResult] = React.useState<{
    remittanceId: string;
    downloadUrl: string;
    filename: string;
    nbOfTxs: number;
    ctrlSum: number;
  } | null>(null);

  // Validate documents when modal opens or selection changes
  React.useEffect(() => {
    if (open && selectedDocuments.length > 0) {
      const { valid, invalid } = validateDocsForSepa(selectedDocuments, contacts);
      setValidDocs(valid);
      setInvalidDocs(invalid);
      setStep('validation');
      setResult(null);

      // Auto-generate filename
      const dateStr = format(new Date(), 'yyyy-MM-dd');
      setFilename(`${t.sepa.filenamePrefix}_${dateStr}_${valid.length}${t.sepa.filenamePayments}.xml`);

      // Select default bank account
      const defaultAccount = bankAccounts.find(a => a.isDefault);
      if (defaultAccount) {
        setSelectedBankAccountId(defaultAccount.id);
      } else if (bankAccounts.length > 0) {
        setSelectedBankAccountId(bankAccounts[0].id);
      }
    }
  }, [open, selectedDocuments, contacts, bankAccounts]);

  // Reset when closed
  React.useEffect(() => {
    if (!open) {
      setStep('validation');
      setValidDocs([]);
      setInvalidDocs([]);
      setResult(null);
    }
  }, [open]);

  // Handlers
  const handleContinue = () => {
    if (validDocs.length === 0) {
      toast({
        variant: 'destructive',
        title: t.sepa.toasts.noValid,
        description: t.sepa.toasts.noValidDesc,
      });
      return;
    }
    setStep('configuration');
  };

  const handleGenerate = async () => {
    if (!firestore || !storage || !organizationId || !organization) {
      toast({
        variant: 'destructive',
        title: t.sepa.toasts.error,
        description: t.sepa.toasts.errorInit,
      });
      return;
    }

    const bankAccount = bankAccounts.find(a => a.id === selectedBankAccountId);
    if (!bankAccount) {
      toast({
        variant: 'destructive',
        title: t.sepa.toasts.error,
        description: t.sepa.toasts.errorAccount,
      });
      return;
    }

    if (!bankAccount.iban) {
      toast({
        variant: 'destructive',
        title: t.sepa.toasts.error,
        description: t.sepa.toasts.errorNoIban,
      });
      return;
    }

    setStep('generating');

    try {
      const resultData = await createSepaRemittance(
        firestore,
        storage,
        organizationId,
        {
          bankAccount,
          executionDate: format(executionDate, 'yyyy-MM-dd'),
          debtorName: organization.name || t.sepa.organizationFallback,
          documents: validDocs.map(v => v.doc),
          contacts,
        }
      );

      // 1. Descàrrega silent (sense obrir pestanya)
      const a = document.createElement('a');
      a.href = resultData.downloadUrl;
      a.download = resultData.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // 2. Tancar modal i notificar pare
      onComplete();
      onOpenChange(false);

      // 3. Toast clar amb CTA per tornar a descarregar
      toast({
        title: t.sepa.toasts.downloaded,
        description: t.sepa.toasts.downloadedDesc({ count: resultData.nbOfTxs, amount: formatCurrencyEU(resultData.ctrlSum) }),
        action: (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const link = document.createElement('a');
              link.href = resultData.downloadUrl;
              link.download = resultData.filename;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
          >
            <Download className="mr-2 h-3 w-3" />
            {t.sepa.downloadAgain}
          </Button>
        ),
      });

    } catch (error) {
      console.error('Error generating SEPA:', error);
      setStep('configuration');
      toast({
        variant: 'destructive',
        title: t.sepa.toasts.errorGenerate,
        description: error instanceof Error ? error.message : t.pendingDocs.toasts.errorUnknown,
      });
    }
  };

  const handleClose = () => {
    if (step === 'success') {
      onComplete();
    }
    onOpenChange(false);
  };

  // Computed
  const selectedBankAccount = bankAccounts.find(a => a.id === selectedBankAccountId);
  const totalAmount = validDocs.reduce((sum, v) => sum + (v.doc.amount || 0), 0);
  const bankAccountsWithIban = bankAccounts.filter(a => a.iban);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[min(96vw,72rem)] overflow-y-auto sm:w-[min(calc(100vw-3rem),72rem)]">
        <DialogHeader>
          <DialogTitle>
            {step === 'validation' && t.sepa.title}
            {step === 'configuration' && t.sepa.titleConfiguration}
            {step === 'generating' && t.sepa.titleGenerating}
            {step === 'success' && t.sepa.titleSuccess}
          </DialogTitle>
          <DialogDescription>
            {step === 'validation' && t.sepa.description({ count: selectedDocuments.length })}
            {step === 'configuration' && t.sepa.descriptionConfig({ count: validDocs.length, amount: formatCurrencyEU(totalAmount) })}
            {step === 'generating' && t.sepa.descriptionGenerating}
            {step === 'success' && t.sepa.descriptionSuccess}
          </DialogDescription>
        </DialogHeader>

        {/* Info banner */}
        <Alert className="border-blue-200 bg-blue-50">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-700 text-sm">
            {t.sepa.infoBanner}
          </AlertDescription>
        </Alert>

        {/* Step: Validation */}
        {step === 'validation' && (
          <div className="space-y-4">
            {/* Valid documents */}
            {validDocs.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  {t.sepa.validDocs({ count: validDocs.length })}
                </h4>
                <ScrollArea className="h-[150px] rounded-md border p-2">
                  <div className="space-y-2">
                    {validDocs.map(({ doc, supplier }) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between text-sm py-1 border-b last:border-0"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="h-3 w-3 text-muted-foreground" />
                          <span className="truncate max-w-[200px]">{doc.invoiceNumber}</span>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-muted-foreground truncate max-w-[120px]">
                            {supplier.name}
                          </span>
                        </div>
                        <span className="font-medium">{formatCurrencyEU(doc.amount || 0)}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Invalid documents */}
            {invalidDocs.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {t.sepa.invalidDocs({ count: invalidDocs.length })}
                </h4>
                <ScrollArea className="h-[120px] rounded-md border border-destructive/30 bg-destructive/5 p-2">
                  <div className="space-y-2">
                    {invalidDocs.map(({ doc, reason }) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between text-sm py-1 border-b border-destructive/20 last:border-0"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="h-3 w-3 text-destructive" />
                          <span className="truncate max-w-[200px]">
                            {doc.invoiceNumber || doc.file.filename}
                          </span>
                        </div>
                        <Badge variant="destructive" className="text-xs">
                          {reason}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Summary */}
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-sm text-muted-foreground">{t.sepa.totalToPay}</span>
              <span className="text-lg font-bold">{formatCurrencyEU(totalAmount)}</span>
            </div>
          </div>
        )}

        {/* Step: Configuration */}
        {step === 'configuration' && (
          <div className="space-y-4">
            {/* Bank account selector */}
            <div className="space-y-2">
              <Label htmlFor="bankAccount">{t.sepa.bankAccount}</Label>
              {isLoadingBankAccounts ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t.sepa.loadingAccounts}
                </div>
              ) : bankAccountsWithIban.length === 0 ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>{t.sepa.noAccountsWithIban}</AlertTitle>
                  <AlertDescription>
                    {t.sepa.noAccountsWithIbanDesc}
                  </AlertDescription>
                </Alert>
              ) : (
                <Select
                  value={selectedBankAccountId}
                  onValueChange={setSelectedBankAccountId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t.sepa.selectAccount} />
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccountsWithIban.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        <div className="flex flex-col">
                          <span>{account.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {account.iban}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Execution date */}
            <div className="space-y-2">
              <Label>{t.sepa.executionDate}</Label>
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !executionDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {executionDate ? format(executionDate, 'dd/MM/yyyy') : t.sepa.selectDate}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={executionDate}
                    onSelect={(date) => {
                      if (date) {
                        setExecutionDate(date);
                        // Update filename with new date
                        const dateStr = format(date, 'yyyy-MM-dd');
                        setFilename(`${t.sepa.filenamePrefix}_${dateStr}_${validDocs.length}${t.sepa.filenamePayments}.xml`);
                      }
                      setDatePickerOpen(false);
                    }}
                    locale={ca}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Filename */}
            <div className="space-y-2">
              <Label htmlFor="filename">{t.sepa.filename}</Label>
              <Input
                id="filename"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
              />
            </div>

            {/* Summary */}
            <div className="flex items-center justify-between pt-2 border-t">
              <div>
                <p className="text-sm text-muted-foreground">{t.sepa.payments({ count: validDocs.length })}</p>
                <p className="text-lg font-bold">{formatCurrencyEU(totalAmount)}</p>
              </div>
              {selectedBankAccount && (
                <div className="text-right text-sm">
                  <p className="text-muted-foreground">{t.sepa.fromAccount}</p>
                  <p className="font-medium">{selectedBankAccount.name}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step: Generating */}
        {step === 'generating' && (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-muted-foreground">{t.sepa.generating}</p>
          </div>
        )}

        {/* Step: Success */}
        {step === 'success' && result && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
              <Check className="h-8 w-8 text-green-600" />
              <div>
                <p className="font-medium text-green-800">{t.sepa.success}</p>
                <p className="text-sm text-green-700">
                  {t.sepa.successDesc({ count: result.nbOfTxs, amount: formatCurrencyEU(result.ctrlSum) })}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">{result.filename}</span>
              </div>
              <Button variant="outline" size="sm" asChild>
                <a href={result.downloadUrl} download={result.filename}>
                  <Download className="mr-2 h-4 w-4" />
                  {t.sepa.download}
                </a>
              </Button>
            </div>

            <p className="text-sm text-muted-foreground text-center">
              {t.sepa.uploadToBank}
            </p>
          </div>
        )}

        <DialogFooter>
          {step === 'validation' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                {t.pendingDocs.actions.cancel}
              </Button>
              <Button
                onClick={handleContinue}
                disabled={validDocs.length === 0}
              >
                {t.sepa.continueWithValid({ count: validDocs.length })}
              </Button>
            </>
          )}

          {step === 'configuration' && (
            <>
              <Button variant="outline" onClick={() => setStep('validation')}>
                {t.pendingDocs.actions.back}
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={!selectedBankAccountId || bankAccountsWithIban.length === 0}
              >
                {t.sepa.generate}
              </Button>
            </>
          )}

          {step === 'success' && (
            <Button onClick={handleClose}>
              {t.pendingDocs.actions.close}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
