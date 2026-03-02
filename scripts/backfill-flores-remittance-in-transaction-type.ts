/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BACKFILL: transactionType="donation" per quotes de remesa IN (Flores)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Problema:
 * - Algunes quotes creades via /api/remittances/in/process s'han guardat sense
 *   transactionType.
 * - Això les exclou de fitxa de donant, càlcul net fiscal i Model 182.
 *
 * Criteri de correcció:
 * - source === 'remittance'
 * - isRemittanceItem === true
 * - amount > 0
 * - contactId present
 * - transactionType absent
 * - transacció activa (!archivedAt)
 *
 * Guardrails:
 * - Dry-run per defecte (cal --apply per escriure)
 * - Requereix --project summa-social
 * - Batch màxim 50 operacions
 *
 * Execució:
 *   GCLOUD_PROJECT=summa-social node --import tsx scripts/backfill-flores-remittance-in-transaction-type.ts --dry-run --project summa-social
 *   GCLOUD_PROJECT=summa-social node --import tsx scripts/backfill-flores-remittance-in-transaction-type.ts --apply --project summa-social
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const EXPECTED_PROJECT = 'summa-social';
const ORG_ID = 'SkQjWvCRDJhSf1OeJAw9'; // Fundacion Flores de Kiskeya
const BATCH_SIZE = 50;

interface TxDoc {
  id: string;
  source?: string;
  isRemittanceItem?: boolean;
  amount?: number;
  contactId?: string | null;
  transactionType?: string | null;
  archivedAt?: string | null;
  date?: string;
  remittanceId?: string | null;
  parentTransactionId?: string | null;
}

function getProjectFlag(): string | null {
  const idx = process.argv.indexOf('--project');
  if (idx === -1 || idx + 1 >= process.argv.length) return null;
  return process.argv[idx + 1];
}

function validateProject(): void {
  const projectFlag = getProjectFlag();
  const envProject = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;

  if (projectFlag !== EXPECTED_PROJECT) {
    console.error(`ERROR: cal passar --project ${EXPECTED_PROJECT}`);
    console.error(`  Rebut: --project ${projectFlag ?? '(no especificat)'}`);
    process.exit(1);
  }

  if (envProject && envProject !== EXPECTED_PROJECT) {
    console.error(`ERROR: GCLOUD_PROJECT="${envProject}" no coincideix amb "${EXPECTED_PROJECT}"`);
    process.exit(1);
  }
}

function isCandidate(tx: TxDoc): boolean {
  if (tx.archivedAt) return false;
  if (tx.source !== 'remittance') return false;
  if (tx.isRemittanceItem !== true) return false;
  if (typeof tx.amount !== 'number' || tx.amount <= 0) return false;
  if (!tx.contactId || !String(tx.contactId).trim()) return false;
  if (tx.transactionType && String(tx.transactionType).trim()) return false;
  return true;
}

function summarizeByYear(rows: TxDoc[]): Array<[string, { count: number; amount: number }]> {
  const byYear = new Map<string, { count: number; amount: number }>();

  for (const tx of rows) {
    const year = (tx.date || '').slice(0, 4) || '????';
    const prev = byYear.get(year) || { count: 0, amount: 0 };
    prev.count += 1;
    prev.amount += tx.amount || 0;
    byYear.set(year, prev);
  }

  return Array.from(byYear.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

async function main(dryRun: boolean): Promise<void> {
  validateProject();

  if (getApps().length === 0) {
    initializeApp({ projectId: EXPECTED_PROJECT });
  }

  const db = getFirestore();

  const orgSnap = await db.doc(`organizations/${ORG_ID}`).get();
  if (!orgSnap.exists) {
    throw new Error(`Organitzacio no trobada: ${ORG_ID}`);
  }

  const orgName = String(orgSnap.data()?.name || ORG_ID);

  console.log('\n=== BACKFILL REMITTANCE IN transactionType (Flores) ===');
  console.log(`Mode: ${dryRun ? 'DRY-RUN' : 'APPLY'}`);
  console.log(`Projecte: ${EXPECTED_PROJECT}`);
  console.log(`Org: ${orgName} (${ORG_ID})`);

  const txSnap = await db.collection(`organizations/${ORG_ID}/transactions`).get();
  const allTx = txSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TxDoc, 'id'>) })) as TxDoc[];
  const candidates = allTx.filter(isCandidate);

  const totalAmount = candidates.reduce((sum, tx) => sum + (tx.amount || 0), 0);

  console.log(`\nTransaccions totals: ${allTx.length}`);
  console.log(`Candidats a corregir: ${candidates.length}`);
  console.log(`Import total afectat: ${totalAmount.toFixed(2)} EUR`);
  console.log('Distribucio per any:', JSON.stringify(summarizeByYear(candidates)));

  if (candidates.length > 0) {
    console.log('\nMostra (max 10):');
    for (const tx of candidates.slice(0, 10)) {
      console.log(
        JSON.stringify(
          {
            id: tx.id,
            date: tx.date || null,
            amount: tx.amount || null,
            contactId: tx.contactId || null,
            parentTransactionId: tx.parentTransactionId || null,
            remittanceId: tx.remittanceId || null,
            transactionType: tx.transactionType || null,
          },
          null,
          2
        )
      );
    }
  }

  if (dryRun || candidates.length === 0) {
    console.log('\nDry-run finalitzat. No s\'ha escrit cap canvi.');
    return;
  }

  let updated = 0;

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const chunk = candidates.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const tx of chunk) {
      const txRef = db.doc(`organizations/${ORG_ID}/transactions/${tx.id}`);
      batch.update(txRef, {
        transactionType: 'donation',
      });
    }

    await batch.commit();
    updated += chunk.length;
    console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${chunk.length} actualitzades`);
  }

  const verifySnap = await db.collection(`organizations/${ORG_ID}/transactions`).get();
  const remaining = verifySnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<TxDoc, 'id'>) }))
    .filter(isCandidate).length;

  console.log('\n=== RESULTAT ===');
  console.log(`Actualitzades: ${updated}`);
  console.log(`Pendents despres d\'aplicar: ${remaining}`);
}

const dryRun = !process.argv.includes('--apply');

main(dryRun)
  .then(() => {
    console.log('\nFet.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nERROR:', error?.message || error);
    process.exit(1);
  });
