// Detector P2 (auditoria fiscal Error 1): candidats de devolucions legacy
// sense `linkedTransactionId` que el fallback canònic podria no emparellar.
//
// NOMÉS INFORME: no escriu res, no modifica dades. La neteja requerirà
// autorització específica de Raül.
//
// Ús:
//   npx tsx scripts/fiscal/audit-legacy-returns.ts --orgId <ORG_ID> [--year 2025]
//
// Sortida: llista de candidats amb confiança i evidència, per revisar a mà.

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

interface Args {
  orgId: string;
  year?: number;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const orgId = get('--orgId');
  if (!orgId) {
    console.error('Ús: npx tsx scripts/fiscal/audit-legacy-returns.ts --orgId <ORG_ID> [--year 2025]');
    process.exit(1);
  }
  const yearStr = get('--year');
  return { orgId, year: yearStr ? parseInt(yearStr, 10) : undefined };
}

interface CandidateTx {
  id: string;
  date: string;
  amount: number;
  contactId?: string | null;
  transactionType?: string;
  donationStatus?: string;
  linkedTransactionId?: string | null;
}

function dateDiffDays(a: string, b: string): number {
  return Math.abs((new Date(a).getTime() - new Date(b).getTime()) / 86_400_000);
}

async function main(): Promise<void> {
  const { orgId, year } = parseArgs();

  initializeApp({ credential: applicationDefault(), projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
  const db = getFirestore();

  const snap = await db.collection(`organizations/${orgId}/transactions`)
    .where('transactionType', 'in', ['return', 'donation'])
    .get();

  const txs = snap.docs.map(d => ({ id: d.id, ...d.data() })) as CandidateTx[];

  const returns = txs.filter(t =>
    t.transactionType === 'return' &&
    t.amount < 0 &&
    !t.linkedTransactionId?.trim()
  );
  const returnedDonations = txs.filter(t =>
    t.transactionType === 'donation' &&
    t.donationStatus === 'returned' &&
    t.amount > 0 &&
    !t.linkedTransactionId?.trim()
  );

  const usedDonationIds = new Set<string>();
  const candidates: Array<{
    returnId: string; donationId?: string; contactId?: string | null;
    amountReturn: number; amountDonation: number; daysApart?: number;
    confidence: 'ALTA' | 'MITJANA' | 'BAIXA';
  }> = [];

  for (const ret of returns) {
    let best: { donation: CandidateTx; score: number } | null = null;
    for (const don of returnedDonations) {
      if (usedDonationIds.has(don.id)) continue;
      if (don.contactId !== ret.contactId) continue;
      const centsRet = Math.round(Math.abs(ret.amount) * 100);
      const centsDon = Math.round(Math.abs(don.amount) * 100);
      if (centsRet !== centsDon) continue;
      const days = dateDiffDays(ret.date, don.date);
      // El fallback canònic només emparella mateixa data; si difereix,
      // és un candidat legacy real (Error 1 de l'auditoria).
      const score = days === 0 ? 3 : days <= 7 ? 2 : 1;
      if (!best || score > best.score) best = { donation: don, score };
    }
    if (best) {
      usedDonationIds.add(best.donation.id);
      const days = dateDiffDays(ret.date, best.donation.date);
      candidates.push({
        returnId: ret.id,
        donationId: best.donation.id,
        contactId: ret.contactId ?? null,
        amountReturn: Math.abs(ret.amount),
        amountDonation: best.donation.amount,
        ...(days !== 0 ? { daysApart: Math.round(days) } : {}),
        confidence: days === 0 ? 'ALTA' : days <= 7 ? 'MITJANA' : 'BAIXA',
      });
    }
  }

  console.log(`\n═══ Auditoria devolucions legacy (org ${orgId}${year ? `, any ${year}` : ''}) ═══`);
  console.log(`Devolucions sense enllaç analitzades: ${returns.length}`);
  console.log(`Donacions retornades sense enllaç:   ${returnedDonations.length}`);
  console.log(`Candidats de parella detectats:      ${candidates.length}\n`);

  for (const c of candidates) {
    console.log(
      `[${c.confidence}] return=${c.returnId} (${c.amountReturn.toFixed(2)} €)` +
      ` ↔ donació=${c.donationId} (${c.amountDonation.toFixed(2)} €)` +
      `${c.daysApart != null ? `, ${c.daysApart} dies de diferència` : ', mateixa data'}` +
      ` — efecte actual: restat dues vegades al net fiscal`
    );
  }

  if (candidates.length === 0) {
    console.log('Cap candidat: les dades legacy estan netes o no hi ha parelles detectables.');
  }
  console.log('\nINFORME NOMÉS — no s\'ha modificat cap dada.');
}

main().catch(err => { console.error(err); process.exit(1); });
