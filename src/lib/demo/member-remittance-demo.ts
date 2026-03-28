import { DEMO_ID_PREFIX } from '@/lib/demo/isDemoOrg';

export const DEMO_MEMBER_REMITTANCE_PENDING_PARENT_ID = `${DEMO_ID_PREFIX}tx_sepa_in_pending_parent_001`;
export const DEMO_MEMBER_REMITTANCE_PROCESSED_PARENT_ID = `${DEMO_ID_PREFIX}tx_sepa_in_parent_001`;
export const DEMO_MEMBER_REMITTANCE_SAMPLE_COUNT = 6;

type DemoMemberRemittanceDonor = {
  id: string;
  name: string;
  taxId: string;
  iban?: string | null;
  monthlyAmount?: number | null;
  membershipType?: string | null;
  status?: string | null;
};

function formatLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDemoMemberRemittanceDate(referenceDate: Date = new Date()): string {
  const seedDate = new Date(referenceDate);
  seedDate.setDate(seedDate.getDate() - 8);
  return formatLocalIsoDate(seedDate);
}

export function selectDemoMemberRemittanceDonors<T extends DemoMemberRemittanceDonor>(
  donors: T[],
  count: number = DEMO_MEMBER_REMITTANCE_SAMPLE_COUNT
): T[] {
  return [...donors]
    .filter((donor) =>
      donor.membershipType === 'recurring' &&
      donor.status !== 'inactive' &&
      !!donor.iban &&
      Number(donor.monthlyAmount ?? 0) > 0
    )
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, count);
}

export function calculateDemoMemberRemittanceTotal<T extends DemoMemberRemittanceDonor>(donors: T[]): number {
  return donors.reduce((sum, donor) => sum + Number(donor.monthlyAmount ?? 0), 0);
}

function formatCsvAmount(amount: number): string {
  return amount.toFixed(2).replace('.', ',');
}

export function buildDemoMemberRemittanceCsv<T extends DemoMemberRemittanceDonor>(
  donors: T[],
  date: string = getDemoMemberRemittanceDate()
): string {
  const header = ['Data', 'Nom', 'DNI/NIF', 'IBAN', 'Import'];
  const rows = donors.map((donor) => ([
    date,
    donor.name,
    donor.taxId,
    donor.iban ?? '',
    formatCsvAmount(Number(donor.monthlyAmount ?? 0)),
  ]));

  return [header, ...rows]
    .map((row) => row.join(';'))
    .join('\n');
}

export function getDemoMemberRemittanceFilename(date: string = getDemoMemberRemittanceDate()): string {
  return `demo-remesa-socis-${date}.csv`;
}
