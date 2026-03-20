import type { Transaction } from '@/lib/data';

export type IndividualCertificateBlockReason =
  | 'missing_tax_id'
  | 'missing_email'
  | 'archived'
  | 'not_donation'
  | 'returned'
  | 'non_positive_amount';

interface IndividualCertificateEligibilityInput {
  transaction: Pick<Transaction, 'amount' | 'archivedAt' | 'donationStatus' | 'transactionType'>;
  donorHasTaxId: boolean;
  donorHasEmail?: boolean;
}

export function getIndividualDonationCertificateBlockReason(
  input: IndividualCertificateEligibilityInput
): IndividualCertificateBlockReason | null {
  const { transaction, donorHasTaxId, donorHasEmail = true } = input;

  if (!donorHasTaxId) {
    return 'missing_tax_id';
  }
  if (!donorHasEmail) {
    return 'missing_email';
  }
  if (transaction.archivedAt) {
    return 'archived';
  }
  if (transaction.transactionType !== 'donation') {
    return 'not_donation';
  }
  if (transaction.donationStatus === 'returned') {
    return 'returned';
  }
  if (!(transaction.amount > 0)) {
    return 'non_positive_amount';
  }

  return null;
}

export function getIndividualDonationCertificateBlockMessage(
  reason: IndividualCertificateBlockReason
): string {
  switch (reason) {
    case 'missing_tax_id':
      return 'Cal informar el NIF/CIF del donant per generar el certificat.';
    case 'missing_email':
      return 'Cal informar un email del donant per enviar el certificat.';
    case 'archived':
      return 'Aquesta donació està arxivada i no és certificable.';
    case 'not_donation':
      return 'Aquest moviment no és una donació fiscal certificable.';
    case 'returned':
      return 'Aquesta donació consta com retornada i no es pot certificar.';
    case 'non_positive_amount':
      return 'L’import de la donació ha de ser superior a 0 € per poder certificar-la.';
  }
}
