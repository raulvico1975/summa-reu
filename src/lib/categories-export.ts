/**
 * Categories Export Utilities
 *
 * Exportació Excel de categories i plantilla per importació massiva.
 * Format: columnes amb noms en català per a usuaris.
 */

import * as XLSX from 'xlsx';
import type { Category } from '@/lib/data';
type ExportLanguage = 'ca' | 'es' | 'fr' | 'pt';

const CATEGORY_EXPORT_LABELS = {
  ca: {
    sortLocale: 'ca',
    headers: ['Nom', 'Tipus', 'Ordre'] as const,
    sheetName: 'Categories',
    filenamePrefix: 'categories',
    templateFilename: 'plantilla_categories.xlsx',
    typeLabels: { income: 'ingrés', expense: 'despesa' },
    examples: [
      ['Material oficina', 'despesa', 10],
      ['Serveis professionals', 'despesa', 20],
      ['Subministraments', 'despesa', 30],
      ['Donacions', 'ingrés', 10],
      ['Quotes de socis', 'ingrés', 20],
      ['Subvencions', 'ingrés', 30],
    ] as Array<[string, string, number]>,
  },
  es: {
    sortLocale: 'es',
    headers: ['Nombre', 'Tipo', 'Orden'] as const,
    sheetName: 'Categorías',
    filenamePrefix: 'categorias',
    templateFilename: 'plantilla_categorias.xlsx',
    typeLabels: { income: 'ingreso', expense: 'gasto' },
    examples: [
      ['Material de oficina', 'gasto', 10],
      ['Servicios profesionales', 'gasto', 20],
      ['Suministros', 'gasto', 30],
      ['Donaciones', 'ingreso', 10],
      ['Cuotas de socios', 'ingreso', 20],
      ['Subvenciones', 'ingreso', 30],
    ] as Array<[string, string, number]>,
  },
} as const;

function normalizeExportLanguage(language?: ExportLanguage): keyof typeof CATEGORY_EXPORT_LABELS {
  return language === 'es' ? 'es' : 'ca';
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Converteix el tipus intern a format visible per usuaris
 */
function formatTypeDisplay(type: string, language: ExportLanguage): string {
  const labels = CATEGORY_EXPORT_LABELS[normalizeExportLanguage(language)].typeLabels;
  switch (type) {
    case 'income': return labels.income;
    case 'expense': return labels.expense;
    default: return type;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNCIÓ PRINCIPAL: EXPORTAR CATEGORIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Genera i descarrega un fitxer Excel amb la llista de categories
 *
 * @param categories - Llista de categories a exportar
 * @param categoryTranslations - Traduccions de categories (nameKey → nom visible)
 * @param filename - Nom del fitxer (opcional)
 */
export function exportCategoriesToExcel(
  categories: Category[],
  categoryTranslations?: Record<string, string>,
  filename?: string,
  language: ExportLanguage = 'ca'
): void {
  const labels = CATEGORY_EXPORT_LABELS[normalizeExportLanguage(language)];
  // Ordenar per tipus (expense primer), després per ordre, després per nom
  const sortedCategories = [...categories].sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'expense' ? -1 : 1;
    }
    // Ordenar per order (si existeix)
    const orderA = a.order ?? 999999;
    const orderB = b.order ?? 999999;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    // Finalment per nom
    const nameA = categoryTranslations?.[a.name] || a.name;
    const nameB = categoryTranslations?.[b.name] || b.name;
    return nameA.localeCompare(nameB, labels.sortLocale, { sensitivity: 'base' });
  });

  // Crear workbook
  const wb = XLSX.utils.book_new();

  // Crear worksheet
  const ws = XLSX.utils.aoa_to_sheet([
    [...labels.headers],
    ...sortedCategories.map((cat) => [
      categoryTranslations?.[cat.name] || cat.name,
      formatTypeDisplay(cat.type, language),
      cat.order ?? '',
    ]),
  ]);

  // Ajustar amplades de columna
  const colWidths = [
    { wch: 35 },  // Nom
    { wch: 12 },  // Tipus
    { wch: 8 },   // Ordre
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
// FUNCIÓ: DESCARREGAR PLANTILLA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Genera i descarrega una plantilla Excel per importar categories
 * Inclou 6 files d'exemple (3 expense, 3 income)
 */
export function downloadCategoriesTemplate(language: ExportLanguage = 'ca'): void {
  const labels = CATEGORY_EXPORT_LABELS[normalizeExportLanguage(language)];

  // Crear workbook
  const wb = XLSX.utils.book_new();

  // Crear worksheet
  const ws = XLSX.utils.aoa_to_sheet([
    [...labels.headers],
    ...labels.examples,
  ]);

  // Ajustar amplades de columna
  const colWidths = [
    { wch: 35 },  // Nom
    { wch: 12 },  // Tipus
    { wch: 8 },   // Ordre
  ];
  ws['!cols'] = colWidths;

  // Afegir worksheet al workbook
  XLSX.utils.book_append_sheet(wb, ws, labels.sheetName);

  // Descarregar
  XLSX.writeFile(wb, labels.templateFilename);
}
