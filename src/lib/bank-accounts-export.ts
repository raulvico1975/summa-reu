/**
 * Bank Accounts Export Utilities
 *
 * Exportació Excel de comptes bancaris.
 * Format: columnes amb noms en català per a usuaris.
 */

import * as XLSX from 'xlsx';
import type { BankAccount } from '@/lib/data';
import { formatIBANDisplay } from '@/lib/normalize';
type ExportLanguage = 'ca' | 'es' | 'fr' | 'pt';

const BANK_ACCOUNT_EXPORT_LABELS = {
  ca: {
    sortLocale: 'ca',
    headers: ['Nom', 'IBAN', 'Banc', 'Per defecte', 'Actiu'] as const,
    yes: 'Sí',
    no: 'No',
    sheetName: 'Comptes bancaris',
    filenamePrefix: 'comptes_bancaris',
    templateFilename: 'plantilla_comptes_bancaris.xlsx',
    examples: [
      ['Compte principal', 'ES12 3456 7890 1234 5678 9012', 'CaixaBank', 'Sí', 'Sí'],
      ['Compte donacions', 'ES98 7654 3210 9876 5432 1098', 'BBVA', 'No', 'Sí'],
    ] as Array<[string, string, string, string, string]>,
  },
  es: {
    sortLocale: 'es',
    headers: ['Nombre', 'IBAN', 'Banco', 'Por defecto', 'Activo'] as const,
    yes: 'Sí',
    no: 'No',
    sheetName: 'Cuentas bancarias',
    filenamePrefix: 'cuentas_bancarias',
    templateFilename: 'plantilla_cuentas_bancarias.xlsx',
    examples: [
      ['Cuenta principal', 'ES12 3456 7890 1234 5678 9012', 'CaixaBank', 'Sí', 'Sí'],
      ['Cuenta donaciones', 'ES98 7654 3210 9876 5432 1098', 'BBVA', 'No', 'Sí'],
    ] as Array<[string, string, string, string, string]>,
  },
} as const;

function normalizeExportLanguage(language?: ExportLanguage): keyof typeof BANK_ACCOUNT_EXPORT_LABELS {
  return language === 'es' ? 'es' : 'ca';
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNCIÓ PRINCIPAL: EXPORTAR COMPTES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Genera i descarrega un fitxer Excel amb els comptes bancaris
 */
export function exportBankAccountsToExcel(
  accounts: BankAccount[],
  filename?: string,
  language: ExportLanguage = 'ca'
): void {
  const labels = BANK_ACCOUNT_EXPORT_LABELS[normalizeExportLanguage(language)];
  // Ordenar: default primer, després per nom
  const sortedAccounts = [...accounts].sort((a, b) => {
    if (a.isDefault && !b.isDefault) return -1;
    if (!a.isDefault && b.isDefault) return 1;
    return a.name.localeCompare(b.name, labels.sortLocale, { sensitivity: 'base' });
  });

  // Crear workbook
  const wb = XLSX.utils.book_new();

  // Crear worksheet
  const ws = XLSX.utils.aoa_to_sheet([
    [...labels.headers],
    ...sortedAccounts.map((acc) => [
      acc.name,
      acc.iban ? formatIBANDisplay(acc.iban) : '',
      acc.bankName || '',
      acc.isDefault ? labels.yes : labels.no,
      acc.isActive === false ? labels.no : labels.yes,
    ]),
  ]);

  // Ajustar amplades de columna
  const colWidths = [
    { wch: 25 },  // Nom
    { wch: 30 },  // IBAN
    { wch: 20 },  // Banc
    { wch: 12 },  // Per defecte
    { wch: 8 },   // Actiu
  ];
  ws['!cols'] = colWidths;

  // Afegir worksheet al workbook
  XLSX.utils.book_append_sheet(wb, ws, labels.sheetName);

  // Generar nom de fitxer
  const date = new Date().toISOString().split('T')[0];
  const finalFilename = filename || `${labels.filenamePrefix}_${date}.xlsx`;

  // Descarregar
  XLSX.writeFile(wb, finalFilename);
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNCIÓ: DESCARREGAR PLANTILLA BUIDA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Genera i descarrega una plantilla Excel buida per importar comptes bancaris
 */
export function downloadBankAccountsTemplate(language: ExportLanguage = 'ca'): void {
  const labels = BANK_ACCOUNT_EXPORT_LABELS[normalizeExportLanguage(language)];

  // Crear workbook
  const wb = XLSX.utils.book_new();

  // Crear worksheet
  const ws = XLSX.utils.aoa_to_sheet([
    [...labels.headers],
    ...labels.examples,
  ]);

  // Ajustar amplades de columna
  const colWidths = [
    { wch: 25 },  // Nom
    { wch: 30 },  // IBAN
    { wch: 20 },  // Banc
    { wch: 12 },  // Per defecte
    { wch: 8 },   // Actiu
  ];
  ws['!cols'] = colWidths;

  // Afegir worksheet al workbook
  XLSX.utils.book_append_sheet(wb, ws, labels.sheetName);

  // Descarregar
  XLSX.writeFile(wb, labels.templateFilename);
}
