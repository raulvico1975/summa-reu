/**
 * Seed Demo Data
 *
 * IMPORTANT: DEMO beta interna.
 * No modificar volums ni anomalies sense decisió de producte.
 * Invariants protegits per assertions al final de runDemoSeed().
 *
 * Funció principal per regenerar totes les dades demo.
 *
 * Fluxe:
 * 1. Purgar dades existents amb isDemoData: true
 * 2. Crear/actualitzar org demo
 * 3. Generar i escriure noves dades
 *
 * Volums (actualitzats):
 * - Donants: 50
 * - Proveïdors: 20
 * - Treballadors: 8
 * - Transaccions bank: 100 (exacte)
 * - Projectes: 4
 * - Partides/projecte: 10
 * - Despeses off-bank: 30 (10 XOF, 10 HNL, 10 DOP)
 * - Assignacions: 20 (10 full + 10 mixed)
 * - PDFs Storage: 20
 */

import type { Firestore } from 'firebase-admin/firestore';
import type { Bucket } from '@google-cloud/storage';
import { Timestamp } from 'firebase-admin/firestore';
import { DEMO_DATA_MARKER, DEMO_ID_PREFIX } from '@/lib/demo/isDemoOrg';
import {
  generateDonors,
  generateSuppliers,
  generateWorkers,
  generateCategories,
  generateTransactions,
  generateProjects,
  generateDummyPDF,
  generateProjectExpensesFeed,
  generateOffBankExpenses,
  generateExpenseLinks,
} from './demo-generators';
import {
  FISCAL_ORACLE_AMOUNTS,
  FISCAL_ORACLE_DEMO_IDS,
  FISCAL_ORACLE_EXPECTED,
} from '@/lib/fiscal/fiscal-oracle';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DemoMode determina el tipus de dades generades:
 * - 'short': Dades netes per vídeos/pitch (sense anomalies)
 * - 'work': Dades amb "fang" controlat per validar workflows reals
 */
export type DemoMode = 'short' | 'work';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DEMO_ORG_ID = 'demo-org';
const DEMO_ORG_SLUG = 'demo';

// ─────────────────────────────────────────────────────────────────────────────
// Constants IDs fixos per casos especials del mode 'work'
// ─────────────────────────────────────────────────────────────────────────────

/** Donant complet amb donació + devolució assignada (per demo de certificat) */
const DEMO_WORK_DONOR_ID = FISCAL_ORACLE_DEMO_IDS.donorId;

/** Devolució pendent d'assignar (per demo de workflow de resolució) */
const DEMO_WORK_RETURN_UNASSIGNED_TX_ID = FISCAL_ORACLE_DEMO_IDS.returnWithoutDonorTxId;

// ─────────────────────────────────────────────────────────────────────────────
// Constants IDs per SEPA IN remesa demo (mode 'work')
// ─────────────────────────────────────────────────────────────────────────────
const DEMO_WORK_SEPA_PARENT_ID = `${DEMO_ID_PREFIX}tx_sepa_in_parent_001`;
const DEMO_WORK_SEPA_LINE_PREFIX = `${DEMO_ID_PREFIX}tx_sepa_in_line_`;

// ─────────────────────────────────────────────────────────────────────────────
// Constants IDs per Stripe payout demo (mode 'work')
// ─────────────────────────────────────────────────────────────────────────────
const DEMO_WORK_STRIPE_PAYOUT_PARENT_ID = `${DEMO_ID_PREFIX}tx_stripe_payout_parent_001`;
const DEMO_WORK_STRIPE_DON_PREFIX = `${DEMO_ID_PREFIX}tx_stripe_don_`;
const DEMO_WORK_STRIPE_FEE_ID = `${DEMO_ID_PREFIX}tx_stripe_fee_001`;

const VOLUMES = {
  donors: 50,
  suppliers: 20,
  workers: 8,
  months: 24,  // 2 anys
  projects: 4,
  budgetLinesPerProject: 10,
  pdfs: 20,
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function purgeCollection(
  db: Firestore,
  collectionPath: string
): Promise<number> {
  const snapshot = await db
    .collection(collectionPath)
    .where(DEMO_DATA_MARKER, '==', true)
    .get();

  if (snapshot.empty) return 0;

  const batch = db.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();

  return snapshot.size;
}

async function purgeStoragePrefix(bucket: Bucket, prefix: string): Promise<number> {
  try {
    const [files] = await bucket.getFiles({ prefix });
    for (const file of files) {
      await file.delete();
    }
    return files.length;
  } catch (error) {
    console.warn(`[seed-demo] Warning purging storage ${prefix}:`, error);
    return 0;
  }
}

async function purgeBudgetLines(db: Firestore, projectsPath: string): Promise<number> {
  // Obtenir tots els projectes demo
  const projectsSnapshot = await db
    .collection(projectsPath)
    .where(DEMO_DATA_MARKER, '==', true)
    .get();

  if (projectsSnapshot.empty) return 0;

  let totalDeleted = 0;

  // Per cada projecte, purgar la subcol·lecció budgetLines
  for (const projectDoc of projectsSnapshot.docs) {
    const budgetLinesSnapshot = await projectDoc.ref
      .collection('budgetLines')
      .where(DEMO_DATA_MARKER, '==', true)
      .get();

    if (!budgetLinesSnapshot.empty) {
      const batch = db.batch();
      budgetLinesSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      totalDeleted += budgetLinesSnapshot.size;
    }
  }

  return totalDeleted;
}

async function writeBatch<T extends { id: string }>(
  db: Firestore,
  collectionPath: string,
  items: T[]
): Promise<void> {
  // Firestore batch limit is 500
  const BATCH_SIZE = 450;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = items.slice(i, i + BATCH_SIZE);

    for (const item of chunk) {
      const { id, ...raw } = item;
      // Sanejar: eliminar camps undefined (Firestore no els accepta)
      const data = Object.fromEntries(
        Object.entries(raw).filter(([, v]) => v !== undefined)
      );
      const ref = db.collection(collectionPath).doc(id);
      batch.set(ref, data);
    }

    await batch.commit();
  }
}

// Tipus flexible per acceptar qualsevol objecte amb id i projectId
type BudgetLineWithProjectId = {
  id: string;
  projectId: string;
} & Record<string, unknown>;

async function writeBudgetLines(
  db: Firestore,
  projectsPath: string,
  budgetLines: BudgetLineWithProjectId[]
): Promise<void> {
  // Agrupar per projectId
  const byProject = new Map<string, BudgetLineWithProjectId[]>();
  for (const line of budgetLines) {
    const existing = byProject.get(line.projectId) || [];
    existing.push(line);
    byProject.set(line.projectId, existing);
  }

  // Escriure a cada subcol·lecció
  for (const [projectId, lines] of byProject) {
    const batch = db.batch();
    for (const line of lines) {
      const { id, projectId: _pid, ...raw } = line;
      // Sanejar: eliminar camps undefined
      const data = Object.fromEntries(
        Object.entries(raw).filter(([, v]) => v !== undefined)
      );
      const ref = db
        .collection(projectsPath)
        .doc(projectId)
        .collection('budgetLines')
        .doc(id);
      batch.set(ref, data);
    }
    await batch.commit();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Anomalies per mode 'work'
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Anomalies generades en mode 'work':
 * - 3 parells de duplicats (concepte similar)
 * - 1 moviment amb categoria incorrecta
 * - 5 moviments pendents (sense categoria ni contacte)
 * - 1 cas de traçabilitat (factura amb diversos moviments)
 */
interface WorkAnomalies {
  duplicates: number;         // 3 parells (6 tx)
  miscategorized: number;     // 1 tx
  pending: number;            // 5 tx
  traceability: number;       // 1 factura compartida
}

const WORK_ANOMALIES: WorkAnomalies = {
  duplicates: 3,
  miscategorized: 1,
  pending: 5,
  traceability: 1,
};

// ─────────────────────────────────────────────────────────────────────────────
// Main seed function
// ─────────────────────────────────────────────────────────────────────────────

export interface SeedCounts {
  donors: number;
  suppliers: number;
  workers: number;
  categories: number;
  transactions: number;
  projects: number;
  budgetLines: number;
  projectExpensesFeed: number;
  offBankExpenses: number;
  expenseLinks: number;
  pdfs: number;
}

export async function runDemoSeed(
  db: Firestore,
  bucket: Bucket,
  demoMode: DemoMode = 'short'
): Promise<SeedCounts> {
  console.log('[seed-demo] Iniciant seed demo...');
  console.log('[seed-demo] Mode:', demoMode);
  console.log('[seed-demo] Volums:', VOLUMES);

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Purgar dades existents
  // ─────────────────────────────────────────────────────────────────────────
  console.log('[seed-demo] Purgant dades existents...');

  const orgPath = `organizations/${DEMO_ORG_ID}`;

  await Promise.all([
    purgeCollection(db, `${orgPath}/contacts`),
    purgeCollection(db, `${orgPath}/categories`),
    purgeCollection(db, `${orgPath}/transactions`),
    // Paths per project-module
    purgeCollection(db, `${orgPath}/projectModule/_/projects`),
    purgeCollection(db, `${orgPath}/projectModule/_/expenseLinks`),
    purgeCollection(db, `${orgPath}/projectModule/_/offBankExpenses`),
    // BudgetLines de cada projecte (subcol·lecció)
    purgeBudgetLines(db, `${orgPath}/projectModule/_/projects`),
    // Feed d'exports (bank expenses per project-module)
    purgeCollection(db, `${orgPath}/exports/projectExpenses/items`),
    purgeStoragePrefix(bucket, `organizations/${DEMO_ORG_ID}/`),
  ]);

  console.log('[seed-demo] Purga completada');

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Crear/actualitzar org demo
  // ─────────────────────────────────────────────────────────────────────────
  console.log('[seed-demo] Configurant org demo...');

  await db.doc(orgPath).set(
    {
      id: DEMO_ORG_ID,
      name: 'Entitat Demo',
      slug: DEMO_ORG_SLUG,
      taxId: 'G12345678',
      status: 'active',
      isDemo: true,
      createdAt: new Date().toISOString(),
      createdBy: 'system',
      address: 'Carrer de la Demo, 1',
      city: 'Barcelona',
      province: 'Barcelona',
      zipCode: '08001',
      email: 'demo@summa-social.demo',
      phone: '931234567',
      language: 'ca',
    },
    { merge: true }
  );

  // Slug mapping (camp "orgId" requerit per organization-provider.tsx)
  await db.doc(`slugs/${DEMO_ORG_SLUG}`).set(
    {
      orgId: DEMO_ORG_ID,
      slug: DEMO_ORG_SLUG,
      createdAt: Timestamp.now(),
    },
    { merge: true }
  );

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Generar dades
  // ─────────────────────────────────────────────────────────────────────────
  console.log('[seed-demo] Generant dades...');

  // Contactes
  const donors = generateDonors(VOLUMES.donors);
  const suppliers = generateSuppliers(VOLUMES.suppliers);
  const workers = generateWorkers(VOLUMES.workers);

  // Afegir 2 contactes multi-rol (donant+proveïdor) per mostrar potència del model
  const nowStr = new Date().toISOString();
  const multiRoleContacts = [
    {
      id: `${DEMO_ID_PREFIX}multi_001`,
      name: 'Fundació Exemple Multi-Rol',
      type: 'donor' as const,
      roles: { donor: true, supplier: true },
      taxId: 'G08123456',
      email: 'info@fundacioexemple.demo',
      phone: '934567890',
      address: 'Avinguda Diagonal, 100',
      city: 'Barcelona',
      province: 'Barcelona',
      zipCode: '08019',
      donorType: 'company' as const,
      membershipType: 'recurring' as const,
      monthlyAmount: 500,
      memberSince: '2022-01-15',
      status: 'active' as const,
      createdAt: nowStr,
      updatedAt: nowStr,
      isDemoData: true as const,
    },
    {
      id: `${DEMO_ID_PREFIX}multi_002`,
      name: 'Cooperativa Solidària',
      type: 'supplier' as const,
      roles: { donor: true, supplier: true },
      taxId: 'F08654321',
      email: 'contacte@coopsolidaria.demo',
      phone: '935678901',
      address: 'Carrer Gran Via, 250',
      city: 'Barcelona',
      province: 'Barcelona',
      zipCode: '08007',
      donorType: 'company' as const,
      membershipType: 'one-time' as const,
      createdAt: nowStr,
      updatedAt: nowStr,
      isDemoData: true as const,
    },
  ];

  const allContacts = [...donors, ...suppliers, ...workers, ...multiRoleContacts];

  // Categories
  const categories = generateCategories();

  // URL base per PDFs
  const pdfBaseUrl = `gs://summa-social-demo.appspot.com/organizations/${DEMO_ORG_ID}/pendingDocuments`;

  // Transaccions (18 mesos fins ara)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - VOLUMES.months);
  const transactions = generateTransactions(startDate, endDate, donors, suppliers, categories, pdfBaseUrl);

  // Projectes i partides
  const { projects, budgetLines } = generateProjects(VOLUMES.projects, DEMO_ORG_ID);

  // Feed de despeses bank per project-module (exports/projectExpenses/items)
  const projectExpensesFeed = generateProjectExpensesFeed(
    transactions,
    categories,
    allContacts,
    DEMO_ORG_ID,
    pdfBaseUrl
  );

  // 10 off-bank expenses recents
  const offBankExpenses = generateOffBankExpenses(DEMO_ORG_ID, pdfBaseUrl);

  // ExpenseLinks (10-15 assignacions parcials per mostrar exemples)
  const expenseLinks = generateExpenseLinks(projectExpensesFeed, projects, DEMO_ORG_ID);

  // ─────────────────────────────────────────────────────────────────────────
  // 3b. Afegir anomalies (només mode 'work')
  // ─────────────────────────────────────────────────────────────────────────
  if (demoMode === 'work') {
    console.log('[seed-demo] Afegint anomalies per mode work...');

    const donationCategory = categories.find(
      (cat) => cat.type === 'income' && cat.name === 'Donacions'
    ) ?? categories.find((cat) => cat.type === 'income');
    const membershipFeeCategory = categories.find(
      (cat) => cat.type === 'income' && cat.name === 'Quotes socis'
    ) ?? donationCategory;

    if (!donationCategory || !membershipFeeCategory) {
      throw new Error('[seed-demo] Falten categories fiscals income (Donacions/Quotes socis)');
    }

    // Anomalia 1: 3 parells de duplicats (concepte i import similar, dates properes)
    for (let i = 0; i < WORK_ANOMALIES.duplicates; i++) {
      const baseTx = transactions[i * 5]; // Agafar cada 5a tx com a base
      if (baseTx) {
        const duplicateTx = {
          ...baseTx,
          id: `${DEMO_ID_PREFIX}tx_dup_${i.toString().padStart(2, '0')}`,
          date: baseTx.date, // Mateixa data
          description: baseTx.description + ' (possible duplicat)',
          amount: baseTx.amount * (1 + (Math.random() * 0.02 - 0.01)), // ±1% variació
        };
        transactions.push(duplicateTx);

        // Si és despesa, afegir també al feed
        if (duplicateTx.amount < 0) {
          const category = categories.find((c) => c.id === duplicateTx.category);
          const contact = allContacts.find((c) => c.id === duplicateTx.contactId);
          projectExpensesFeed.push({
            id: duplicateTx.id,
            orgId: DEMO_ORG_ID,
            schemaVersion: 1,
            source: 'summa',
            sourceUpdatedAt: Timestamp.now(),
            date: duplicateTx.date,
            amountEUR: duplicateTx.amount,
            currency: 'EUR',
            categoryId: category?.id ?? null,
            categoryName: category?.name ?? null,
            counterpartyId: contact?.id ?? null,
            counterpartyName: contact?.name ?? null,
            counterpartyType: (contact?.type as 'donor' | 'supplier' | 'employee') ?? null,
            internalTagId: null,
            internalTagName: null,
            description: duplicateTx.description,
            documents: [],
            isEligibleForProjects: true,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            deletedAt: null,
            isDemoData: true,
          });
        }
      }
    }
    console.log(`[seed-demo]   - Duplicats: ${WORK_ANOMALIES.duplicates} parells`);

    // Anomalia 2: 1 moviment mal categoritzat (ingrés amb categoria de despesa)
    const miscatTx = transactions.find(tx => tx.amount > 0 && tx.category);
    if (miscatTx) {
      const expenseCat = categories.find(c => c.type === 'expense');
      if (expenseCat) {
        miscatTx.category = expenseCat.id;
        miscatTx.note = '⚠️ Categoria potencialment incorrecta';
      }
    }
    console.log(`[seed-demo]   - Mal categoritzat: ${WORK_ANOMALIES.miscategorized}`);

    // Anomalia 3: 5 moviments pendents (sense categoria ni contacte)
    for (let i = 0; i < WORK_ANOMALIES.pending; i++) {
      const pendingTx = {
        id: `${DEMO_ID_PREFIX}tx_pend_${i.toString().padStart(2, '0')}`,
        date: new Date().toISOString().split('T')[0],
        description: `Moviment pendent de revisar ${i + 1}`,
        amount: -(Math.floor(Math.random() * 500) + 50),
        category: undefined,
        contactId: undefined,
        contactType: undefined,
        source: 'bank',
        transactionType: 'normal',
        createdAt: nowStr,
        isDemoData: true as const,
      };
      transactions.push(pendingTx);

      // Afegir al feed com a despesa elegible
      projectExpensesFeed.push({
        id: pendingTx.id,
        orgId: DEMO_ORG_ID,
        schemaVersion: 1,
        source: 'summa',
        sourceUpdatedAt: Timestamp.now(),
        date: pendingTx.date,
        amountEUR: pendingTx.amount,
        currency: 'EUR',
        categoryId: null,
        categoryName: null,
        counterpartyId: null,
        counterpartyName: null,
        counterpartyType: null,
        internalTagId: null,
        internalTagName: null,
        description: pendingTx.description,
        documents: [],
        isEligibleForProjects: true,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        deletedAt: null,
        isDemoData: true,
      });
    }
    console.log(`[seed-demo]   - Pendents: ${WORK_ANOMALIES.pending}`);

    // Anomalia 4: 1 cas traçabilitat (3 moviments que comparteixen 1 factura)
    const tracePdfUrl = `${pdfBaseUrl}/${DEMO_ID_PREFIX}doc_factura_compartida.pdf`;
    for (let i = 0; i < 3; i++) {
      const traceTx = {
        id: `${DEMO_ID_PREFIX}tx_trace_${i.toString().padStart(2, '0')}`,
        date: new Date().toISOString().split('T')[0],
        description: `Part ${i + 1}/3 - Factura compartida material oficina`,
        amount: -(Math.floor(Math.random() * 200) + 100),
        category: categories.find(c => c.type === 'expense')?.id,
        contactId: suppliers[0]?.id,
        contactType: 'supplier' as const,
        document: tracePdfUrl,
        source: 'bank',
        transactionType: 'normal',
        createdAt: nowStr,
        isDemoData: true as const,
      };
      transactions.push(traceTx);

      const supplier = suppliers[0];
      const category = categories.find(c => c.id === traceTx.category);
      projectExpensesFeed.push({
        id: traceTx.id,
        orgId: DEMO_ORG_ID,
        schemaVersion: 1,
        source: 'summa',
        sourceUpdatedAt: Timestamp.now(),
        date: traceTx.date,
        amountEUR: traceTx.amount,
        currency: 'EUR',
        categoryId: category?.id ?? null,
        categoryName: category?.name ?? null,
        counterpartyId: supplier?.id ?? null,
        counterpartyName: supplier?.name ?? null,
        counterpartyType: 'supplier',
        internalTagId: null,
        internalTagName: null,
        description: traceTx.description,
        documents: [{
          source: 'summa',
          storagePath: tracePdfUrl,
          fileUrl: null,
          name: 'factura-compartida.pdf',
        }],
        isEligibleForProjects: true,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        deletedAt: null,
        isDemoData: true,
      });
    }
    console.log(`[seed-demo]   - Traçabilitat: ${WORK_ANOMALIES.traceability} factura amb 3 moviments`);

    // ─────────────────────────────────────────────────────────────────────────
    // Cas especial 1: Donant complet amb donació + devolució assignada
    // Per demo de certificat (mostra net = donació - devolució)
    // ─────────────────────────────────────────────────────────────────────────
    const currentYear = new Date().getFullYear();
    const workDonorCity = { name: 'Barcelona', province: 'Barcelona', zip: '08' };

    // Crear el donant complet
    const workDonor = {
      id: DEMO_WORK_DONOR_ID,
      name: 'Maria García López',
      type: 'donor' as const,
      roles: { donor: true },
      taxId: '12345678Z',
      email: 'maria.garcia@example.demo',
      phone: '612345678',
      address: 'Carrer Major, 15, 2n 1a',
      city: workDonorCity.name,
      province: workDonorCity.province,
      zipCode: '08001',
      donorType: 'individual' as const,
      membershipType: 'recurring' as const,
      monthlyAmount: 50,
      memberSince: `${currentYear - 2}-03-15`,
      status: 'active' as const,
      createdAt: nowStr,
      updatedAt: nowStr,
      isDemoData: true as const,
    };
    allContacts.push(workDonor);

    // Transacció de donació (100€)
    const workDonationTx = {
      id: FISCAL_ORACLE_DEMO_IDS.donationTxId,
      date: `${currentYear}-03-15`,
      description: 'Quota mensual Maria García',
      amount: FISCAL_ORACLE_AMOUNTS.donation,
      category: donationCategory.id,
      contactId: DEMO_WORK_DONOR_ID,
      contactType: 'donor' as const,
      source: 'bank',
      transactionType: 'normal',
      fiscalKind: 'donation' as const,
      archivedAt: null,
      createdAt: nowStr,
      isDemoData: true as const,
    };
    transactions.push(workDonationTx);

    // Transacció explícita no fiscal (no ha de computar)
    const workNonFiscalTx = {
      id: FISCAL_ORACLE_DEMO_IDS.nonFiscalTxId,
      date: `${currentYear}-03-20`,
      description: 'Ingressos operatius no fiscals',
      amount: FISCAL_ORACLE_AMOUNTS.nonFiscal,
      category: membershipFeeCategory.id,
      contactId: DEMO_WORK_DONOR_ID,
      contactType: 'donor' as const,
      source: 'bank',
      transactionType: 'normal',
      fiscalKind: 'non_fiscal' as const,
      archivedAt: null,
      createdAt: nowStr,
      isDemoData: true as const,
    };
    transactions.push(workNonFiscalTx);

    // Transacció pendent de classificació fiscal (exclosa de 182/certificats)
    const workPendingReviewTx = {
      id: FISCAL_ORACLE_DEMO_IDS.pendingTxId,
      date: `${currentYear}-03-25`,
      description: 'Ingrés pendent classificació fiscal',
      amount: FISCAL_ORACLE_AMOUNTS.pending,
      category: donationCategory.id,
      contactId: DEMO_WORK_DONOR_ID,
      contactType: 'donor' as const,
      source: 'bank',
      transactionType: 'normal',
      archivedAt: null,
      createdAt: nowStr,
      isDemoData: true as const,
    };
    transactions.push(workPendingReviewTx);

    // Transacció de devolució assignada al mateix donant (-20€)
    const workReturnAssignedTx = {
      id: FISCAL_ORACLE_DEMO_IDS.returnWithDonorTxId,
      date: `${currentYear}-04-02`,
      description: 'DEVOLUCIÓN RECIBO - Maria García',
      amount: FISCAL_ORACLE_AMOUNTS.returnWithDonor,
      category: donationCategory.id,
      contactId: DEMO_WORK_DONOR_ID,
      contactType: 'donor' as const,
      source: 'bank',
      transactionType: 'return',
      archivedAt: null,
      createdAt: nowStr,
      isDemoData: true as const,
    };
    transactions.push(workReturnAssignedTx);

    console.log(`[seed-demo]   - Oracle fiscal: donació (120€) + no fiscal (45€) + pendent (35€) + devolució assignada (-20€)`);

    // ─────────────────────────────────────────────────────────────────────────
    // Cas especial 2: Devolució pendent d'assignar (sense contacte)
    // Per demo de workflow de resolució de devolucions
    // ─────────────────────────────────────────────────────────────────────────
    const workReturnUnassignedTx = {
      id: DEMO_WORK_RETURN_UNASSIGNED_TX_ID,
      date: `${currentYear}-04-10`,
      description: 'DEVOLUCIÓN RECIBO CUOTA SOCIO',
      amount: FISCAL_ORACLE_AMOUNTS.returnWithoutDonor,
      category: undefined,
      contactId: undefined,
      contactType: undefined,
      source: 'bank',
      transactionType: 'return',
      archivedAt: null,
      createdAt: nowStr,
      isDemoData: true as const,
    };
    transactions.push(workReturnUnassignedTx);

    console.log(`[seed-demo]   - Devolució pendent: 1 devolució (${FISCAL_ORACLE_AMOUNTS.returnWithoutDonor}€) sense contacte assignat`);

    // ─────────────────────────────────────────────────────────────────────────
    // Cas especial 3: Remesa SEPA IN (1 pare + 8 línies assignades a donants)
    // ─────────────────────────────────────────────────────────────────────────

    // Seleccionar 8 donants deterministes (els primers 8 del seed)
    const sepaDonors = donors.slice(0, 8);
    const sepaLineAmounts = [10, 12, 15, 20, 25, 30, 35, 50]; // Imports variats (total 197€)
    const sepaTotal = sepaLineAmounts.reduce((sum, a) => sum + a, 0);

    // Crear les 8 línies filles (donacions individuals)
    for (let i = 0; i < 8; i++) {
      const donor = sepaDonors[i];
      const amount = sepaLineAmounts[i];
      const sepaLineTx = {
        id: `${DEMO_WORK_SEPA_LINE_PREFIX}${String(i + 1).padStart(3, '0')}`,
        date: `${currentYear}-05-15`,
        description: `Quota mensual ${donor.name}`,
        amount: amount, // Positiu (ingrés)
        category: categories.find((c) => c.type === 'income')?.id,
        contactId: donor.id,
        contactType: 'donor' as const,
        source: 'remittance' as const,
        transactionType: 'donation' as const,
        isRemittanceItem: true,
        parentTransactionId: DEMO_WORK_SEPA_PARENT_ID, // Camp usat pel modal
        createdAt: nowStr,
        isDemoData: true as const,
      };
      transactions.push(sepaLineTx);
    }

    // Crear el pare (resum remesa)
    const sepaParentTx = {
      id: DEMO_WORK_SEPA_PARENT_ID,
      date: `${currentYear}-05-15`,
      description: 'REMESA SEPA QUOTES SOCIS MAIG',
      amount: sepaTotal, // Suma de les línies (positiu)
      category: categories.find((c) => c.type === 'income')?.id,
      contactId: undefined,
      contactType: undefined,
      source: 'bank' as const,
      transactionType: 'normal' as const,
      isRemittance: true,
      remittanceType: 'donations' as const,
      remittanceDirection: 'IN' as const,
      remittanceStatus: 'complete' as const,
      remittanceItemCount: 8,
      remittanceResolvedCount: 8,
      remittancePendingCount: 0,
      createdAt: nowStr,
      isDemoData: true as const,
    };
    transactions.push(sepaParentTx);

    console.log(`[seed-demo]   - Remesa SEPA IN: 1 pare (${sepaTotal}€) + 8 línies (totes assignades a donants)`);

    // ─────────────────────────────────────────────────────────────────────────
    // Cas especial 4: Stripe payout (1 pare + 6 donacions + 1 fee)
    // ─────────────────────────────────────────────────────────────────────────

    // Seleccionar 6 donants deterministes.
    // El primer ha de ser el donant oracle perquè demo_tx_stripe_don_001
    // continuï sent la donació Stripe legacy del check fiscal.
    const stripeDonors = [
      workDonor,
      ...donors.filter((donor) => donor.id !== workDonor.id).slice(8, 13),
    ];
    const stripeDonationAmounts = [25, 50, 75, 100, 150, 200]; // Imports variats (total 600€)
    const stripeDonationsTotal = stripeDonationAmounts.reduce((sum, a) => sum + a, 0);
    const stripeFeeAmount = -18; // Fee negatiu (3% de 600€)
    const stripePayoutNet = stripeDonationsTotal + stripeFeeAmount; // 582€

    // Crear les 6 donacions Stripe
    for (let i = 0; i < 6; i++) {
      const donor = stripeDonors[i];
      const amount = stripeDonationAmounts[i];
      const stripeDonTx = {
        id: `${DEMO_WORK_STRIPE_DON_PREFIX}${String(i + 1).padStart(3, '0')}`,
        date: `${currentYear}-06-01`,
        description: `Donació online ${donor.name}`,
        amount: amount, // Positiu (ingrés)
        category: categories.find((c) => c.type === 'income')?.id,
        contactId: donor.id,
        contactType: 'donor' as const,
        source: 'stripe' as const,
        transactionType: 'donation' as const,
        stripeTransferId: DEMO_WORK_STRIPE_PAYOUT_PARENT_ID,
        createdAt: nowStr,
        isDemoData: true as const,
      };
      transactions.push(stripeDonTx);
    }

    // Crear la fee Stripe (sense contactId)
    const stripeFeeTx = {
      id: DEMO_WORK_STRIPE_FEE_ID,
      date: `${currentYear}-06-01`,
      description: 'Comissió Stripe payout',
      amount: stripeFeeAmount, // Negatiu (despesa)
      category: categories.find((c) => c.type === 'expense')?.id,
      contactId: undefined,
      contactType: undefined,
      source: 'stripe' as const,
      transactionType: 'fee' as const,
      stripeTransferId: DEMO_WORK_STRIPE_PAYOUT_PARENT_ID,
      createdAt: nowStr,
      isDemoData: true as const,
    };
    transactions.push(stripeFeeTx);

    // Crear el pare (payout)
    const stripePayoutTx = {
      id: DEMO_WORK_STRIPE_PAYOUT_PARENT_ID,
      date: `${currentYear}-06-03`, // Payout arriba 2 dies després
      description: 'Stripe payout (demo)',
      amount: stripePayoutNet, // Net = donacions - fee
      category: categories.find((c) => c.type === 'income')?.id,
      contactId: undefined,
      contactType: undefined,
      source: 'bank' as const,
      transactionType: 'normal' as const,
      note: 'Payout Stripe: 6 donacions - comissió',
      createdAt: nowStr,
      isDemoData: true as const,
    };
    transactions.push(stripePayoutTx);

    console.log(`[seed-demo]   - Stripe payout: 1 pare (${stripePayoutNet}€) + 6 donacions (${stripeDonationsTotal}€) + 1 fee (${stripeFeeAmount}€)`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Escriure dades
  // ─────────────────────────────────────────────────────────────────────────
  console.log('[seed-demo] Escrivint dades a Firestore...');

  await writeBatch(db, `${orgPath}/contacts`, allContacts);
  console.log(`[seed-demo]   - Contactes: ${allContacts.length}`);

  await writeBatch(db, `${orgPath}/categories`, categories);
  console.log(`[seed-demo]   - Categories: ${categories.length}`);

  await writeBatch(db, `${orgPath}/transactions`, transactions);
  console.log(`[seed-demo]   - Transaccions: ${transactions.length}`);

  // Projectes
  await writeBatch(db, `${orgPath}/projectModule/_/projects`, projects);
  console.log(`[seed-demo]   - Projectes: ${projects.length}`);

  // BudgetLines (subcol·lecció de cada projecte)
  // Cast necessari perquè TypeScript no infereix el tipus correctament amb interfaces
  await writeBudgetLines(db, `${orgPath}/projectModule/_/projects`, budgetLines as unknown as BudgetLineWithProjectId[]);
  console.log(`[seed-demo]   - BudgetLines: ${budgetLines.length}`);

  // Feed bank expenses per project-module
  await writeBatch(db, `${orgPath}/exports/projectExpenses/items`, projectExpensesFeed);
  console.log(`[seed-demo]   - ProjectExpensesFeed: ${projectExpensesFeed.length}`);

  // Off-bank expenses
  await writeBatch(db, `${orgPath}/projectModule/_/offBankExpenses`, offBankExpenses);
  console.log(`[seed-demo]   - OffBankExpenses: ${offBankExpenses.length}`);

  // ExpenseLinks (assignacions)
  await writeBatch(db, `${orgPath}/projectModule/_/expenseLinks`, expenseLinks);
  console.log(`[seed-demo]   - ExpenseLinks: ${expenseLinks.length}`);

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Pujar PDFs dummy
  // ─────────────────────────────────────────────────────────────────────────
  console.log('[seed-demo] Pujant PDFs dummy...');

  for (let i = 0; i < VOLUMES.pdfs; i++) {
    const pdfBuffer = generateDummyPDF(i);
    const fileName = `organizations/${DEMO_ORG_ID}/pendingDocuments/${DEMO_ID_PREFIX}doc_${i.toString().padStart(3, '0')}.pdf`;
    const file = bucket.file(fileName);
    await file.save(pdfBuffer, {
      contentType: 'application/pdf',
      metadata: {
        [DEMO_DATA_MARKER]: 'true',
      },
    });
  }
  console.log(`[seed-demo]   - PDFs: ${VOLUMES.pdfs}`);

  // ─────────────────────────────────────────────────────────────────────────
  // 6. Retornar comptadors
  // ─────────────────────────────────────────────────────────────────────────
  const counts: SeedCounts = {
    donors: donors.length,
    suppliers: suppliers.length,
    workers: workers.length,
    categories: categories.length,
    transactions: transactions.length,
    projects: projects.length,
    budgetLines: budgetLines.length,
    projectExpensesFeed: projectExpensesFeed.length,
    offBankExpenses: offBankExpenses.length,
    expenseLinks: expenseLinks.length,
    pdfs: VOLUMES.pdfs,
  };

  // ─────────────────────────────────────────────────────────────────────────
  // 7. Assertions anti-regressió (invariants)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('[seed-demo] Validant invariants...');

  const invariantErrors: string[] = [];

  // Invariants comuns a tots els modes
  if (counts.donors !== VOLUMES.donors) {
    invariantErrors.push(`donors: esperats ${VOLUMES.donors}, obtinguts ${counts.donors}`);
  }
  if (counts.suppliers !== VOLUMES.suppliers) {
    invariantErrors.push(`suppliers: esperats ${VOLUMES.suppliers}, obtinguts ${counts.suppliers}`);
  }
  if (counts.workers !== VOLUMES.workers) {
    invariantErrors.push(`workers: esperats ${VOLUMES.workers}, obtinguts ${counts.workers}`);
  }
  if (counts.projects !== VOLUMES.projects) {
    invariantErrors.push(`projects: esperats ${VOLUMES.projects}, obtinguts ${counts.projects}`);
  }
  if (counts.pdfs !== VOLUMES.pdfs) {
    invariantErrors.push(`pdfs: esperats ${VOLUMES.pdfs}, obtinguts ${counts.pdfs}`);
  }
  if (counts.offBankExpenses !== 30) {
    invariantErrors.push(`offBankExpenses: esperats 30, obtinguts ${counts.offBankExpenses}`);
  }
  if (counts.expenseLinks !== 20) {
    invariantErrors.push(`expenseLinks: esperats 20, obtinguts ${counts.expenseLinks}`);
  }

  // Invariants específics per mode
  if (demoMode === 'short') {
    // Short: exactament 100 transaccions base (cap anomalia)
    if (counts.transactions !== 100) {
      invariantErrors.push(`[short] transactions: esperats 100, obtinguts ${counts.transactions}`);
    }
  } else {
    // Work: 100 base + 3 duplicats + 5 pendents + 3 traçabilitat
    //       + 5 casos oracle (donation/non_fiscal/pending + 2 returns)
    //       + 9 SEPA IN (1 pare + 8 línies) + 8 Stripe (1 pare + 6 donacions + 1 fee) = 133
    const expectedWorkTx = 100 + WORK_ANOMALIES.duplicates + WORK_ANOMALIES.pending + 3 + 5 + 9 + 8;
    if (counts.transactions !== expectedWorkTx) {
      invariantErrors.push(`[work] transactions: esperats ${expectedWorkTx}, obtinguts ${counts.transactions}`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Invariants casos especials work (anti-regressió)
    // ─────────────────────────────────────────────────────────────────────────

    // 1. Donant complet existeix
    const workDonorExists = allContacts.some((c) => c.id === DEMO_WORK_DONOR_ID);
    if (!workDonorExists) {
      invariantErrors.push('[work] donant certificat no existeix');
    }

    // 2. Transaccions oracle del donant certificat
    const workDonorTxs = transactions.filter((tx) => tx.contactId === DEMO_WORK_DONOR_ID);
    const donationTx = workDonorTxs.find((tx) => tx.id === FISCAL_ORACLE_DEMO_IDS.donationTxId);
    const nonFiscalTx = workDonorTxs.find((tx) => tx.id === FISCAL_ORACLE_DEMO_IDS.nonFiscalTxId);
    const pendingTx = workDonorTxs.find((tx) => tx.id === FISCAL_ORACLE_DEMO_IDS.pendingTxId);
    const returnWithDonorTx = workDonorTxs.find((tx) => tx.id === FISCAL_ORACLE_DEMO_IDS.returnWithDonorTxId);

    if (!donationTx || donationTx.fiscalKind !== 'donation' || donationTx.amount !== FISCAL_ORACLE_AMOUNTS.donation) {
      invariantErrors.push('[work] oracle: falta ingrés amb fiscalKind=donation');
    }
    if (!nonFiscalTx || nonFiscalTx.fiscalKind !== 'non_fiscal' || nonFiscalTx.amount !== FISCAL_ORACLE_AMOUNTS.nonFiscal) {
      invariantErrors.push('[work] oracle: falta ingrés amb fiscalKind=non_fiscal');
    }
    if (!pendingTx || (pendingTx.fiscalKind ?? null) !== null || pendingTx.amount !== FISCAL_ORACLE_AMOUNTS.pending) {
      invariantErrors.push('[work] oracle: falta ingrés pending_review (sense fiscalKind)');
    }
    if (!returnWithDonorTx || returnWithDonorTx.amount !== FISCAL_ORACLE_AMOUNTS.returnWithDonor) {
      invariantErrors.push('[work] oracle: falta return amb donant assignat');
    }

    // Net oracle esperat: donation + stripe legacy + remittance legacy + return assignat
    const oracleRelevantIds = new Set<string>([
      FISCAL_ORACLE_DEMO_IDS.donationTxId,
      FISCAL_ORACLE_DEMO_IDS.returnWithDonorTxId,
      FISCAL_ORACLE_DEMO_IDS.stripeLegacyTxId,
      FISCAL_ORACLE_DEMO_IDS.remittanceLegacyTxId,
    ]);
    const workDonorOracleNet = workDonorTxs
      .filter((tx) => oracleRelevantIds.has(tx.id))
      .reduce((sum, tx) => sum + tx.amount, 0);
    if (Math.abs(workDonorOracleNet - FISCAL_ORACLE_EXPECTED.donorNet) > 0.01) {
      invariantErrors.push(
        `[work] oracle: net esperat ${FISCAL_ORACLE_EXPECTED.donorNet}, obtingut ${workDonorOracleNet}`
      );
    }

    // 3. Devolució pendent d'assignar
    const unassignedReturn = transactions.find((tx) => tx.id === DEMO_WORK_RETURN_UNASSIGNED_TX_ID);
    if (!unassignedReturn) {
      invariantErrors.push('[work] devolució pendent: transacció no existeix');
    } else {
      if (unassignedReturn.contactId !== undefined) {
        invariantErrors.push('[work] devolució pendent: ha de tenir contactId undefined');
      }
      if (unassignedReturn.transactionType !== 'return') {
        invariantErrors.push('[work] devolució pendent: transactionType ha de ser return');
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Invariants SEPA IN remesa
    // ─────────────────────────────────────────────────────────────────────────
    const sepaParent = transactions.find((tx) => tx.id === DEMO_WORK_SEPA_PARENT_ID);
    if (!sepaParent) {
      invariantErrors.push('[work] SEPA IN: pare no existeix');
    } else {
      if (!sepaParent.isRemittance) {
        invariantErrors.push('[work] SEPA IN: pare ha de tenir isRemittance=true');
      }
    }

    const sepaLines = transactions.filter((tx) => tx.id.startsWith(DEMO_WORK_SEPA_LINE_PREFIX));
    if (sepaLines.length !== 8) {
      invariantErrors.push(`[work] SEPA IN: esperats 8 línies, obtinguts ${sepaLines.length}`);
    }

    // Totes les línies han de tenir contactId
    const sepaLinesWithContact = sepaLines.filter((tx) => tx.contactId !== undefined);
    if (sepaLinesWithContact.length !== 8) {
      invariantErrors.push(`[work] SEPA IN: totes les línies han de tenir contactId, només ${sepaLinesWithContact.length}/8`);
    }

    // Suma de línies == import pare (tolerància 0.01)
    const sepaLinesSum = sepaLines.reduce((sum, tx) => sum + tx.amount, 0);
    if (sepaParent && Math.abs(sepaLinesSum - sepaParent.amount) > 0.01) {
      invariantErrors.push(`[work] SEPA IN: suma línies (${sepaLinesSum}) != pare (${sepaParent.amount})`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. Invariants Stripe payout
    // ─────────────────────────────────────────────────────────────────────────
    const stripePayoutParent = transactions.find((tx) => tx.id === DEMO_WORK_STRIPE_PAYOUT_PARENT_ID);
    if (!stripePayoutParent) {
      invariantErrors.push('[work] Stripe payout: pare no existeix');
    }

    const stripeDonations = transactions.filter((tx) => tx.id.startsWith(DEMO_WORK_STRIPE_DON_PREFIX));
    if (stripeDonations.length !== 6) {
      invariantErrors.push(`[work] Stripe payout: esperats 6 donacions, obtinguts ${stripeDonations.length}`);
    }

    // Totes les donacions han de tenir contactId
    const stripeDonationsWithContact = stripeDonations.filter((tx) => tx.contactId !== undefined);
    if (stripeDonationsWithContact.length !== 6) {
      invariantErrors.push(`[work] Stripe payout: totes les donacions han de tenir contactId, només ${stripeDonationsWithContact.length}/6`);
    }

    const stripeFee = transactions.find((tx) => tx.id === DEMO_WORK_STRIPE_FEE_ID);
    if (!stripeFee) {
      invariantErrors.push('[work] Stripe payout: fee no existeix');
    } else {
      if (stripeFee.contactId !== undefined) {
        invariantErrors.push('[work] Stripe payout: fee ha de tenir contactId undefined');
      }
      if (stripeFee.amount >= 0) {
        invariantErrors.push('[work] Stripe payout: fee ha de tenir amount negatiu');
      }
      if (stripeFee.transactionType !== 'fee') {
        invariantErrors.push('[work] Stripe payout: fee ha de tenir transactionType=fee');
      }
    }
  }

  if (invariantErrors.length > 0) {
    const errorMsg = `[seed-demo] invariant failed: ${invariantErrors.join('; ')}`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  console.log('[seed-demo] Invariants OK');
  console.log('[seed-demo] Seed completat!');
  console.log('[seed-demo] Comptadors:', counts);

  return counts;
}
