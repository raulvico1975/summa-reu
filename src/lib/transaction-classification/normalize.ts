import { removeAccents } from '@/lib/normalize';

const DESCRIPTION_NOISE_TOKENS = new Set([
  'de',
  'del',
  'la',
  'el',
  'los',
  'las',
  'i',
  'y',
  'a',
  'en',
  'amb',
  'per',
  'por',
  'para',
  'sepa',
  'transferencia',
  'transferencies',
  'transferencia',
  'transfer',
  'traspas',
  'traspaso',
  'traspasament',
  'recibo',
  'rebut',
  'pago',
  'pagament',
  'cobro',
  'cobrament',
  'compra',
  'targeta',
  'tarjeta',
  'visa',
  'mastercard',
  'referencia',
  'referenciae2e',
  'referenciae2',
  'ref',
  'concepto',
  'concepte',
  'operacion',
  'operacio',
  'moviment',
  'movimiento',
  'saldo',
  'fecha',
  'data',
  'valor',
  'numero',
  'num',
  'n',
]);

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function normalizeDecisionText(value: string | null | undefined): string {
  if (!value) return '';

  const withoutAccents = removeAccents(value).toLowerCase();

  return normalizeWhitespace(
    withoutAccents
      .replace(/[_/\\|]+/g, ' ')
      .replace(/[^a-z0-9@.\s-]+/g, ' ')
      .replace(/[-]+/g, ' ')
  );
}

function isMostlyNumericNoise(token: string): boolean {
  if (!token) return false;
  if (/^\d{3,}$/.test(token)) return true;
  if (/^[a-z]{0,2}\d{4,}[a-z0-9]*$/.test(token)) return true;
  if (/^\d+[a-z]{0,2}$/.test(token) && token.length >= 5) return true;
  return false;
}

export function tokenizeDecisionDescription(value: string | null | undefined): string[] {
  const normalized = normalizeDecisionText(value);
  if (!normalized) return [];

  return normalized
    .split(' ')
    .filter((token) => token.length >= 2)
    .filter((token) => !DESCRIPTION_NOISE_TOKENS.has(token))
    .filter((token) => !isMostlyNumericNoise(token));
}

export function normalizeDecisionDescription(value: string | null | undefined): string {
  return tokenizeDecisionDescription(value).join(' ');
}

export function extractDecisionEmails(value: string | null | undefined): string[] {
  const raw = String(value ?? '');
  const matches = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];

  return Array.from(
    new Set(
      matches.map((match) => match.toLowerCase().trim())
    )
  );
}

export function extractDecisionIbans(value: string | null | undefined): string[] {
  const raw = String(value ?? '');
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, ' ');
  const matches = compact.match(/\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g) ?? [];

  return Array.from(
    new Set(matches.map((match) => match.trim()))
  );
}

export function extractDecisionSpanishTaxIds(value: string | null | undefined): string[] {
  const raw = String(value ?? '').toUpperCase();
  const compact = raw.replace(/[^A-Z0-9]/g, ' ');
  const matches = compact.match(
    /\b(?:\d{8}[A-Z]|[XYZ]\d{7}[A-Z]|[ABCDEFGHJKLMNPQRSUVW]\d{7}[A-Z0-9])\b/g
  ) ?? [];

  return Array.from(
    new Set(matches.map((match) => match.trim()))
  );
}
