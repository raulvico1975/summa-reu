import { createHash } from 'node:crypto';
import { isAbsolute, basename } from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { detectReturnType } from '@/lib/data';
import { resolveBankStatementImportFileType } from '@/lib/importers/bank/import-file-type';
import { selectBankStatementSheet } from '@/lib/importers/bank/selectBankStatementSheet';
import type {
  BankStatementPreviewFile,
  BankStatementPreviewRow,
} from '@/lib/private-integrations/prepare-only';

const MAX_BANK_STATEMENT_BYTES = 20 * 1024 * 1024;

export interface ParsedBankStatementFile {
  file: BankStatementPreviewFile;
  rows: BankStatementPreviewRow[];
}

function parseCsv(bytes: Buffer): unknown[][] {
  const parseText = (text: string) => {
    const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
    const delimiter = (firstLine.match(/;/g) ?? []).length > (firstLine.match(/,/g) ?? []).length
      ? ';'
      : ',';
    const parsed = Papa.parse<unknown[]>(text, {
      header: false,
      skipEmptyLines: false,
      delimiter,
    });
    if (parsed.errors.length > 0 && parsed.data.length === 0) {
      throw new Error('BANK_STATEMENT_CSV_PARSE_FAILED');
    }
    return parsed.data.map((row) => (Array.isArray(row) ? row : []));
  };

  const utf8 = bytes.toString('utf8');
  if (!utf8.includes('\uFFFD')) return parseText(utf8);
  return parseText(bytes.toString('latin1'));
}

function parseExcel(bytes: Buffer) {
  const workbook = XLSX.read(bytes, { type: 'buffer', cellDates: true });
  return workbook.SheetNames.map((name) => ({
    name,
    rows: (XLSX.utils.sheet_to_json(workbook.Sheets[name], {
      header: 1,
      defval: '',
    }) as unknown[][]).map((row) => (Array.isArray(row) ? row : [])),
  }));
}

export async function parseBankStatementFile(
  filePath: string,
  bankAccountId: string
): Promise<ParsedBankStatementFile> {
  const normalizedPath = filePath.trim();
  if (!normalizedPath || !isAbsolute(normalizedPath)) {
    throw new Error('filePath must be an absolute path to one exact file');
  }
  const normalizedBankAccountId = bankAccountId.trim();
  if (!normalizedBankAccountId) throw new Error('bankAccountId is required');

  const fileName = basename(normalizedPath);
  const resolvedType = resolveBankStatementImportFileType(fileName);
  if (!resolvedType) throw new Error('UNSUPPORTED_BANK_STATEMENT_FILE_TYPE');

  const fileInfo = await stat(normalizedPath);
  if (!fileInfo.isFile()) throw new Error('filePath must point to a file');
  if (fileInfo.size === 0) throw new Error('BANK_STATEMENT_FILE_EMPTY');
  if (fileInfo.size > MAX_BANK_STATEMENT_BYTES) throw new Error('BANK_STATEMENT_FILE_TOO_LARGE');

  const bytes = await readFile(normalizedPath);
  const sheets = resolvedType === 'csv'
    ? [{ name: fileName, rows: parseCsv(bytes) }]
    : parseExcel(bytes);
  const selected = selectBankStatementSheet(sheets);
  const rows: BankStatementPreviewRow[] = selected.parsed.rows.map((row) => {
    const transactionType = detectReturnType(row.description) ?? 'normal';
    return {
      rowIndex: row.rowIndex,
      tx: {
        date: `${row.date}T00:00:00.000Z`,
        operationDate: row.operationDate,
        ...(row.valueDate ? { valueDate: row.valueDate } : {}),
        description: row.description,
        amount: row.amount,
        ...(row.balanceAfter !== undefined ? { balanceAfter: row.balanceAfter } : {}),
        category: null,
        document: null,
        contactId: null,
        contactType: null,
        transactionType,
        bankAccountId: normalizedBankAccountId,
        source: 'bank',
      },
      rawRow: {
        operationDate: row.operationDate,
        ...(row.balanceAfter !== undefined ? { balanceAfter: row.balanceAfter } : {}),
      },
    };
  });

  return {
    file: {
      name: fileName,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      sizeBytes: fileInfo.size,
      source: resolvedType === 'csv' ? 'csv' : 'xlsx',
      sheetName: selected.name,
      sourceRowsCount: selected.parsed.summary.sourceRowsCount,
      dataRowsCount: selected.parsed.summary.dataRowsCount,
      dateRange: selected.parsed.summary.dateRange,
      totals: selected.parsed.summary.totals,
      balances: selected.parsed.summary.balances,
      warnings: selected.parsed.summary.warnings,
      riskSignals: selected.parsed.riskSignals,
    },
    rows,
  };
}

export { MAX_BANK_STATEMENT_BYTES };
