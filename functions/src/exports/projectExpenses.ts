// functions/src/exports/projectExpenses.ts
import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v1";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

type TransactionType = "normal" | "return" | "return_fee" | "donation" | "fee";
type ContactType = "donor" | "supplier" | "employee";

interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  note?: string | null;
  amount: number; // + ingrés, - despesa

  category: string | null; // ID categoria
  categoryName?: string | null;

  contactId?: string | null;
  contactType?: ContactType;
  contactName?: string | null;

  projectId?: string | null;
  projectName?: string | null;

  document?: string | null; // URL del document adjunt (nom correcte del camp)

  isCounterpartTransfer?: boolean;
  isRemittance?: boolean | null;
  isSplit?: boolean;
  parentTransactionId?: string | null;

  transactionType?: TransactionType;

  createdAt?: admin.firestore.Timestamp;
  updatedAt?: admin.firestore.Timestamp;
}

interface ProjectExpenseExportWrite {
  id: string;
  orgId: string;
  schemaVersion: 1;

  source: "summa";
  sourceUpdatedAt: admin.firestore.Timestamp | null;

  date: string;
  amountEUR: number; // amb signe
  currency: "EUR";

  categoryId: string | null;
  categoryName: string | null;

  counterpartyId: string | null;
  counterpartyName: string | null;
  counterpartyType: ContactType | null;

  internalTagId: string | null;
  internalTagName: string | null;

  description: string | null;

  documents: Array<{
    source: "summa";
    storagePath: string | null;
    fileUrl: string | null;
    name: string | null;
  }>;

  isEligibleForProjects: boolean;

  createdAt?: admin.firestore.FieldValue;
  updatedAt: admin.firestore.FieldValue;
  deletedAt: admin.firestore.FieldValue | null;
}

export const exportProjectExpenses = functions
  .region("europe-west1")
  .firestore.document("/organizations/{orgId}/transactions/{transactionId}")
  .onWrite(async (change, context) => {
    const { orgId, transactionId } = context.params as {
      orgId: string;
      transactionId: string;
    };

    const exportRef = db.doc(
      `organizations/${orgId}/exports/projectExpenses/items/${transactionId}`
    );

    const serverTs = admin.firestore.FieldValue.serverTimestamp();

    // DELETE: soft delete només si ja existeix l'export. Si no, no creem res.
    if (!change.after.exists) {
      const existing = await exportRef.get();
      if (!existing.exists) return;

      await exportRef.update({
        deletedAt: serverTs,
        updatedAt: serverTs,
        isEligibleForProjects: false,
      });

      return;
    }

    // CREATE/UPDATE
    const tx = change.after.data() as Transaction;

    const sourceUpdatedAt = tx.updatedAt ?? tx.createdAt ?? null;
    if (!sourceUpdatedAt) {
      functions.logger.warn(
        "exportProjectExpenses: missing tx.updatedAt/tx.createdAt",
        { orgId, transactionId }
      );
    }

    const isEligibleForProjects = calculateEligibility(tx);
    const documents = buildDocuments(tx.document ?? null);

    // El camp tx.category ja conté el nom/codi de la categoria, no l'ID
    // Per tant, categoryName = tx.category directament
    const categoryName: string | null = tx.category ?? null;

    // Lookup contactName si tenim contactId
    let counterpartyName: string | null = null;
    if (tx.contactId) {
      const contactSnap = await db
        .doc(`organizations/${orgId}/contacts/${tx.contactId}`)
        .get();
      if (contactSnap.exists) {
        counterpartyName =
          (contactSnap.data() as { name?: string })?.name ?? null;
      }
    }

    // Preservar createdAt de l'export (només el primer cop)
    const existing = await exportRef.get();

    const payload: ProjectExpenseExportWrite = {
      id: transactionId,
      orgId,
      schemaVersion: 1,

      source: "summa",
      sourceUpdatedAt,

      date: tx.date,
      amountEUR: tx.amount,
      currency: "EUR",

      categoryId: tx.category ?? null,
      categoryName,

      counterpartyId: tx.contactId ?? null,
      counterpartyName,
      counterpartyType: (tx.contactType as ContactType) ?? null,

      internalTagId: tx.projectId ?? null,
      internalTagName: tx.projectName ?? null,

      description: (tx.note ?? tx.description ?? null) as string | null,

      documents,

      isEligibleForProjects,

      updatedAt: serverTs,
      deletedAt: null,
    };

    if (!existing.exists) {
      payload.createdAt = serverTs;
    }

    await exportRef.set(payload, { merge: true });
  });

function calculateEligibility(tx: Transaction): boolean {
  if (tx.amount >= 0) return false;

  if (tx.transactionType === "return" || tx.transactionType === "return_fee") {
    return false;
  }

  if (tx.isCounterpartTransfer === true) return false;
  if (tx.isRemittance === true) return false;
  if (tx.isSplit === true) return false;

  // La categoria global no afecta l'elegibilitat del mòdul Projectes.
  // Les despeses negatives elegibles entren igualment al feed.
  // TODO: si s'implementen transferències internes, excloure-les aquí.
  return true;
}

function buildDocuments(
  documentUrl: string | null
): ProjectExpenseExportWrite["documents"] {
  if (!documentUrl) return [];

  const storagePath = extractStoragePathFromFirebaseStorageUrl(documentUrl);

  return [
    {
      source: "summa",
      storagePath,
      fileUrl: documentUrl,
      name: null,
    },
  ];
}

function extractStoragePathFromFirebaseStorageUrl(url: string): string | null {
  if (!url.includes("/o/")) return null;

  const match = url.match(/\/o\/([^?]+)/);
  if (!match?.[1]) return null;

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}
