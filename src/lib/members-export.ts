/**
 * Members Export Utilities
 *
 * Exportació Excel de membres i plantilla per invitacions massives.
 * Format: columnes amb noms en català per a usuaris.
 */

import * as XLSX from 'xlsx';
import type { OrganizationMember, Invitation } from '@/lib/data';
type ExportLanguage = 'ca' | 'es' | 'fr' | 'pt';

const MEMBERS_EXPORT_LABELS = {
  ca: {
    sortLocale: 'ca',
    locale: 'ca-ES',
    roleLabels: { admin: 'Administrador', user: 'Usuari', viewer: 'Visualitzador' },
    membersSheet: 'Membres',
    invitesSheet: 'Invitacions',
    pendingInvitesSheet: 'Invitacions pendents',
    membersFilenamePrefix: 'membres',
    pendingInvitesFilenamePrefix: 'invitacions_pendents',
    inviteTemplateFilename: 'plantilla_invitacions.xlsx',
    memberHeaders: ['Nom', 'Email', 'Rol', 'Data alta'] as const,
    inviteHeaders: ['Email', 'Rol', 'Nom'] as const,
    pendingInviteHeaders: ['Email', 'Rol', 'Expira', 'Creada per'] as const,
    inviteExamples: [
      ['maria.garcia@exemple.com', 'Administrador', 'Maria Garcia'],
      ['joan.serra@exemple.com', 'Usuari', 'Joan Serra'],
      ['anna.vila@exemple.com', 'Visualitzador', ''],
    ] as Array<[string, string, string]>,
  },
  es: {
    sortLocale: 'es',
    locale: 'es-ES',
    roleLabels: { admin: 'Administrador', user: 'Usuario', viewer: 'Consulta' },
    membersSheet: 'Miembros',
    invitesSheet: 'Invitaciones',
    pendingInvitesSheet: 'Invitaciones pendientes',
    membersFilenamePrefix: 'miembros',
    pendingInvitesFilenamePrefix: 'invitaciones_pendientes',
    inviteTemplateFilename: 'plantilla_invitaciones.xlsx',
    memberHeaders: ['Nombre', 'Email', 'Rol', 'Fecha alta'] as const,
    inviteHeaders: ['Email', 'Rol', 'Nombre'] as const,
    pendingInviteHeaders: ['Email', 'Rol', 'Caduca', 'Creada por'] as const,
    inviteExamples: [
      ['maria.garcia@exemple.com', 'Administrador', 'María García'],
      ['joan.serra@exemple.com', 'Usuario', 'Joan Serra'],
      ['anna.vila@exemple.com', 'Consulta', ''],
    ] as Array<[string, string, string]>,
  },
} as const;

function normalizeExportLanguage(language?: ExportLanguage): keyof typeof MEMBERS_EXPORT_LABELS {
  return language === 'es' ? 'es' : 'ca';
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Converteix un rol a format visible per usuaris
 */
function formatRoleDisplay(role: string, language: ExportLanguage): string {
  const labels = MEMBERS_EXPORT_LABELS[normalizeExportLanguage(language)].roleLabels;
  switch (role) {
    case 'admin': return labels.admin;
    case 'user': return labels.user;
    case 'viewer': return labels.viewer;
    default: return role;
  }
}

/**
 * Formata una data ISO a format català
 */
function formatDateLocalized(isoDate: string, language: ExportLanguage): string {
  const labels = MEMBERS_EXPORT_LABELS[normalizeExportLanguage(language)];
  try {
    return new Date(isoDate).toLocaleDateString(labels.locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNCIÓ PRINCIPAL: EXPORTAR MEMBRES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Genera i descarrega un fitxer Excel amb la llista de membres
 *
 * @param members - Llista de membres a exportar
 * @param filename - Nom del fitxer (opcional)
 */
export function exportMembersToExcel(
  members: OrganizationMember[],
  filename?: string,
  language: ExportLanguage = 'ca'
): void {
  const labels = MEMBERS_EXPORT_LABELS[normalizeExportLanguage(language)];
  // Ordenar per nom
  const sortedMembers = [...members].sort((a, b) =>
    (a.displayName || a.email).localeCompare(b.displayName || b.email, labels.sortLocale, { sensitivity: 'base' })
  );

  // Crear workbook
  const wb = XLSX.utils.book_new();

  // Crear worksheet
  const ws = XLSX.utils.aoa_to_sheet([
    [...labels.memberHeaders],
    ...sortedMembers.map((member) => [
      member.displayName || '',
      member.email,
      formatRoleDisplay(member.role, language),
      formatDateLocalized(member.joinedAt, language),
    ]),
  ]);

  // Ajustar amplades de columna
  const colWidths = [
    { wch: 30 },  // Nom
    { wch: 35 },  // Email
    { wch: 12 },  // Rol
    { wch: 12 },  // Data alta
  ];
  ws['!cols'] = colWidths;

  // Afegir worksheet al workbook
  XLSX.utils.book_append_sheet(wb, ws, labels.membersSheet);

  // Generar nom de fitxer
  const date = new Date().toISOString().split('T')[0];
  const finalFilename = filename || `${labels.membersFilenamePrefix}_${date}.xlsx`;

  // Descarregar
  XLSX.writeFile(wb, finalFilename);
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNCIÓ: DESCARREGAR PLANTILLA D'INVITACIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Genera i descarrega una plantilla Excel per importar invitacions massives
 * Inclou 2 files d'exemple amb dades realistes
 */
export function downloadMembersInviteTemplate(language: ExportLanguage = 'ca'): void {
  const labels = MEMBERS_EXPORT_LABELS[normalizeExportLanguage(language)];

  // Crear workbook
  const wb = XLSX.utils.book_new();

  // Crear worksheet
  const ws = XLSX.utils.aoa_to_sheet([
    [...labels.inviteHeaders],
    ...labels.inviteExamples,
  ]);

  // Ajustar amplades de columna
  const colWidths = [
    { wch: 35 },  // Email
    { wch: 12 },  // Rol
    { wch: 30 },  // Nom
  ];
  ws['!cols'] = colWidths;

  // Afegir worksheet al workbook
  XLSX.utils.book_append_sheet(wb, ws, labels.invitesSheet);

  // Descarregar
  XLSX.writeFile(wb, labels.inviteTemplateFilename);
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNCIÓ: EXPORTAR INVITACIONS PENDENTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Genera i descarrega un fitxer Excel amb les invitacions pendents
 */
export function exportPendingInvitationsToExcel(
  invitations: Invitation[],
  filename?: string,
  language: ExportLanguage = 'ca'
): void {
  const labels = MEMBERS_EXPORT_LABELS[normalizeExportLanguage(language)];
  // Ordenar per email
  const sortedInvitations = [...invitations].sort((a, b) =>
    (a.email || '').localeCompare(b.email || '', labels.sortLocale, { sensitivity: 'base' })
  );

  // Crear workbook
  const wb = XLSX.utils.book_new();

  // Crear worksheet
  const ws = XLSX.utils.aoa_to_sheet([
    [...labels.pendingInviteHeaders],
    ...sortedInvitations.map((inv) => [
      inv.email || '',
      formatRoleDisplay(inv.role, language),
      formatDateLocalized(inv.expiresAt, language),
      inv.createdBy,
    ]),
  ]);

  // Ajustar amplades de columna
  const colWidths = [
    { wch: 35 },  // Email
    { wch: 12 },  // Rol
    { wch: 12 },  // Expira
    { wch: 30 },  // Creada per
  ];
  ws['!cols'] = colWidths;

  // Afegir worksheet al workbook
  XLSX.utils.book_append_sheet(wb, ws, labels.pendingInvitesSheet);

  // Generar nom de fitxer
  const date = new Date().toISOString().split('T')[0];
  const finalFilename = filename || `${labels.pendingInvitesFilenamePrefix}_${date}.xlsx`;

  // Descarregar
  XLSX.writeFile(wb, finalFilename);
}
