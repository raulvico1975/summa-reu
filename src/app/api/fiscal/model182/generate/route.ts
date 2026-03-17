/**
 * POST /api/fiscal/model182/generate
 *
 * Genera el fitxer Model 182 AEAT server-side amb guard de permís.
 * El servidor llegeix les dades de Firestore i recalcula (server recompute).
 * Retorna AEATExportResult com JSON — el client gestiona el dialog d'exclosos.
 *
 * Guard: verifyIdToken + capabilities['fiscal.model182.generar'] == true (o role admin)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, verifyIdToken } from '@/lib/api/admin-sdk';
import { generateModel182AEATFile } from '@/lib/model182-aeat';
import { buildModel182Candidates } from '@/lib/model182-aggregation';
import type { Organization, Transaction, AnyContact } from '@/lib/data';
import type { Donation } from '@/lib/types/donations';
import { donationToTransactionLike } from '@/lib/types/donations';

export async function POST(request: NextRequest) {
  // 1. Autenticació
  const auth = await verifyIdToken(request);
  if (!auth) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  // 2. Parsejar body
  let body: { orgId?: string; year?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
  }

  const { orgId, year } = body;
  if (!orgId || typeof orgId !== 'string') {
    return NextResponse.json({ error: 'MISSING_ORG_ID' }, { status: 400 });
  }
  if (!year || typeof year !== 'number' || !Number.isFinite(year)) {
    return NextResponse.json({ error: 'MISSING_YEAR' }, { status: 400 });
  }

  const db = getAdminDb();

  // 3. Guard de permís: llegeix member doc i comprova capabilities
  const memberSnap = await db.doc(`organizations/${orgId}/members/${auth.uid}`).get();
  if (!memberSnap.exists) {
    return NextResponse.json({ error: 'NOT_MEMBER' }, { status: 403 });
  }
  const memberData = memberSnap.data()!;
  const isAdmin = memberData.role === 'admin';
  const hasPerm = isAdmin || (memberData.capabilities?.['fiscal.model182.generar'] === true);
  if (!hasPerm) {
    return NextResponse.json({ error: 'FORBIDDEN', code: 'MISSING_PERMISSION' }, { status: 403 });
  }

  // 4. Llegir dades des de Firestore (server recompute — invariant A2)
  const [orgSnap, txSnap, donationsSnap, contactsSnap] = await Promise.all([
    db.doc(`organizations/${orgId}`).get(),
    db.collection(`organizations/${orgId}/transactions`).get(),
    db.collection(`organizations/${orgId}/donations`).get(),
    db.collection(`organizations/${orgId}/contacts`).get(),
  ]);

  if (!orgSnap.exists) {
    return NextResponse.json({ error: 'ORG_NOT_FOUND' }, { status: 404 });
  }

  const organization = { id: orgId, ...orgSnap.data() } as Organization;
  const transactions = txSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Transaction[];
  const donations = donationsSnap.docs.map((d) =>
    donationToTransactionLike({ id: d.id, ...(d.data() as Donation) })
  );
  const contacts = contactsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as AnyContact[];

  // 5. Filtrar transaccions actives (invariant A2: mateix hotfix que el component)
  const activeTxs = [...transactions, ...donations].filter(tx => !tx.archivedAt);

  // 6. Computar candidats i generar fitxer (amb libs existents, sense canvis)
  const candidates = buildModel182Candidates(activeTxs, contacts, year);
  const result = generateModel182AEATFile(organization, candidates, year);

  // 7. Retornar AEATExportResult com JSON (el client gestiona dialog d'exclosos)
  return NextResponse.json(result);
}
