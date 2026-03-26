// scripts/backfill-project-expenses-eligibility.ts
// Reprocessa transaccions per sincronitzar el feed exports/projectExpenses/items
// amb la regla actual d'elegibilitat per al mòdul de projectes.
//
// Cas principal:
// - les despeses bancàries negatives sense categoria ara entren al feed
//   i la UI les mostra com "Categoria pendent"
//
// Execució:
//   npx tsx scripts/backfill-project-expenses-eligibility.ts <orgSlugOrId> [--dry-run]

import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

initializeApp({
  credential: applicationDefault(),
  projectId: 'summa-social',
});

const db = getFirestore();
const BATCH_SIZE = 50;

interface TransactionDoc {
  amount?: number;
  archivedAt?: unknown;
  transactionType?: string | null;
  isCounterpartTransfer?: boolean;
  isRemittance?: boolean;
  isSplit?: boolean;
}

interface ExportDoc {
  isEligibleForProjects?: boolean;
  deletedAt?: unknown;
}

function calculateEligibility(tx: TransactionDoc): boolean {
  if (tx.archivedAt != null) return false;
  if (typeof tx.amount !== 'number' || tx.amount >= 0) return false;
  if (tx.transactionType === 'return' || tx.transactionType === 'return_fee') return false;
  if (tx.isCounterpartTransfer === true) return false;
  if (tx.isRemittance === true) return false;
  if (tx.isSplit === true) return false;
  return true;
}

async function resolveOrgId(slugOrId: string): Promise<string> {
  const direct = await db.doc(`organizations/${slugOrId}`).get();
  if (direct.exists) return slugOrId;

  const bySlug = await db
    .collection('organizations')
    .where('slug', '==', slugOrId)
    .limit(1)
    .get();

  if (!bySlug.empty) return bySlug.docs[0].id;

  throw new Error(`Organització no trobada: ${slugOrId}`);
}

async function main() {
  const slugOrId = process.argv[2];
  const dryRun = process.argv.includes('--dry-run');

  if (!slugOrId) {
    console.error('Usage: npx tsx scripts/backfill-project-expenses-eligibility.ts <orgSlugOrId> [--dry-run]');
    process.exit(1);
  }

  const orgId = await resolveOrgId(slugOrId);
  console.log(`[backfill-project-expenses-eligibility] org=${orgId} dryRun=${dryRun ? 'yes' : 'no'}`);

  const [txSnap, exportSnap] = await Promise.all([
    db.collection(`organizations/${orgId}/transactions`).get(),
    db.collection(`organizations/${orgId}/exports/projectExpenses/items`).get(),
  ]);

  const exportById = new Map<string, ExportDoc>();
  for (const doc of exportSnap.docs) {
    exportById.set(doc.id, doc.data() as ExportDoc);
  }

  const txRefsToTouch = txSnap.docs
    .filter((doc) => {
      const tx = doc.data() as TransactionDoc;
      const expectedEligible = calculateEligibility(tx);
      const exportDoc = exportById.get(doc.id);
      const observedEligible = !!(
        exportDoc &&
        exportDoc.deletedAt == null &&
        exportDoc.isEligibleForProjects === true
      );

      return expectedEligible !== observedEligible;
    })
    .map((doc) => doc.ref);

  console.log(`[backfill-project-expenses-eligibility] transactions=${txSnap.size} exports=${exportSnap.size}`);
  console.log(`[backfill-project-expenses-eligibility] pending=${txRefsToTouch.length}`);

  if (txRefsToTouch.length === 0) {
    console.log('[backfill-project-expenses-eligibility] Nothing to do.');
    return;
  }

  if (dryRun) {
    console.log('[backfill-project-expenses-eligibility] Dry run complete. No writes executed.');
    return;
  }

  let touched = 0;
  for (let i = 0; i < txRefsToTouch.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = txRefsToTouch.slice(i, i + BATCH_SIZE);

    for (const txRef of chunk) {
      batch.update(txRef, {
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();
    touched += chunk.length;
    console.log(`[backfill-project-expenses-eligibility] committed ${touched}/${txRefsToTouch.length}`);
  }

  console.log('[backfill-project-expenses-eligibility] Done.');
}

main().catch((error) => {
  console.error('[backfill-project-expenses-eligibility] Error:', error);
  process.exit(1);
});
