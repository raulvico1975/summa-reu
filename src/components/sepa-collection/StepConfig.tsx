'use client';

import * as React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Building2, CreditCard } from 'lucide-react';
import { useTranslations } from '@/i18n';
import type { BankAccount } from '@/lib/data';

export interface ConfigData {
  bankAccountId: string;
  collectionDate: string;
}

interface StepConfigProps {
  bankAccounts: BankAccount[];
  configData: ConfigData;
  onChange: (data: ConfigData) => void;
  isLoading: boolean;
}

export function StepConfig({ bankAccounts, configData, onChange, isLoading }: StepConfigProps) {
  const { t, tr } = useTranslations();

  // Filter active accounts
  const activeAccounts = React.useMemo(
    () => bankAccounts.filter(a => a.isActive !== false),
    [bankAccounts]
  );

  // Auto-select if only one account
  React.useEffect(() => {
    if (activeAccounts.length === 1 && !configData.bankAccountId) {
      onChange({ ...configData, bankAccountId: activeAccounts[0].id });
    }
  }, [activeAccounts, configData, onChange]);

  // Auto-set default collection date (today + 5 business days)
  React.useEffect(() => {
    if (!configData.collectionDate) {
      const today = new Date();
      // Add 5 days (simple approach, ignores weekends)
      today.setDate(today.getDate() + 5);
      const dateStr = today.toISOString().split('T')[0];
      onChange({ ...configData, collectionDate: dateStr });
    }
  }, [configData, onChange]);

  const selectedAccount = activeAccounts.find(a => a.id === configData.bankAccountId);
  const hasCreditorId = !!selectedAccount?.creditorId;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">{t.sepaCollection.config.title}</h3>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
        <div className="space-y-6">
          {/* Bank Account Select */}
          <div className="space-y-2">
            <Label htmlFor="bankAccount">{t.sepaCollection.config.bankAccount}</Label>
            <Select
              value={configData.bankAccountId}
              onValueChange={(value) => onChange({ ...configData, bankAccountId: value })}
            >
              <SelectTrigger id="bankAccount">
                <SelectValue placeholder={t.sepaCollection.config.bankAccountHint} />
              </SelectTrigger>
              <SelectContent>
                {activeAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span>{account.name}</span>
                      {account.isDefault && (
                        <span className="text-xs text-muted-foreground">{tr('sepaPain008.config.defaultAccount', '(defecte)')}</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t.sepaCollection.config.bankAccountHint}
            </p>
          </div>

          {/* Creditor ID warning */}
          {selectedAccount && !hasCreditorId && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {t.sepaCollection.config.noCreditorId}
                <br />
                <span className="text-xs">{t.sepaCollection.config.configureCreditorId}</span>
              </AlertDescription>
            </Alert>
          )}

          {/* Show creditor info if available */}
          {selectedAccount && hasCreditorId && (
            <div className="space-y-2 rounded-lg border bg-muted/50 p-4">
              <div className="flex items-center gap-2 text-sm">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{t.sepaCollection.config.creditorIdLabel}</span>
                <span className="font-mono font-medium">{selectedAccount.creditorId}</span>
              </div>
              {selectedAccount.iban && (
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{t.sepaCollection.config.ibanLabel}</span>
                  <span className="font-mono font-medium">{selectedAccount.iban}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* Collection Date */}
          <div className="space-y-2">
            <Label htmlFor="collectionDate">{t.sepaCollection.config.collectionDate}</Label>
            <Input
              id="collectionDate"
              type="date"
              value={configData.collectionDate}
              onChange={(e) => onChange({ ...configData, collectionDate: e.target.value })}
              min={new Date().toISOString().split('T')[0]}
            />
            <p className="text-xs text-muted-foreground">
              {t.sepaCollection.config.collectionDateHint}
            </p>
          </div>

          {/* Scheme info (fixed CORE) */}
          <div className="space-y-2">
            <Label>{t.sepaCollection.config.scheme}</Label>
            <div className="rounded-lg border bg-muted/50 p-3">
              <span className="font-medium">CORE</span>
              <span className="ml-2 text-sm text-muted-foreground">
                {t.sepaCollection.config.schemeCore}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
