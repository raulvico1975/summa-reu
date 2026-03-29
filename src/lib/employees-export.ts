/**
 * Employees Export Utilities
 *
 * Exportació Excel de la llista de treballadors.
 * Format: columnes amb noms en català per a usuaris.
 */

import * as XLSX from 'xlsx';
import type { Employee } from '@/lib/data';
import { formatIBANDisplay } from '@/lib/normalize';
type ExportLanguage = 'ca' | 'es' | 'fr' | 'pt';

const EMPLOYEES_EXPORT_LABELS = {
  ca: {
    sortLocale: 'ca',
    headers: ['NIF', 'Nom', 'Email', 'Telèfon', 'IBAN', 'Data alta', 'Codi postal', 'Notes'] as const,
    sheetName: 'Treballadors',
    filenamePrefix: 'treballadors',
    templateFilename: 'plantilla_treballadors.xlsx',
    exampleRow: ['12345678A', 'Maria Garcia Lopez', 'maria@exemple.com', '600 123 456', 'ES12 3456 7890 1234 5678 9012', '01/01/2024', '08001', 'Departament administració'] as const,
  },
  es: {
    sortLocale: 'es',
    headers: ['NIF', 'Nombre', 'Email', 'Teléfono', 'IBAN', 'Fecha alta', 'Código postal', 'Notas'] as const,
    sheetName: 'Trabajadores',
    filenamePrefix: 'trabajadores',
    templateFilename: 'plantilla_trabajadores.xlsx',
    exampleRow: ['12345678A', 'María García López', 'maria@exemple.com', '600 123 456', 'ES12 3456 7890 1234 5678 9012', '01/01/2024', '08001', 'Departamento administración'] as const,
  },
} as const;

function normalizeExportLanguage(language?: ExportLanguage): keyof typeof EMPLOYEES_EXPORT_LABELS {
  return language === 'es' ? 'es' : 'ca';
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function formatDate(dateString?: string): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    // Format: DD/MM/YYYY
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return '';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNCIÓ PRINCIPAL: EXPORTAR TREBALLADORS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Genera i descarrega un fitxer Excel amb la llista de treballadors
 */
export function exportEmployeesToExcel(
  employees: Employee[],
  filename?: string,
  language: ExportLanguage = 'ca'
): void {
  const labels = EMPLOYEES_EXPORT_LABELS[normalizeExportLanguage(language)];
  // Ordenar per nom
  const sortedEmployees = [...employees].sort((a, b) =>
    a.name.localeCompare(b.name, labels.sortLocale, { sensitivity: 'base' })
  );

  // Crear workbook
  const wb = XLSX.utils.book_new();

  // Crear worksheet
  const ws = XLSX.utils.aoa_to_sheet([
    [...labels.headers],
    ...sortedEmployees.map((emp) => [
      emp.taxId || '',
      emp.name,
      emp.email || '',
      emp.phone || '',
      emp.iban ? formatIBANDisplay(emp.iban) : '',
      formatDate(emp.startDate),
      emp.zipCode || '',
      emp.notes || '',
    ]),
  ]);

  // Ajustar amplades de columna
  const colWidths = [
    { wch: 12 },  // NIF
    { wch: 30 },  // Nom
    { wch: 28 },  // Email
    { wch: 14 },  // Telèfon
    { wch: 28 },  // IBAN
    { wch: 12 },  // Data alta
    { wch: 10 },  // Codi postal
    { wch: 35 },  // Notes
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
 * Genera i descarrega una plantilla Excel buida per importar treballadors
 */
export function downloadEmployeesTemplate(language: ExportLanguage = 'ca'): void {
  const labels = EMPLOYEES_EXPORT_LABELS[normalizeExportLanguage(language)];

  // Crear workbook
  const wb = XLSX.utils.book_new();

  // Crear worksheet
  const ws = XLSX.utils.aoa_to_sheet([
    [...labels.headers],
    [...labels.exampleRow],
  ]);

  // Ajustar amplades de columna
  const colWidths = [
    { wch: 12 },  // NIF
    { wch: 30 },  // Nom
    { wch: 28 },  // Email
    { wch: 14 },  // Telèfon
    { wch: 28 },  // IBAN
    { wch: 12 },  // Data alta
    { wch: 10 },  // Codi postal
    { wch: 35 },  // Notes
  ];
  ws['!cols'] = colWidths;

  // Afegir worksheet al workbook
  XLSX.utils.book_append_sheet(wb, ws, labels.sheetName);

  // Descarregar
  XLSX.writeFile(wb, labels.templateFilename);
}
