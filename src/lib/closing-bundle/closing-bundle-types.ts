/**
 * Tipus per al Paquet de Tancament (client-side)
 */

export interface ClosingBundleRequest {
  orgId: string;
  dateFrom: string; // YYYY-MM-DD
  dateTo: string;   // YYYY-MM-DD
}

export interface ClosingBundleError {
  code: 'UNAUTHENTICATED' | 'UNAUTHORIZED' | 'INVALID_REQUEST' | 'LIMIT_EXCEEDED' | 'NO_TRANSACTIONS' | 'INTERNAL_ERROR';
  message: string;
}

export type PeriodOption = 'current_year' | 'previous_year' | 'current_quarter' | 'custom';

export function getCurrentYearRange(): { dateFrom: string; dateTo: string } {
  const year = new Date().getFullYear();
  return {
    dateFrom: `${year}-01-01`,
    dateTo: `${year}-12-31`,
  };
}

export function getPreviousYearRange(): { dateFrom: string; dateTo: string } {
  const year = new Date().getFullYear() - 1;
  return {
    dateFrom: `${year}-01-01`,
    dateTo: `${year}-12-31`,
  };
}

export function getCurrentQuarterRange(referenceDate: Date = new Date()): {
  dateFrom: string;
  dateTo: string;
} {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const quarterStartMonth = Math.floor(month / 3) * 3;
  const quarterEndMonth = quarterStartMonth + 2;

  const quarterStart = new Date(year, quarterStartMonth, 1);
  const quarterEnd = new Date(year, quarterEndMonth + 1, 0);

  return {
    dateFrom: `${quarterStart.getFullYear()}-${String(quarterStart.getMonth() + 1).padStart(2, '0')}-${String(quarterStart.getDate()).padStart(2, '0')}`,
    dateTo: `${quarterEnd.getFullYear()}-${String(quarterEnd.getMonth() + 1).padStart(2, '0')}-${String(quarterEnd.getDate()).padStart(2, '0')}`,
  };
}
