export interface StripeRow {
  id: string;
  createdDate: string;
  amount: number;
  fee: number;
  customerEmail: string;
  status: string;
  transfer: string;
  description: string | null;
}

export interface Warning {
  code: 'WARN_REFUNDED';
  count: number;
  amount: number;
}

export interface ParseResult {
  rows: StripeRow[];
  warnings: Warning[];
}

export interface StripePayoutGroup {
  transferId: string;
  rows: StripeRow[];
  gross: number;
  fees: number;
  net: number;
}
