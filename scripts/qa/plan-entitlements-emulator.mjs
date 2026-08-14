import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { initializeApp as initializeAdminApp, deleteApp as deleteAdminApp } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  connectStorageEmulator,
  deleteObject,
  getBytes,
  getStorage,
  ref,
  uploadBytes,
} from 'firebase/storage';

const projectId = process.env.GCLOUD_PROJECT || 'demo-summa-entitlements';
const bucket = `${projectId}.appspot.com`;
const checks = [];
const clientApps = [];

function parseHost(value, fallbackPort) {
  const normalized = (value || `127.0.0.1:${fallbackPort}`).replace(/^https?:\/\//, '');
  const [host, rawPort] = normalized.split(':');
  return { host, port: Number(rawPort) };
}

function exactEntitlements(planId) {
  return {
    'transactionDocuments.readHistorical': true,
    'transactionDocuments.mutate': planId !== 'control',
    'pendingDocuments.mutate': planId === 'complete',
  };
}

function subscription(planId, overrides = {}) {
  return {
    planId,
    status: 'active',
    catalogVersion: 1,
    entitlements: exactEntitlements(planId),
    ...overrides,
  };
}

async function client(label) {
  const app = initializeApp({ projectId, storageBucket: bucket, apiKey: 'demo-key' }, `qa-${label}-${randomUUID()}`);
  clientApps.push(app);
  const auth = getAuth(app);
  const authHost = parseHost(process.env.FIREBASE_AUTH_EMULATOR_HOST, 9099);
  connectAuthEmulator(auth, `http://${authHost.host}:${authHost.port}`, { disableWarnings: true });
  const credential = await signInAnonymously(auth);

  const firestore = getFirestore(app);
  const firestoreHost = parseHost(process.env.FIRESTORE_EMULATOR_HOST, 8080);
  connectFirestoreEmulator(firestore, firestoreHost.host, firestoreHost.port);

  const storage = getStorage(app);
  const storageHost = parseHost(process.env.FIREBASE_STORAGE_EMULATOR_HOST, 9199);
  connectStorageEmulator(storage, storageHost.host, storageHost.port);
  return { uid: credential.user.uid, firestore, storage };
}

async function allowed(label, action) {
  try {
    await action();
    checks.push(label);
    console.log(`ok ${checks.length} - ${label}`);
  } catch (error) {
    throw new Error(`${label}: expected allow, received ${error?.code || error?.message || error}`, { cause: error });
  }
}

async function denied(label, action) {
  try {
    await action();
  } catch (error) {
    const code = String(error?.code || '');
    assert.ok(
      code.includes('permission-denied') || code.includes('unauthorized'),
      `${label}: unexpected rejection ${code || error?.message}`
    );
    checks.push(label);
    console.log(`ok ${checks.length} - ${label}`);
    return;
  }
  throw new Error(`${label}: expected permission denial`);
}

const adminApp = initializeAdminApp({ projectId }, `qa-admin-${randomUUID()}`);
const adminDb = getAdminFirestore(adminApp);

async function seedOrganization(orgId, actor, planId, options = {}) {
  const features = {
    transactionDocuments: true,
    pendingDocs: true,
    ...options.features,
  };
  await adminDb.doc(`organizations/${orgId}`).set({ name: orgId, features });
  await adminDb.doc(`organizations/${orgId}/members/${actor.uid}`).set({
    role: options.role || 'admin',
    userId: actor.uid,
    capabilities: options.capabilities || {
      'moviments.read': true,
      'moviments.editar': true,
    },
  });
  await adminDb.doc(`organizations/${orgId}/subscription/current`).set(
    subscription(planId, options.subscriptionOverrides)
  );
}

function transactionData(documentValue = null) {
  return {
    amount: 10,
    date: '2026-08-14',
    description: 'Moviment QA sintètic',
    document: documentValue,
  };
}

function linkedDocumentData(filename = 'historic.pdf') {
  return {
    url: `organizations/qa/documents/${filename}`,
    filename,
    isPrimary: true,
    createdAt: '2026-08-14T10:00:00.000Z',
    source: 'transaction-upload',
  };
}

const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
const pdfMetadata = { contentType: 'application/pdf' };

async function run() {
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
    throw new Error('Run this script through Firebase emulators:exec (Firestore, Storage and Auth).');
  }

  await adminDb.doc('system/entitlements').set({ enforcementMode: 'active' });

  const management = await client('management');
  const noRead = await client('no-read');
  const corrupt = await client('corrupt');
  const complete = await client('complete');
  const orgManagement = 'qa-management';
  const orgCorrupt = 'qa-corrupt';
  const orgComplete = 'qa-complete';

  await seedOrganization(orgManagement, management, 'management');
  await adminDb.doc(`organizations/${orgManagement}/members/${noRead.uid}`).set({
    role: 'user',
    userId: noRead.uid,
    capabilities: { 'moviments.read': false, 'moviments.editar': true },
  });
  await seedOrganization(orgCorrupt, corrupt, 'management', {
    subscriptionOverrides: {
      entitlements: {
        ...exactEntitlements('management'),
        'pendingDocuments.mutate': true,
      },
    },
  });
  await seedOrganization(orgComplete, complete, 'complete');

  const managementTx = doc(management.firestore, `organizations/${orgManagement}/transactions/management-delete`);
  await allowed('Management creates a parent transaction with document', () =>
    setDoc(managementTx, transactionData('management.pdf'))
  );
  await allowed('Management changes the parent document field', () =>
    updateDoc(managementTx, { document: 'management-v2.pdf' })
  );
  await allowed('Management deletes a parent transaction carrying a document', () => deleteDoc(managementTx));

  const historicalTx = doc(management.firestore, `organizations/${orgManagement}/transactions/historical`);
  const historicalSubdoc = doc(management.firestore, `organizations/${orgManagement}/transactions/historical/documents/historic`);
  await allowed('Management creates historical parent and linked-document metadata', async () => {
    await setDoc(historicalTx, transactionData('historic.pdf'));
    await setDoc(historicalSubdoc, linkedDocumentData());
  });
  await allowed('Management updates linked-document metadata', () =>
    updateDoc(historicalSubdoc, { filename: 'historic-renamed.pdf' })
  );
  const disposableSubdoc = doc(management.firestore, `organizations/${orgManagement}/transactions/historical/documents/disposable`);
  await allowed('Management deletes linked-document metadata', async () => {
    await setDoc(disposableSubdoc, linkedDocumentData('disposable.pdf'));
    await deleteDoc(disposableSubdoc);
  });

  const canonicalHistorical = ref(management.storage, `organizations/${orgManagement}/documents/historical/historic.pdf`);
  const canonicalDisposable = ref(management.storage, `organizations/${orgManagement}/documents/disposable/disposable.pdf`);
  const legacyDisposable = ref(management.storage, `organizations/${orgManagement}/transactions/legacy/legacy.pdf`);
  await allowed('Management uploads and overwrites canonical movement files', async () => {
    await uploadBytes(canonicalHistorical, pdf, pdfMetadata);
    await uploadBytes(canonicalHistorical, new Uint8Array([...pdf, 0x0a]), pdfMetadata);
    await uploadBytes(canonicalDisposable, pdf, pdfMetadata);
  });
  await allowed('Management deletes a canonical movement file', () => deleteObject(canonicalDisposable));
  await allowed('Management uploads, overwrites and deletes the legacy movement path', async () => {
    await uploadBytes(legacyDisposable, pdf, pdfMetadata);
    await uploadBytes(legacyDisposable, new Uint8Array([...pdf, 0x0a]), pdfMetadata);
    await deleteObject(legacyDisposable);
  });
  const offBankFile = ref(management.storage, `organizations/${orgManagement}/offBankExpenses/expense-1/receipt.pdf`);
  await allowed('Generic organization read remains valid outside movement-document paths', async () => {
    await uploadBytes(offBankFile, pdf, pdfMetadata);
    assert.ok((await getBytes(offBankFile)).byteLength > 0);
    await deleteObject(offBankFile);
  });

  const managementPendingDoc = doc(management.firestore, `organizations/${orgManagement}/pendingDocuments/pending-denied`);
  const managementPendingFile = ref(management.storage, `organizations/${orgManagement}/pendingDocuments/pending-denied/invoice.pdf`);
  await denied('Management cannot create pending-document metadata', () =>
    setDoc(managementPendingDoc, { status: 'pending' })
  );
  await denied('Management cannot upload a pending-document file', () =>
    uploadBytes(managementPendingFile, pdf, pdfMetadata)
  );

  const completePendingDoc = doc(complete.firestore, `organizations/${orgComplete}/pendingDocuments/pending-complete`);
  const completePendingFile = ref(complete.storage, `organizations/${orgComplete}/pendingDocuments/pending-complete/invoice.pdf`);
  await allowed('Complete creates, updates and deletes pending-document metadata', async () => {
    await setDoc(completePendingDoc, { status: 'pending' });
    await updateDoc(completePendingDoc, { status: 'reviewed' });
    await deleteDoc(completePendingDoc);
  });
  await allowed('Complete uploads, overwrites and deletes a pending-document file', async () => {
    await uploadBytes(completePendingFile, pdf, pdfMetadata);
    await uploadBytes(completePendingFile, new Uint8Array([...pdf, 0x0a]), pdfMetadata);
    await deleteObject(completePendingFile);
  });

  const corruptTx = doc(corrupt.firestore, `organizations/${orgCorrupt}/transactions/corrupt`);
  const corruptFile = ref(corrupt.storage, `organizations/${orgCorrupt}/documents/corrupt/corrupt.pdf`);
  await denied('Corrupt entitlement snapshot denies Firestore document mutation', () =>
    setDoc(corruptTx, transactionData('corrupt.pdf'))
  );
  await denied('Corrupt entitlement snapshot denies Storage document mutation', () =>
    uploadBytes(corruptFile, pdf, pdfMetadata)
  );

  await adminDb.doc(`organizations/${orgManagement}/subscription/current`).set(subscription('control'));

  await allowed('Control keeps historical Firestore parent and subdocument readable', async () => {
    assert.equal((await getDoc(historicalTx)).exists(), true);
    assert.equal((await getDoc(historicalSubdoc)).exists(), true);
  });
  await allowed('Control with moviments.read downloads a historical Storage file', async () => {
    const bytes = await getBytes(canonicalHistorical);
    assert.ok(bytes.byteLength > 0);
  });
  await denied('Member without moviments.read cannot read historical Firestore metadata', () =>
    getDoc(doc(noRead.firestore, `organizations/${orgManagement}/transactions/historical/documents/historic`))
  );
  await denied('Member without moviments.read cannot download historical Storage file', () =>
    getBytes(ref(noRead.storage, canonicalHistorical.fullPath))
  );

  await denied('Control cannot create a parent transaction with document', () =>
    setDoc(doc(management.firestore, `organizations/${orgManagement}/transactions/control-create`), transactionData('new.pdf'))
  );
  await denied('Control cannot link or replace the parent document field', () =>
    updateDoc(historicalTx, { document: 'replacement.pdf' })
  );
  await denied('Control cannot unlink the parent document field', () =>
    updateDoc(historicalTx, { document: null })
  );
  await denied('Control cannot delete a parent transaction carrying a document', () => deleteDoc(historicalTx));
  await denied('Control cannot create linked-document metadata', () =>
    setDoc(
      doc(management.firestore, `organizations/${orgManagement}/transactions/historical/documents/control-create`),
      linkedDocumentData('control.pdf')
    )
  );
  await denied('Control cannot update linked-document metadata', () =>
    updateDoc(historicalSubdoc, { filename: 'blocked.pdf' })
  );
  await denied('Control cannot delete linked-document metadata', () => deleteDoc(historicalSubdoc));
  await denied('Control cannot upload a movement file', () =>
    uploadBytes(ref(management.storage, `organizations/${orgManagement}/documents/control/new.pdf`), pdf, pdfMetadata)
  );
  await denied('Control cannot overwrite a historical movement file', () =>
    uploadBytes(canonicalHistorical, pdf, pdfMetadata)
  );
  await denied('Control cannot delete a historical movement file', () => deleteObject(canonicalHistorical));

  console.log(`1..${checks.length}`);
  console.log(`# PASS ${checks.length} semantic entitlement checks on local emulators`);
}

try {
  await run();
} finally {
  await Promise.all(clientApps.map((app) => deleteApp(app).catch(() => undefined)));
  await deleteAdminApp(adminApp).catch(() => undefined);
}
