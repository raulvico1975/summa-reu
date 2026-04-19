/**
 * Parser CSV Stripe — Pas 1
 * Implementació segons /docs/SPEC-IMPORTADOR-STRIPE.md
 *
 * NO dependències externes (papaparse, csv-parser, etc.)
 */

import type {
  ParseResult,
  StripePayoutGroup,
  StripeRow,
  Warning,
} from '@/lib/stripe/types';

export type { ParseResult, StripePayoutGroup, StripeRow, Warning } from '@/lib/stripe/types';

// ════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Columnes obligatòries amb aliases (case-insensitive)
 * Stripe pot exportar "id" o "ID", "Amount" o "amount", etc.
 */
const COLUMN_ALIASES: Record<string, string[]> = {
  'id': ['id', 'ID'],
  'Created date (UTC)': ['Created date (UTC)', 'created date (utc)', 'Created (UTC)'],
  'Amount': ['Amount', 'amount'],
  'Fee': ['Fee', 'fee'],
  'Customer Email': ['Customer Email', 'customer email', 'Email'],
  'Status': ['Status', 'status'],
  'Transfer': ['Transfer', 'transfer'],
  'Amount Refunded': ['Amount Refunded', 'amount refunded', 'Refunded'],
};

const REQUIRED_COLUMNS = Object.keys(COLUMN_ALIASES);

// ════════════════════════════════════════════════════════════════════════════
// PARSER FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Converteix un import en format Stripe a número
 * Format europeu: "1.234,56" → 1234.56 (punt milers, coma decimal)
 * Format anglès:  "1234.56"  → 1234.56 (punt decimal, sense milers)
 *
 * Detecció automàtica: si conté coma → europeu, sinó → anglès
 */
export function parseStripeAmount(value: string): number {
  if (!value || value.trim() === '') return 0;

  const trimmed = value.trim();

  let normalized: string;
  if (trimmed.includes(',')) {
    // Format europeu: 1.234,56 → eliminar punts de milers, coma → punt
    normalized = trimmed.replace(/\./g, '').replace(',', '.');
  } else {
    // Format anglès: 1234.56 → ja està bé
    normalized = trimmed;
  }

  const parsed = parseFloat(normalized);

  if (isNaN(parsed)) {
    throw new Error(`ERR_PARSE_DECIMAL: No s'ha pogut interpretar l'import: ${value}`);
  }

  return parsed;
}

/**
 * Parser CSV minimal sense dependències
 * Suporta:
 * - Separador: ,
 * - Quotes: "..."
 * - Escaped quotes ""
 *
 * NO fa trim dels valors per preservar espais significatius
 */
function parseCsvLine(line: string, separator: ',' | ';'): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote ""
        current += '"';
        i++;
      } else {
        // Toggle quotes
        inQuotes = !inQuotes;
      }
    } else if (char === separator && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  // Afegir últim camp
  result.push(current);

  return result;
}

function detectCsvSeparator(firstLine: string): ',' | ';' {
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  return semicolonCount > commaCount ? ';' : ',';
}

/**
 * Divideix el CSV en línies, respectant quotes multiline i escaped quotes ""
 */
function splitCsvLines(text: string): string[] {
  const lines: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '"') {
      // Gestionar escaped quotes "" (no togglejar, afegir un sol ")
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
        current += char;
      }
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (current.trim()) {
        lines.push(current);
      }
      current = '';
      // Skip \r\n
      if (char === '\r' && text[i + 1] === '\n') {
        i++;
      }
    } else {
      current += char;
    }
  }

  // Afegir última línia
  if (current.trim()) {
    lines.push(current);
  }

  return lines;
}

/**
 * Converteix data UTC de Stripe a format YYYY-MM-DD
 * Input: "2024-12-15 14:30:00" o "2024-12-15T14:30:00Z"
 */
function parseStripeDate(dateStr: string): string {
  if (!dateStr) return '';

  // Agafar només la part de la data (primers 10 caràcters: YYYY-MM-DD)
  const match = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) {
    return match[1];
  }

  // Fallback: intentar parsejar com a Date
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }

  return dateStr;
}

/**
 * Troba l'índex d'una columna donats els seus aliases
 * Fa trim dels headers per comparació (però no modifica l'array original)
 */
function findColumnIndex(headers: string[], aliases: string[]): number {
  for (const alias of aliases) {
    const aliasLower = alias.toLowerCase();
    const idx = headers.findIndex(h => h.trim().toLowerCase() === aliasLower);
    if (idx !== -1) return idx;
  }
  return -1;
}

/**
 * Parser principal del CSV de Stripe
 */
export function parseStripeCsv(text: string): ParseResult {
  const lines = splitCsvLines(text);

  if (lines.length === 0) {
    throw new Error('El fitxer no conté donacions');
  }

  const separator = detectCsvSeparator(lines[0]);

  // Primera línia = headers
  const headers = parseCsvLine(lines[0], separator);

  // Crear mapa d'índexs amb aliases (case-insensitive)
  const colIndex: Record<string, number> = {};
  const missingColumns: string[] = [];

  for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES)) {
    const idx = findColumnIndex(headers, aliases);
    if (idx === -1) {
      missingColumns.push(canonical);
    } else {
      colIndex[canonical] = idx;
    }
  }

  // Validar columnes obligatòries
  if (missingColumns.length > 0) {
    throw new Error(`ERR_NO_COLUMNS: El CSV no té les columnes necessàries: ${missingColumns.join(', ')}`);
  }

  // Buscar columna Description (opcional)
  const descIdx = findColumnIndex(headers, ['Description', 'description']);

  // Només capçalera, sense dades
  if (lines.length === 1) {
    throw new Error('El fitxer no conté donacions');
  }

  const rows: StripeRow[] = [];
  let refundedCount = 0;
  let refundedAmount = 0;

  // Processar files de dades
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i], separator);

    // Saltar files buides (tolerant a files amb menys camps)
    if (values.length === 0) continue;

    // Helper per obtenir valor amb fallback (amb trim per camps estructurats)
    const getValue = (col: string): string => {
      const idx = colIndex[col];
      return idx !== undefined && idx < values.length ? values[idx].trim() : '';
    };

    // Helper per obtenir valor RAW sense trim (per description)
    const getRawValue = (idx: number): string | null => {
      return idx !== -1 && idx < values.length ? values[idx] : null;
    };

    const status = getValue('Status');
    const amountRefundedStr = getValue('Amount Refunded') || '0';
    const amountRefunded = parseStripeAmount(amountRefundedStr);
    const isSuccessful =
      status === 'succeeded' ||
      status === 'paid' ||
      status === 'Paid' ||
      status.trim().toLowerCase() === 'paid';

    // Filtrar: Status no acceptat → excloure silenciosament
    if (!isSuccessful) {
      continue;
    }

    // Filtrar: Amount Refunded > 0 → excloure + warning
    if (amountRefunded > 0) {
      refundedCount++;
      refundedAmount += parseStripeAmount(getValue('Amount') || '0');
      continue;
    }

    // Fila vàlida
    const row: StripeRow = {
      id: getValue('id'),
      createdDate: parseStripeDate(getValue('Created date (UTC)')),
      amount: parseStripeAmount(getValue('Amount') || '0'),
      fee: parseStripeAmount(getValue('Fee') || '0'),
      customerEmail: getValue('Customer Email'),
      status: status,
      transfer: getValue('Transfer'),
      description: getRawValue(descIdx),  // Sense trim per preservar espais
    };

    rows.push(row);
  }

  // Construir warnings
  const warnings: Warning[] = [];
  if (refundedCount > 0) {
    warnings.push({
      code: 'WARN_REFUNDED',
      count: refundedCount,
      amount: refundedAmount,
    });
  }

  return { rows, warnings };
}

// ════════════════════════════════════════════════════════════════════════════
// GROUPING & MATCHING
// ════════════════════════════════════════════════════════════════════════════

/**
 * Agrupa les files per camp Transfer (po_xxx)
 * Cada grup representa un payout de Stripe al banc
 *
 * Ignora files sense Transfer perquè encara no formen part d'un payout.
 *
 * @throws Error si no queda cap fila amb Transfer (ERR_NO_PAYOUT_ROWS)
 */
export function groupStripeRowsByTransfer(rows: StripeRow[]): StripePayoutGroup[] {
  const rowsWithTransfer = rows.filter(r => r.transfer && r.transfer.trim() !== '');
  if (rowsWithTransfer.length === 0) {
    throw new Error(
      "ERR_NO_PAYOUT_ROWS: Aquest export de Stripe encara no conté cap payout conciliable amb el banc."
    );
  }

  const groupMap = new Map<string, StripeRow[]>();

  for (const row of rowsWithTransfer) {
    const transferId = row.transfer;
    const existing = groupMap.get(transferId) || [];
    existing.push(row);
    groupMap.set(transferId, existing);
  }

  const groups: StripePayoutGroup[] = [];

  for (const [transferId, groupRows] of groupMap) {
    const gross = groupRows.reduce((sum, r) => sum + r.amount, 0);
    const fees = groupRows.reduce((sum, r) => sum + r.fee, 0);
    const net = gross - fees;

    groups.push({
      transferId,
      rows: groupRows,
      gross,
      fees,
      net,
    });
  }

  return groups;
}

/**
 * Troba el grup de payout que coincideix amb l'import del banc
 * Tolerància: ±0.02 € (arrodoniments bancaris)
 *
 * @returns El grup si hi ha match únic, null si no hi ha cap match
 * @throws Error si hi ha múltiples matches (ERR_MULTIPLE_MATCHES)
 */
export function findMatchingPayoutGroup(
  groups: StripePayoutGroup[],
  bankAmount: number,
  tolerance: number = 0.02
): StripePayoutGroup | null {
  const matches = groups.filter(g => Math.abs(g.net - bankAmount) <= tolerance);

  if (matches.length === 0) {
    return null;
  }

  if (matches.length === 1) {
    return matches[0];
  }

  // Múltiples matches: error (l'UI ha d'usar findAllMatchingPayoutGroups per gestionar-ho)
  throw new Error(
    `ERR_MULTIPLE_MATCHES: S'han trobat ${matches.length} payouts que coincideixen amb l'import del banc. ` +
    `Usa findAllMatchingPayoutGroups() per obtenir-los tots i permetre selecció manual.`
  );
}

/**
 * Troba tots els grups que coincideixen amb l'import del banc
 * Per quan hi ha múltiples matches i cal mostrar selector
 */
export function findAllMatchingPayoutGroups(
  groups: StripePayoutGroup[],
  bankAmount: number,
  tolerance: number = 0.02
): StripePayoutGroup[] {
  return groups.filter(g => Math.abs(g.net - bankAmount) <= tolerance);
}
