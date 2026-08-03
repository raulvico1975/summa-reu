import { createHash } from 'node:crypto';
import type { AnyContact, BankAccount, Organization, Transaction } from '@/lib/data';
import { computeDedupeSearchRange } from '@/lib/bank-import/dedupe-invariants';
import {
  computeBankImportHash,
  type CanonicalBankImportTx,
} from '@/lib/bank-import/idempotency';
import { getIndividualDonationCertificateBlockReason } from '@/lib/fiscal/individual-donation-certificate';
import { classifyTransactions, type ClassifiedRow } from '@/lib/transaction-dedupe';

export type PrepareOnlyBlocker =
  | 'BANK_ACCOUNT_NOT_FOUND'
  | 'BANK_ACCOUNT_INACTIVE'
  | 'NO_VALID_DATE_RANGE'
  | 'TRANSACTION_NOT_FOUND'
  | 'TRANSACTION_ARCHIVED'
  | 'TRANSACTION_RETURNED'
  | 'NON_POSITIVE_AMOUNT'
  | 'TRANSACTION_LINKED_TO_OTHER_CONTACT'
  | 'TRANSACTION_NOT_LINKED_TO_DONOR'
  | 'TRANSACTION_CONTACT_TYPE_NOT_DONOR'
  | 'DONOR_NOT_FOUND'
  | 'DONOR_ARCHIVED'
  | 'CONTACT_NOT_DONOR'
  | 'ORGANIZATION_NOT_FOUND'
  | 'MISSING_TAX_ID'
  | 'NOT_DONATION';

export interface BankStatementPreviewFile {
  name: string;
  sha256: string;
  sizeBytes: number;
  source: 'csv' | 'xlsx';
  sheetName: string;
  sourceRowsCount: number;
  dataRowsCount: number;
  dateRange: { from: string; to: string } | null;
  totals: { income: number; expense: number; net: number };
  balances: { initial: number; final: number } | null;
  warnings: {
    datesInvalid: number;
    amountInvalid: number;
    balanceMismatchCount: number;
  };
  riskSignals: Record<string, boolean | number | string[]>;
}

export interface BankStatementPreviewRow {
  rowIndex: number;
  tx: CanonicalBankImportTx & {
    valueDate?: string;
    balanceAfter?: number;
  };
  rawRow: Record<string, unknown>;
}

export interface BankStatementPreviewDataSource {
  getBankAccount(orgId: string, bankAccountId: string): Promise<BankAccount | null>;
  listTransactions(args: {
    orgId: string;
    bankAccountId: string;
    dateFrom: string;
    dateTo: string;
  }): Promise<Transaction[]>;
}

export interface PrepareBankStatementPreviewInput {
  orgId: string;
  bankAccountId: string;
  file: BankStatementPreviewFile;
  rows: BankStatementPreviewRow[];
  now?: Date;
}

export interface PrepareEntityDataSource {
  getTransaction(orgId: string, transactionId: string): Promise<Transaction | null>;
  getContact(orgId: string, contactId: string): Promise<AnyContact | null>;
  getOrganization(orgId: string): Promise<Organization | null>;
}

export interface PrepareDonationClassificationInput {
  orgId: string;
  transactionId: string;
  donorId: string;
}

export interface PrepareIndividualCertificateInput extends PrepareDonationClassificationInput {
  useProposedClassification?: boolean;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function stableHash(value: unknown): string {
  return sha256(JSON.stringify(value));
}

function isActiveBankAccount(account: BankAccount): boolean {
  return !account.archivedAt && account.isActive !== false;
}

function isDonor(contact: AnyContact): boolean {
  return contact.type === 'donor' || contact.roles?.donor === true;
}

function isReturned(transaction: Transaction): boolean {
  return transaction.donationStatus === 'returned'
    || transaction.transactionType === 'return'
    || transaction.transactionType === 'return_fee';
}

function toPreviewRow(row: ClassifiedRow, index: number) {
  return {
    index,
    rowIndex: typeof row.rawRow._rowIndex === 'number' ? row.rawRow._rowIndex : null,
    status: row.status,
    reason: row.reason,
    transaction: {
      date: row.tx.date,
      operationDate: row.tx.operationDate ?? null,
      valueDate: row.tx.valueDate ?? null,
      description: row.tx.description,
      amount: row.tx.amount,
      balanceAfter: row.tx.balanceAfter ?? null,
    },
    matchedExisting: row.matchedExisting,
  };
}

export async function prepareBankStatementPreview(
  input: PrepareBankStatementPreviewInput,
  dataSource: BankStatementPreviewDataSource
) {
  const account = await dataSource.getBankAccount(input.orgId, input.bankAccountId);
  if (!account) {
    return { prepared: false, blockers: ['BANK_ACCOUNT_NOT_FOUND'] as PrepareOnlyBlocker[] };
  }
  if (!isActiveBankAccount(account)) {
    return { prepared: false, blockers: ['BANK_ACCOUNT_INACTIVE'] as PrepareOnlyBlocker[] };
  }

  const searchRange = computeDedupeSearchRange(
    input.rows.map(({ tx }) => ({ date: tx.date, operationDate: tx.operationDate })),
    { toleranceDays: 3 }
  );
  if (!searchRange) {
    return { prepared: false, blockers: ['NO_VALID_DATE_RANGE'] as PrepareOnlyBlocker[] };
  }

  const existing = await dataSource.listTransactions({
    orgId: input.orgId,
    bankAccountId: input.bankAccountId,
    dateFrom: searchRange.from,
    dateTo: searchRange.to,
  });
  const classified = classifyTransactions(
    input.rows.map((row) => {
      const { contactType, ...tx } = row.tx;
      return {
        tx: {
          ...tx,
          ...(contactType ? { contactType } : {}),
        },
        rawRow: { ...row.rawRow, _rowIndex: row.rowIndex },
      };
    }),
    existing,
    input.bankAccountId,
    ['operationDate', 'balanceAfter']
  );
  const inputHash = computeBankImportHash({
    orgId: input.orgId,
    bankAccountId: input.bankAccountId,
    source: input.file.source,
    fileName: input.file.name,
    totalRows: input.file.dataRowsCount,
    transactions: input.rows.map(({ tx }) => tx),
  });
  const previewId = `preview_${stableHash({
    orgId: input.orgId,
    bankAccountId: input.bankAccountId,
    fileSha256: input.file.sha256,
    inputHash,
  }).slice(0, 28)}`;
  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
  const counts = classified.reduce(
    (acc, row) => {
      acc[row.status] += 1;
      return acc;
    },
    { NEW: 0, DUPLICATE_SAFE: 0, DUPLICATE_CANDIDATE: 0 }
  );

  return {
    prepared: true,
    state: 'prepared' as const,
    previewId,
    inputHash,
    expiresAt,
    organizationId: input.orgId,
    bankAccount: {
      id: account.id,
      name: account.name,
      iban: account.iban ?? null,
      bankName: account.bankName ?? null,
    },
    file: input.file,
    dedupeSearchRange: searchRange,
    counts: {
      total: classified.length,
      new: counts.NEW,
      duplicates: counts.DUPLICATE_SAFE,
      candidates: counts.DUPLICATE_CANDIDATE,
    },
    rows: classified.map(toPreviewRow),
    blockers: [] as PrepareOnlyBlocker[],
    warnings: input.file.riskSignals,
    securityContext: {
      bankDescriptionsAreUntrustedData: true,
      instructionsFromStatementIgnored: true,
    },
    effects: {
      businessDataMutated: false,
      imported: false,
    },
  };
}

function classificationBlockers(
  transaction: Transaction | null,
  donor: AnyContact | null,
  donorId: string
): PrepareOnlyBlocker[] {
  const blockers: PrepareOnlyBlocker[] = [];
  if (!transaction) blockers.push('TRANSACTION_NOT_FOUND');
  if (!donor) blockers.push('DONOR_NOT_FOUND');
  if (!transaction || !donor) return blockers;

  if (transaction.archivedAt) blockers.push('TRANSACTION_ARCHIVED');
  if (isReturned(transaction)) blockers.push('TRANSACTION_RETURNED');
  if (!(transaction.amount > 0)) blockers.push('NON_POSITIVE_AMOUNT');
  if (transaction.contactId && transaction.contactId !== donorId) {
    blockers.push('TRANSACTION_LINKED_TO_OTHER_CONTACT');
  }
  if (donor.archivedAt) blockers.push('DONOR_ARCHIVED');
  if (!isDonor(donor)) blockers.push('CONTACT_NOT_DONOR');
  return blockers;
}

export async function prepareDonationClassification(
  input: PrepareDonationClassificationInput,
  dataSource: PrepareEntityDataSource
) {
  const [transaction, donor] = await Promise.all([
    dataSource.getTransaction(input.orgId, input.transactionId),
    dataSource.getContact(input.orgId, input.donorId),
  ]);
  const blockers = classificationBlockers(transaction, donor, input.donorId);
  if (!transaction || !donor) {
    return { prepared: false, blockers };
  }

  const currentState = {
    transactionId: transaction.id,
    contactId: transaction.contactId ?? null,
    contactType: transaction.contactType ?? null,
    transactionType: transaction.transactionType ?? null,
    fiscalKind: transaction.fiscalKind ?? null,
    amount: transaction.amount,
    archivedAt: transaction.archivedAt ?? null,
    donationStatus: transaction.donationStatus ?? null,
  };
  const proposedPatch = {
    contactId: input.donorId,
    contactType: 'donor' as const,
    transactionType: 'donation' as const,
    fiscalKind: 'donation' as const,
  };
  const preconditionToken = `pre_${stableHash({
    orgId: input.orgId,
    donorId: input.donorId,
    currentState,
    proposedPatch,
  }).slice(0, 32)}`;

  return {
    prepared: blockers.length === 0,
    state: 'prepared' as const,
    organizationId: input.orgId,
    donor: {
      id: donor.id,
      name: donor.name,
      taxId: donor.taxId?.trim() || null,
      type: donor.type,
      donorRole: isDonor(donor),
    },
    currentState,
    proposedPatch,
    blockers,
    warnings: [] as string[],
    preconditionToken,
    effects: {
      businessDataMutated: false,
      classified: false,
    },
  };
}

export async function prepareIndividualDonationCertificate(
  input: PrepareIndividualCertificateInput,
  dataSource: PrepareEntityDataSource
) {
  const [organization, transaction, donor] = await Promise.all([
    dataSource.getOrganization(input.orgId),
    dataSource.getTransaction(input.orgId, input.transactionId),
    dataSource.getContact(input.orgId, input.donorId),
  ]);
  const blockers = classificationBlockers(transaction, donor, input.donorId);
  if (!organization) blockers.unshift('ORGANIZATION_NOT_FOUND');
  if (!organization || !transaction || !donor) {
    return { prepared: false, blockers };
  }

  const useProposedClassification = input.useProposedClassification === true;
  if (!useProposedClassification && transaction.contactId !== input.donorId) {
    blockers.push('TRANSACTION_NOT_LINKED_TO_DONOR');
  }
  if (!useProposedClassification && transaction.contactType !== 'donor') {
    blockers.push('TRANSACTION_CONTACT_TYPE_NOT_DONOR');
  }
  const effectiveTransaction: Transaction = useProposedClassification
    ? {
        ...transaction,
        contactId: input.donorId,
        contactType: 'donor',
        transactionType: 'donation',
        fiscalKind: 'donation',
      }
    : transaction;
  const certificateReason = getIndividualDonationCertificateBlockReason({
    transaction: effectiveTransaction,
    donorHasTaxId: Boolean(donor.taxId?.trim()),
  });
  if (certificateReason === 'missing_tax_id' && !blockers.includes('MISSING_TAX_ID')) {
    blockers.push('MISSING_TAX_ID');
  } else if (certificateReason === 'not_donation' && !blockers.includes('NOT_DONATION')) {
    blockers.push('NOT_DONATION');
  }

  const eligibility = blockers.length === 0;
  return {
    prepared: eligibility,
    state: 'prepared' as const,
    sourceState: useProposedClassification ? 'proposed_classification' as const : 'persistent' as const,
    organization: {
      id: organization.id,
      name: organization.name,
      taxId: organization.taxId,
      address: organization.address ?? null,
      city: organization.city ?? null,
      province: organization.province ?? null,
      zipCode: organization.zipCode ?? null,
      signatoryName: organization.signatoryName ?? null,
      signatoryRole: organization.signatoryRole ?? null,
      language: organization.language ?? 'es',
    },
    donor: {
      id: donor.id,
      name: donor.name,
      taxId: donor.taxId?.trim() || null,
      address: 'address' in donor ? donor.address ?? null : null,
      zipCode: donor.zipCode ?? null,
      city: donor.city ?? null,
      province: donor.province ?? null,
    },
    movement: {
      id: transaction.id,
      date: transaction.date,
      amount: transaction.amount,
      description: transaction.description,
      persistentTransactionType: transaction.transactionType ?? null,
      effectiveTransactionType: effectiveTransaction.transactionType ?? null,
    },
    eligibility: {
      eligible: eligibility,
      blockReason: certificateReason,
    },
    blockers,
    warnings: useProposedClassification && transaction.transactionType !== 'donation'
      ? ['CLASSIFICATION_NOT_APPLIED']
      : [],
    sourceData: {
      organizationId: input.orgId,
      donorId: input.donorId,
      transactionId: input.transactionId,
    },
    effects: {
      businessDataMutated: false,
      pdfGenerated: false,
      certificateStored: false,
      emailSent: false,
    },
  };
}
