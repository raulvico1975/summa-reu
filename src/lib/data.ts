// All data is now managed in Firestore. This file only contains type definitions.

// ═══════════════════════════════════════════════════════════════════════════════
// TIPUS BASE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Tipus de transacció per identificar devolucions i imports Stripe
 */
export type TransactionType = 'normal' | 'return' | 'return_fee' | 'donation' | 'fee';
export type FiscalKind = 'donation' | 'non_fiscal' | 'pending_review';

/**
 * Estat d'una donació
 */
export type DonationStatus = 'completed' | 'returned' | 'partial';

export type Transaction = {
  id: string;
  date: string;
  description: string;             // Concepte original del banc (no editable)
  note?: string | null;            // Nota/descripció editable per l'usuari
  amount: number;
  category: string | null;
  document: string | null;
  contactId?: string | null;
  contactType?: ContactType;
  projectId?: string | null;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // CAMPS PER GESTIÓ DE DEVOLUCIONS
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * Tipus de transacció
   * - normal: Transacció normal (ingrés o despesa)
   * - return: Devolució de rebut/donació
   * - return_fee: Comissió bancària per devolució
   */
  transactionType?: TransactionType;

  /**
   * Classificació fiscal explícita de l'ingrés.
   * null/undefined implica compatibilitat legacy.
   */
  fiscalKind?: FiscalKind | null;

  /**
   * Auditoria mínima de classificació fiscal.
   */
  fiscalKindSetAt?: string | null;
  fiscalKindSetByUid?: string | null;
  fiscalKindSetSource?: 'user' | 'system' | null;
  
  /**
   * Estat de la donació (només per ingressos de donants)
   * - completed: Donació cobrada correctament
   * - returned: Donació retornada (rebut devolt)
   * - partial: Parcialment retornada (casos excepcionals)
   */
  donationStatus?: DonationStatus;
  
  /**
   * ID de la transacció original (per devolucions)
   * Permet vincular una devolució amb la donació original
   */
  linkedTransactionId?: string | null;
  
  /**
   * IDs de transaccions vinculades (per devolucions agrupades)
   * Quan un apunt bancari agrupa múltiples devolucions
   */
  linkedTransactionIds?: string[];
  
  /**
   * Indica si aquesta transacció s'ha dividit en múltiples
   * Similar a les remeses dividides
   */
  isSplit?: boolean;

  /**
   * ID de la transacció pare (si és fruit d'una divisió)
   */
  parentTransactionId?: string | null;

  // ═══════════════════════════════════════════════════════════════════════════
  // CAMPS PER GESTIÓ DE REMESES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Indica si aquesta transacció és una remesa agrupada (múltiples quotes en un sol apunt)
   */
  isRemittance?: boolean;

  /**
   * Nombre total de quotes individuals dins la remesa
   * Només té valor si isRemittance = true
   */
  remittanceItemCount?: number;

  /**
   * Nombre de quotes ja resoltes (filles creades)
   */
  remittanceResolvedCount?: number;

  /**
   * Nombre de quotes pendents d'identificar
   */
  remittancePendingCount?: number;

  /**
   * Suma total dels imports pendents en cèntims (positiu)
   */
  remittancePendingTotalAmount?: number;

  /**
   * Import total esperat de la remesa en cèntims (sum de totes les files CSV)
   */
  remittanceExpectedTotalCents?: number;

  /**
   * Import total resolt en cèntims (sum de filles creades)
   */
  remittanceResolvedTotalCents?: number;

  /**
   * Import total pendent en cèntims (sum de pendents)
   */
  remittancePendingTotalCents?: number;

  /**
   * Tipus de remesa
   * - returns: Remesa de devolucions
   * - donations: Remesa de donacions (IN)
   * - payments: Remesa de pagaments (OUT)
   */
  remittanceType?: 'returns' | 'donations' | 'payments';

  /**
   * Direcció de la remesa
   * - IN: Ingressos (donacions)
   * - OUT: Sortides (pagaments)
   */
  remittanceDirection?: 'IN' | 'OUT';

  /**
   * ID del document de remesa associat (per pares i fills)
   * Referència a: organizations/{orgId}/remittances/{remittanceId}
   */
  remittanceId?: string | null;

  /**
   * Indica si aquesta transacció és un element fill d'una remesa
   * Les transaccions amb isRemittanceItem=true es poden ocultar a la taula
   */
  isRemittanceItem?: boolean;

  /**
   * Estat de la remesa
   * - complete: Totes les quotes han estat identificades i assignades
   * - partial: Algunes quotes estan pendents d'identificar
   * - pending: Cap quota ha estat processada encara
   */
  remittanceStatus?: 'complete' | 'partial' | 'pending';

  /**
   * Dades de devolucions pendents d'identificar (només per remeses parcials)
   * Guarda IBAN, import i data per poder assistir l'usuari més tard
   */
  pendingReturns?: Array<{
    iban: string;
    amount: number;
    date: string;
    originalName?: string;
    returnReason?: string;
  }>;

  /**
   * Origen de la transacció
   * - bank: Importada des d'extracte bancari
   * - remittance: Generada al dividir una remesa
   * - manual: Creada manualment per l'usuari
   * - stripe: Importada des de CSV de Stripe
   */
  source?: 'bank' | 'remittance' | 'manual' | 'stripe';

  /**
   * ID del pagament Stripe (ch_xxx)
   * Per traçabilitat i idempotència (evitar duplicats)
   */
  stripePaymentId?: string | null;

  /**
   * ID del transfer/payout de Stripe (po_xxx / tr_xxx)
   * Permet relacionar donacions i comissions del mateix payout
   */
  stripeTransferId?: string | null;

  // ═══════════════════════════════════════════════════════════════════════════
  // CAMPS PER MULTICOMPTES BANCARIS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * ID del compte bancari associat a aquesta transacció
   * - null: transaccions antigues sense compte assignat
   * - string: ID del compte bancari
   */
  bankAccountId?: string | null;
  /** Saldo immediat després del moviment (si el banc el proporciona). */
  balanceAfter?: number;
  /** Data operació en format ISO YYYY-MM-DD (si existeix). */
  operationDate?: string;
  /** Data valor bancària (opcional). */
  valueDate?: string;
  /** Motiu intern de classificació de duplicat en importació (oficial o heurístic). */
  duplicateReason?: string;

  // ═══════════════════════════════════════════════════════════════════════════
  // CAMPS PER SOFT-DELETE (TRANSACCIONS FISCALS)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Timestamp ISO quan la transacció va ser arxivada (soft-delete)
   * null = no arxivada (activa)
   */
  archivedAt?: string | null;

  /**
   * UID de l'usuari que va arxivar la transacció
   */
  archivedByUid?: string | null;

  /**
   * Motiu de l'arxivat
   */
  archivedReason?: string | null;

  /**
   * Acció que va provocar l'arxivat
   * - user_delete: L'usuari va intentar eliminar
   * - superadmin_cleanup: SuperAdmin va fer neteja
   */
  archivedFromAction?: 'user_delete' | 'superadmin_cleanup' | null;
};

export type Category = {
  id: string;
  name: string;
  type: 'income' | 'expense';
  order?: number;  // Ordre de visualització (opcional)

  /** Clau invariant per categories de sistema (ex: 'missionTransfers'). No editable. */
  systemKey?: string | null;

  // ═══════════════════════════════════════════════════════════════════════════
  // CAMPS D'ARXIVAT (soft-delete) — v1.35
  // Només escriptura via API /api/categories/archive (Admin SDK)
  // ═══════════════════════════════════════════════════════════════════════════

  /** Timestamp quan arxivada (null = activa) */
  archivedAt?: FirebaseFirestore.Timestamp | null;
  /** UID de l'usuari que va arxivar */
  archivedByUid?: string | null;
  /** Traça de l'acció que va provocar l'arxivat */
  archivedFromAction?: 'archive-category-api' | null;
};

export type Project = {
  id: string;
  name: string;
  funderId: string | null;

  // ═══════════════════════════════════════════════════════════════════════════
  // CAMPS D'ARXIVAT (soft-delete) — v1.35
  // Només escriptura via API /api/projects/archive (Admin SDK)
  // ═══════════════════════════════════════════════════════════════════════════

  /** Timestamp quan arxivat (null = actiu) */
  archivedAt?: FirebaseFirestore.Timestamp | null;
  /** UID de l'usuari que va arxivar */
  archivedByUid?: string | null;
  /** Traça de l'acció que va provocar l'arxivat */
  archivedFromAction?: 'archive-project-api' | null;
};

// ═══════════════════════════════════════════════════════════════════════════════
// TIPUS PER SEPA DIRECT DEBIT (pain.008)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Esquema SEPA per adeudos directos
 * - CORE: Particulars i empreses (v1)
 * - B2B: Empreses (Business-to-Business, v2)
 */
export type SepaScheme = 'CORE' | 'B2B';

/**
 * Tipus de seqüència SEPA
 * - FRST: Primer cobrament d'un mandat recurrent
 * - RCUR: Cobraments successius recurrents
 * - OOFF: Cobrament únic (one-off)
 * - FNAL: Últim cobrament d'una sèrie
 */
export type SepaSequenceType = 'FRST' | 'RCUR' | 'OOFF' | 'FNAL';

/**
 * Mandat SEPA per a domiciliació bancària.
 * Permet cobrar directament del compte del donant/soci.
 */
export interface SepaMandate {
  scheme: SepaScheme;                      // CORE (v1) o B2B (v2)
  umr: string;                             // Unique Mandate Reference (obligatori)
  signatureDate: string;                   // YYYY-MM-DD (data signatura, obligatori)
  isActive: boolean;                       // true per defecte
  lastCollectedAt?: string | null;         // YYYY-MM-DD (última execució, per seqüència)
  sequenceTypeOverride?: SepaSequenceType | null;  // Override manual si cal
}

// ═══════════════════════════════════════════════════════════════════════════════
// SISTEMA DE CONTACTES (Donants + Proveïdors)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Tipus de contacte
 */
export type ContactType = 'donor' | 'supplier' | 'employee';

/**
 * Rols d'un contacte (per suportar persones amb múltiples rols, ex: Mario employee+donor)
 * Camp progressiu: si no existeix, només té el rol de `type`
 */
export type ContactRoles = {
  donor?: boolean;
  supplier?: boolean;
  employee?: boolean;
};

/**
 * Model base comú per tots els contactes
 * S'emmagatzema a: organizations/{orgId}/contacts/{contactId}
 */
export type Contact = {
  id: string;
  type: ContactType;               // Rol primari (compatibilitat UI)
  roles?: ContactRoles;            // Rols addicionals (progressiu, no disruptiu)
  name: string;
  taxId: string;                   // DNI/CIF
  zipCode: string;                 // Codi postal
  city?: string;                   // Ciutat
  province?: string;               // Província
  iban?: string;                   // IBAN (opcional, per pagaments/reemborsaments)
  createdAt: string;
  updatedAt?: string;
  defaultCategoryId?: string;      // Categoria per defecte per auto-assignar a transaccions
  // v1.36 archive fields
  archivedAt?: string;             // Soft-delete timestamp (ISO date)
  archivedByUid?: string;          // UID de qui ha arxivat
  archivedFromAction?: string;     // Traça: 'archive-contact-api'
};

/**
 * Estat d'un donant/soci
 */
export type DonorStatus = 'active' | 'pending_return' | 'inactive';

/**
 * Donant - Persona o entitat que fa donacions
 * Camps específics per a la gestió de donants i Model 182
 */
export type Donor = Contact & {
  type: 'donor';
  // Classificació
  donorType: 'individual' | 'company';       // Persona física o jurídica
  // Tipus de donació
  membershipType: 'one-time' | 'recurring';  // Puntual o recurrent (soci)
  // Dades per socis recurrents
  // Adreça completa (per certificats de donació)
  address?: string;
  monthlyAmount?: number;                    // Import mensual/periòdic
  memberSince?: string;                      // Data d'alta com a soci
  // Dades bancàries (per domiciliacions)
  iban?: string;
  // Contacte
  email?: string;
  phone?: string;
  // Notes
  notes?: string;

  // Persona de contacte (només per empreses)
  contactPersonName?: string | null;

  // ═══════════════════════════════════════════════════════════════════════════
  // CAMPS PER GESTIÓ DE DEVOLUCIONS
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * Estat del donant
   * - active: Tot correcte
   * - pending_return: Té devolucions pendents de resoldre
   * - inactive: Donat de baixa o massa devolucions
   */
  status?: DonorStatus;

  /**
   * Data de baixa (quan status = 'inactive')
   */
  inactiveSince?: string;

  /**
   * Comptador de devolucions
   * Per generar alertes quan supera un llindar
   */
  returnCount?: number;
  
  /**
   * Data de l'última devolució
   */
  lastReturnDate?: string;

  // ═══════════════════════════════════════════════════════════════════════════
  // CAMPS PER SEPA DIRECT DEBIT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Mandat SEPA per domiciliació bancària
   * Si existeix i isActive=true, el donant es pot incloure en remeses SEPA
   */
  sepaMandate?: SepaMandate | null;

  // ═══════════════════════════════════════════════════════════════════════════
  // CAMPS PER PERIODICITAT I TRACKING PAIN.008
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Periodicitat de la quota del soci (només per membershipType === 'recurring')
   * - monthly: Mensual
   * - quarterly: Trimestral
   * - semiannual: Semestral
   * - annual: Anual
   * - manual: L'entitat decideix quan cobrar
   * - null: No definida (es tracta com monthly per defecte)
   */
  periodicityQuota?: 'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'manual' | null;

  /**
   * Data de l'última execució pain.008 que va incloure aquest donant
   * Format: YYYY-MM-DD
   */
  sepaPain008LastRunAt?: string | null;

  /**
   * ID del document sepaPain008Runs que va incloure aquest donant
   */
  sepaPain008LastRunId?: string | null;
};

/**
 * Proveïdor - Empresa o professional que presta serveis o ven productes
 */
export type Supplier = Contact & {
  type: 'supplier';
  // Classificació
  category?: string;                         // Serveis, materials, subministraments...
  // Dades fiscals i de contacte
  address?: string;                          // Adreça completa
  email?: string;
  phone?: string;
  // Dades bancàries (per fer pagaments)
  iban?: string;
  // Condicions
  paymentTerms?: string;                     // Ex: "30 dies", "Al comptat"
  // Notes
  notes?: string;
};

/**
 * Tipus unió per quan necessitem treballar amb qualsevol tipus de contacte
 */
/**
 * Treballador - Persona contractada per l'entitat
 */
export type Employee = Contact & {
  type: 'employee';
  // Dades bancàries (per pagar nòmines)
  iban?: string;
  // Data d'alta
  startDate?: string;
  // Contacte
  email?: string;
  phone?: string;
  // Notes
  notes?: string;
};
export type AnyContact = Donor | Supplier | Employee;

// ═══════════════════════════════════════════════════════════════════════════════
// TIPUS LEGACY (per compatibilitat - DEPRECAT)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @deprecated Usar Donor o Supplier en lloc d'Emisor
 * Mantingut temporalment per compatibilitat amb codi existent
 */
export type Emisor = {
  id: string;
  name: string;
  taxId: string;
  zipCode: string;
  type: 'donor' | 'supplier' | 'volunteer';
};

// ═══════════════════════════════════════════════════════════════════════════════
// TIPUS PER MULTI-ORGANITZACIÓ
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Estats possibles d'una organització
 */
export type OrganizationStatus = 'active' | 'suspended' | 'pending';

/**
 * Idiomes suportats per l'organització (certificats, emails, etc.)
 */
export type OrganizationLanguage = 'ca' | 'es';

/**
 * Feature flags per organització.
 * Permet activar/desactivar mòduls opcionals.
 */
export type OrganizationFeatures = {
  projectModule?: boolean;         // Mòdul de projectes i justificació econòmica
  pendingDocs?: boolean;           // Documents pendents de conciliació (factures/nòmines pre-banc)
  expenseReports?: {
    kmRateDefault?: number;        // Tarifa €/km per defecte per quilometratge (ex: 0.19)
  };
};

/**
 * Representa una organització (entitat social).
 * S'emmagatzema a: organizations/{orgId}
 */
export type Organization = {
  id: string;
  name: string;                    // Nom complet de l'entitat
  slug: string;                    // URL-friendly identifier
  taxId: string;                   // CIF
  // Estat i control
  status: OrganizationStatus;      // Estat de l'organització
  createdAt: string;
  createdBy: string;               // UID del Super Admin que la va crear
  // Dades opcionals
  address?: string;
  city?: string;
  province?: string;
  zipCode?: string;
  phone?: string;
  email?: string;
  website?: string;
  // Branding i certificats
  logoUrl?: string;                // URL del logo (Firebase Storage)
  signatureUrl?: string;           // URL de la firma digitalitzada (Firebase Storage)
  signatoryName?: string;          // Nom del signant (ex: "Maria Garcia López")
  signatoryRole?: string;          // Càrrec del signant (ex: "Presidenta")
  // Configuració d'alertes
  contactAlertThreshold?: number;  // Llindar mínim (€) per alertes de moviments sense contacte (default: 50)
  // Configuració d'idioma
  language?: OrganizationLanguage; // Idioma per certificats i emails (default: 'es')
  returnEmailTemplate?: string | null; // Plantilla del correu de devolucions (fallback al sistema si null/absent)
  // Feature flags
  features?: OrganizationFeatures; // Mòduls opcionals activats/desactivats
  // Onboarding
  onboarding?: {
    welcomeSeenAt?: string;        // Data (YYYY-MM-DD) quan el primer admin va veure la modal
  };
  // Metadata
  updatedAt?: string;
  suspendedAt?: string;
  suspendedReason?: string;
  // Demo
  isDemo?: boolean;                // true només per l'org demo (entorn de demostració)
};

/**
 * Representa un membre d'una organització.
 * S'emmagatzema a: organizations/{orgId}/members/{userId}
 */
export type OrganizationMember = {
  userId: string;
  email: string;
  displayName: string;
  role: OrganizationRole;
  joinedAt: string;
  invitedBy?: string;              // UID de qui el va convidar
  invitationId?: string;           // ID de la invitació (obligatori per self-join via regles)
  userOverrides?: {
    deny?: string[];
  };
  userGrants?: string[];
};

/**
 * Rols disponibles dins una organització.
 * - admin: Control total de l'organització
 * - user: Gestió financera (transaccions, contactes, informes)
 * - viewer: Només lectura
 */
export type OrganizationRole = 'admin' | 'user' | 'viewer';

/**
 * Etiquetes dels rols per mostrar a la UI
 */
export const ROLE_LABELS: Record<OrganizationRole, string> = {
  admin: 'Administrador',
  user: 'Usuari',
  viewer: 'Només lectura',
};

/**
 * Perfil d'usuari global.
 * S'emmagatzema a: users/{userId}
 * Conté la referència a l'organització principal (per login directe)
 */
export type UserProfile = {
  organizationId: string;          // Organització principal/per defecte
  role: OrganizationRole;
  displayName: string;
  email?: string;
  // Per usuaris amb múltiples organitzacions
  organizations?: string[];        // Array d'IDs d'organitzacions
};

/**
 * UID del Super Admin (pot accedir a tot)
 */
export const SUPER_ADMIN_UID = 'f2AHJqjXiOZkYajwkOnZ8RY6h2k2';


// ═══════════════════════════════════════════════════════════════════════════════
// TIPUS PER SISTEMA D'INVITACIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Representa una invitació per unir-se a una organització.
 */
export type Invitation = {
  id: string;
  token: string;
  organizationId: string;
  organizationName: string;
  role: OrganizationRole;
  userOverrides?: {
    deny?: string[];
  };
  userGrants?: string[];
  createdAt: string;
  expiresAt: string;
  createdBy: string;
  email?: string;
  usedAt?: string;
  usedBy?: string;
};

/**
 * Estat d'una invitació
 */
export type InvitationStatus = 'pending' | 'used' | 'expired';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS I HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Categories predefinides per proveïdors
 */
export const SUPPLIER_CATEGORIES = [
  'services',      // Serveis professionals
  'utilities',     // Subministraments (llum, aigua, gas)
  'materials',     // Materials i equipament
  'rent',          // Lloguer
  'insurance',     // Assegurances
  'banking',       // Serveis bancaris
  'communications', // Telecomunicacions
  'transport',     // Transport i missatgeria
  'maintenance',   // Manteniment
  'other',         // Altres
] as const;

export type SupplierCategory = typeof SUPPLIER_CATEGORIES[number];

// ═══════════════════════════════════════════════════════════════════════════════
// PATRONS DE DETECCIÓ DE DEVOLUCIONS PER BANC
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Patrons per detectar devolucions als extractes bancaris
 * Cada banc té el seu format específic
 */
export const RETURN_PATTERNS = {
  // Devolucions (alta confiança)
  return: [
    /\bADEUDO\s+DEVOLUCION(?:ES)?\s+RECIBOS?\b/,       // Triodos: "ADEUDO DEVOLUCION RECIBOS"
    /\bDEVOLUCION(?:ES)?(?:\s+DE)?\s+RECIBOS?\b/,      // Santander: "DEVOLUCION DE RECIBO(S)"
    /\bDEV\s+RECIBOS?\b/,                              // CaixaBank: "DEV.RECIBO ADEUDO SEPA"
    /\bRECIBOS?\s+DEVUELT[OA]S?\b/,                    // "RECIBO DEVUELTO"
    /\bRECIBOS?\s+IMPAGAD[OA]S?\b/,                    // "RECIBO IMPAGADO"
    /\bRECIBOS?\s+RECHAZAD[OA]S?\b/,                   // "RECIBOS RECHAZADOS"
    /\bRECHAZAD[OA]S?\s+RECIBOS?\b/,                   // "RECHAZADOS RECIBOS"
    /\bRECHAZO\s+RECIBOS?\b/,                          // "RECHAZO RECIBO"
    /\bREBUTS?\s+REBUTJAT(?:S|A|ES)?\b/,               // "REBUTS REBUTJATS"
    /\bRETORNO\s+RECIBOS?\b/,                          // "RETORNO RECIBO"
    /\bADEUDO\s+SEPA\s+DEV\b/,                         // "ADEUDO SEPA DEV"
    /\bSEPA\s+DD\s+RETURN(?:ED)?\b/,                   // "SEPA DD RETURN"
    /\bRETURNED\s+DIRECT\s+DEBIT\b/,                   // Bancs internacionals
    /\bR[\s-]?TRANSACTION\b/,                          // Codis operatius
  ],
  // Comissions per devolució (alta confiança)
  returnFee: [
    /\bCOMISION(?:ES)?\s+DEV\b/,                       // Triodos: "COMISION DEV. RECIBOS"
    /\bCOMISION(?:ES)?\s+DEVOL\b/,                     // Triodos: "COMISION DEVOL. RECIBOS"
    /\bCOMISION(?:ES)?\s+DEVOLUCION(?:ES)?\b/,         // "COMISION DEVOLUCION"
    /\bGASTOS?\s+DEVOLUCION(?:ES)?\b/,                 // Santander: "GASTOS DEVOLUCIONES"
    /\bCOMISION(?:ES)?\s+POR\s+DEVOLUCION(?:ES)?\b/,   // "COMISION POR DEVOLUCION"
    /\bRETURN\s+FEE\b/,                                // Bancs internacionals
    /\bR[\s-]?TRANSACTION\s+FEE\b/,                    // Codis operatius
    /\bRJCT\s+FEE\b/,                                  // Codis operatius
  ],
  // Exclusions per evitar falsos positius (p. ex. devolucions de targeta/compra)
  exclude: [
    /\bDEVOLUCION(?:ES)?\s+COMPRA\b/,
    /\bABONO\s+TARJETA\b/,
    /\bREEMBOLSO\s+TARJETA\b/,
    /\bCARD\s+REFUND\b/,
  ],
} as const;

const RETURN_SIGNAL_PATTERNS = [
  /\bDEV\b/,
  /\bDEVOLUCION(?:ES)?\b/,
  /\bDEVUELT[OA]S?\b/,
  /\bRECHAZO\b/,
  /\bRECHAZAD[OA]S?\b/,
  /\bREBUTJAT(?:S|A|ES)?\b/,
  /\bRETORNO\b/,
  /\bIMPAGAD[OA]S?\b/,
  /\bRETURN(?:ED)?\b/,
  /\bRJCT\b/,
  /\bR[\s-]?TRANSACTION\b/,
] as const;

const RETURN_CONTEXT_PATTERNS = [
  /\bRECIBOS?\b/,
  /\bREBUTS?\b/,
  /\bADEUDO\b/,
  /\bCUOTAS?\b/,
  /\bQUOTES?\b/,
  /\bDOMICILIACION(?:ES)?\b/,
  /\bSEPA\b/,
  /\bDIRECT\s+DEBIT\b/,
  /\bDD\b/,
] as const;

const RETURN_FEE_CONTEXT_PATTERNS = [
  /\bCOMISION(?:ES)?\b/,
  /\bGASTOS?\b/,
  /\bFEE\b/,
  /\bCOSTE\b/,
] as const;

function normalizeDescriptionForReturnDetection(description: string): string {
  if (!description) return '';

  return description
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesAnyPattern(value: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

/**
 * Detecta si una descripció correspon a una devolució
 * @returns 'return' | 'return_fee' | null
 */
export function detectReturnType(description: string): TransactionType | null {
  const normalized = normalizeDescriptionForReturnDetection(description);
  if (!normalized) return null;

  // Exclusions explícites abans de qualsevol classificació
  if (matchesAnyPattern(normalized, RETURN_PATTERNS.exclude)) {
    return null;
  }

  // Primer comprovar si és una comissió (més específic)
  if (matchesAnyPattern(normalized, RETURN_PATTERNS.returnFee)) {
    return 'return_fee';
  }

  // Heurística robusta per comissions no cobertes per patró estricte
  const hasReturnSignal = matchesAnyPattern(normalized, RETURN_SIGNAL_PATTERNS);
  const hasFeeContext = matchesAnyPattern(normalized, RETURN_FEE_CONTEXT_PATTERNS);
  if (hasReturnSignal && hasFeeContext) {
    return 'return_fee';
  }

  // Després comprovar devolució estricta
  if (matchesAnyPattern(normalized, RETURN_PATTERNS.return)) {
    return 'return';
  }

  // Heurística robusta per devolucions (senyal + context rebut/SEPA)
  const hasReturnContext = matchesAnyPattern(normalized, RETURN_CONTEXT_PATTERNS);
  if (hasReturnSignal && hasReturnContext) {
    return 'return';
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIPUS PER MULTICOMPTES BANCARIS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Representa un compte bancari d'una organització.
 * S'emmagatzema a: organizations/{orgId}/bankAccounts/{bankAccountId}
 */
export type BankAccount = {
  id: string;
  name: string;                    // Nom identificatiu (obligatori)
  iban: string | null;             // IBAN normalitzat (opcional)
  bankName: string | null;         // Nom del banc (opcional)
  isDefault: boolean | null;       // Compte per defecte
  isActive: boolean | null;        // Compte actiu (per soft-delete legacy)
  createdAt: string;               // ISO date
  updatedAt: string;               // ISO date
  // SEPA Direct Debit
  creditorId?: string | null;      // Identificador de creditor SEPA (ex: ES21001G70782933)
  // Camps d'arxivat (v1.36 - guardrails integritat)
  archivedAt?: import('firebase/firestore').Timestamp | null;
  archivedByUid?: string | null;
  archivedFromAction?: string | null;
};

// ═══════════════════════════════════════════════════════════════════════════════
// SEPA COLLECTION RUNS (Remeses de cobrament SEPA)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Estat d'una execució de remesa SEPA
 */
export type SepaCollectionRunStatus = 'draft' | 'exported' | 'sent' | 'processed';

/**
 * Element individual d'una remesa SEPA (un cobrament)
 */
export interface SepaCollectionItem {
  donorId: string;                         // ID del donant/soci
  donorName: string;                       // Nom del donant (snapshot)
  donorTaxId: string;                      // DNI/CIF (snapshot)
  iban: string;                            // IBAN del donant
  amountCents: number;                     // Import en cèntims
  umr: string;                             // Unique Mandate Reference
  signatureDate: string;                   // Data signatura mandat (YYYY-MM-DD)
  sequenceType: SepaSequenceType;          // FRST, RCUR, OOFF, FNAL
  endToEndId: string;                      // Identificador únic de la transacció
}

/**
 * Execució d'una remesa de cobrament SEPA (pain.008)
 * S'emmagatzema a: organizations/{orgId}/sepaCollectionRuns/{runId}
 */
export interface SepaCollectionRun {
  id: string;
  status: SepaCollectionRunStatus;
  scheme: SepaScheme;                      // CORE o B2B
  bankAccountId: string;                   // ID del compte bancari creditor
  creditorId: string;                      // Identificador de creditor SEPA (snapshot)
  creditorName: string;                    // Nom de l'organització (snapshot)
  creditorIban: string;                    // IBAN del creditor (snapshot)
  requestedCollectionDate: string;         // Data de cobrament sol·licitada (YYYY-MM-DD)
  items: SepaCollectionItem[];             // Cobraments individuals
  totalAmountCents: number;                // Suma total en cèntims
  totalCount: number;                      // Nombre de cobraments
  messageId: string;                       // MsgId del XML (per traçabilitat)
  createdAt: string;                       // ISO date
  createdBy: string;                       // UID de l'usuari
  exportedAt?: string | null;              // Data d'exportació del XML
  sentAt?: string | null;                  // Data d'enviament al banc
  processedAt?: string | null;             // Data de processament
}

/**
 * Registre operatiu d'una execució pain.008 (memòria de runs)
 * S'emmagatzema a: organizations/{orgId}/sepaPain008Runs/{runId}
 *
 * Objectiu: traçabilitat de "quins donants van entrar en aquest pain"
 * NO crea transactions ni afecta fiscalitat/conciliació
 */
export interface SepaPain008Run {
  id: string;
  createdAt: import('firebase/firestore').Timestamp;  // serverTimestamp()
  createdByUid: string;                               // UID de l'usuari
  bankAccountId: string;                              // ID del compte bancari creditor
  executionDate: string;                              // Data de cobrament (YYYY-MM-DD)
  includedDonorIds: string[];                         // IDs dels donants inclosos
  counts: {
    shown: number;                                    // Mostrats al wizard
    selected: number;                                 // Seleccionats per l'usuari
    included: number;                                 // Inclosos al fitxer final
    invalidIban: number;                              // Exclosos per IBAN invàlid
    invalidAmount: number;                            // Exclosos per import invàlid
  };
  totalAmountCents: number;                           // Import total en cèntims
  filtersSnapshot?: {                                 // Filtres aplicats (per auditoria)
    periodicity?: string | null;
    search?: string | null;
  } | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REMESES - QUOTES PENDENTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Motiu pel qual una quota de remesa està pendent
 */
export type RemittancePendingReason =
  | 'NO_TAXID'        // Fila sense DNI/CIF vàlid (legacy mode OUT)
  | 'INVALID_DATA'    // Dades invàlides (import negatiu, nom buit, etc.)
  | 'NO_MATCH'        // No s'ha trobat coincidència amb cap donant existent (legacy)
  | 'DUPLICATE'       // Fila duplicada dins la mateixa remesa
  // P0: Nous motius per mode IN (IBAN-first)
  | 'NO_IBAN_MATCH'   // IBAN no trobat a Summa
  | 'AMBIGUOUS_IBAN'; // IBAN duplicat (>1 donant)

/**
 * Element pendent d'una remesa IN (quota no processada)
 * S'emmagatzema a: organizations/{orgId}/remittances/{remittanceId}/pending/{pendingId}
 */
export type RemittancePendingItem = {
  id: string;
  nameRaw: string;                        // Nom original del CSV
  taxId: string | null;                   // DNI/CIF (pot ser null o invàlid)
  iban: string | null;                    // IBAN (pot ser null)
  amountCents: number;                    // Import en cèntims (sempre positiu per IN)
  reason: RemittancePendingReason;        // Motiu del pendent
  sourceRowIndex: number;                 // Índex de la fila original al CSV (per debug)
  createdAt: string;                      // ISO date
  // P0: Donants candidats per IBAN ambigu (selecció manual)
  ambiguousDonorIds?: string[];           // IDs dels donants amb IBAN duplicat
};
