import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
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
const rulesLogPath = 'firestore-debug.log';
const expectedDenyEvaluationLines = new Set([396, 465, 476, 483, 726, 728, 817, 820]);
let rulesLogOffset = existsSync(rulesLogPath) ? readFileSync(rulesLogPath, 'utf8').length : 0;

function consumeRulesLog() {
  if (!existsSync(rulesLogPath)) return '';
  const content = readFileSync(rulesLogPath, 'utf8');
  const delta = content.slice(Math.min(rulesLogOffset, content.length));
  rulesLogOffset = content.length;
  return delta;
}

function assertNoRulesEngineFailure(log, label) {
  assert.doesNotMatch(log, /maximum of 1000 expressions reached|Function not found|Invalid function name/i, label);
}

function assertExpectedDenyRulesLog(log, label) {
  assertNoRulesEngineFailure(log, label);
  for (const match of log.matchAll(/evaluation error at L(\d+):/g)) {
    const line = Number(match[1]);
    assert.ok(expectedDenyEvaluationLines.has(line), `${label}: unexpected Rules evaluation error at L${line}`);
  }
}

function parseHost(value, fallbackPort) {
  const normalized = (value || `127.0.0.1:${fallbackPort}`).replace(/^https?:\/\//, '');
  const [host, rawPort] = normalized.split(':');
  return { host, port: Number(rawPort) };
}

function exactEntitlements(planId) {
  return {
    'transactionDocuments.readHistorical': true,
    'transactionDocuments.mutate': planId !== 'control',
    'pendingDocuments.readHistorical': true,
    'pendingDocuments.mutate': planId === 'complete',
    'pendingDocuments.match': planId === 'complete',
    'pendingDocuments.ocr': planId === 'complete',
    'model347.read': planId !== 'control',
    'model347.export': planId !== 'control',
    'aiCategorization.execute': planId !== 'control',
    'closingBundle.export': planId === 'complete',
    'projects.readHistorical': true,
    'projects.mutate': planId === 'complete',
    'projectBudgets.mutate': planId === 'complete',
    'multicurrency.mutate': planId === 'complete',
    'grantJustification.export': planId === 'complete',
  };
}

function subscription(planId, overrides = {}) {
  return {
    planId,
    status: 'active',
    catalogVersion: 3,
    catalogFingerprint: `summa-entitlements-v3-${planId}`,
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
  const orphanedLog = consumeRulesLog();
  assertNoRulesEngineFailure(orphanedLog, `${label}: pre-action log`);
  assert.doesNotMatch(orphanedLog, /evaluation error/i, `${label}: uncorrelated pre-action evaluation error`);
  try {
    await action();
    const actionLog = consumeRulesLog();
    assertNoRulesEngineFailure(actionLog, label);
    assert.doesNotMatch(actionLog, /evaluation error/i, `${label}: ALLOW emitted a Rules evaluation error`);
    checks.push(label);
    console.log(`ok ${checks.length} - ${label}`);
  } catch (error) {
    throw new Error(`${label}: expected allow, received ${error?.code || error?.message || error}`, { cause: error });
  }
}

async function denied(label, action) {
  const orphanedLog = consumeRulesLog();
  assertNoRulesEngineFailure(orphanedLog, `${label}: pre-action log`);
  assert.doesNotMatch(orphanedLog, /evaluation error/i, `${label}: uncorrelated pre-action evaluation error`);
  try {
    await action();
  } catch (error) {
    const code = String(error?.code || '');
    assert.ok(
      code.includes('permission-denied') || code.includes('unauthorized'),
      `${label}: unexpected rejection ${code || error?.message}`
    );
    assertExpectedDenyRulesLog(consumeRulesLog(), label);
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
    projectModule: true,
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

  await adminDb.doc('system/entitlements').set({ enforcementMode: 'active', catalogVersion: 3 });

  const management = await client('management');
  const noRead = await client('no-read');
  const corrupt = await client('corrupt');
  const complete = await client('complete');
  const deniedEditor = await client('denied-editor');
  const projectSectionDenied = await client('project-section-denied');
  const orgManagement = 'qa-management';
  const orgCorrupt = 'qa-corrupt';
  const orgComplete = 'qa-complete';

  await seedOrganization(orgManagement, management, 'management');
  await adminDb.doc(`organizations/${orgManagement}/members/${noRead.uid}`).set({
    role: 'user',
    userId: noRead.uid,
    capabilities: { 'moviments.read': false, 'moviments.editar': true },
    userOverrides: { deny: ['moviments.read'] },
  });
  await seedOrganization(orgCorrupt, corrupt, 'complete', {
    subscriptionOverrides: {
      catalogFingerprint: 'summa-entitlements-v3-management',
      entitlements: {
        ...exactEntitlements('complete'),
        'pendingDocuments.mutate': false,
      },
    },
  });
  await seedOrganization(orgComplete, complete, 'complete');
  await adminDb.doc(`organizations/${orgComplete}/members/${deniedEditor.uid}`).set({
    role: 'admin',
    userId: deniedEditor.uid,
    capabilities: {},
    userOverrides: { deny: ['moviments.editar'] },
  });
  await adminDb.doc(`organizations/${orgComplete}/members/${projectSectionDenied.uid}`).set({
    role: 'admin',
    userId: projectSectionDenied.uid,
    capabilities: {},
    userOverrides: { deny: ['sections.projectes'] },
  });

  const managementOrgRef = doc(management.firestore, `organizations/${orgManagement}`);
  await allowed('Ordinary admin can update an allowlisted organization setting', () =>
    updateDoc(managementOrgRef, { name: 'QA Management updated' })
  );
  await denied('Ordinary admin cannot forge an unknown commercial root field', () =>
    updateDoc(managementOrgRef, { billingFutureOverride: 'complete' })
  );

  const managementTx = doc(management.firestore, `organizations/${orgManagement}/transactions/management-delete`);
  await allowed('Management keeps ordinary bank transaction creation without a document', () =>
    setDoc(managementTx, transactionData())
  );
  await denied('Management cannot bypass the canonical API by changing the parent document field', () =>
    updateDoc(managementTx, { document: 'management-v2.pdf' })
  );
  await adminDb.doc(`organizations/${orgManagement}/transactions/management-delete`).update({ document: 'management.pdf' });
  await adminDb.doc(`organizations/${orgManagement}/transactionDocumentRegistry/management-delete`).set({
    hasDocuments: true,
    documentCount: 1,
    primaryDocumentId: 'legacy',
    registryVersion: 1,
  });
  await denied('Management cannot delete a parent transaction carrying a canonical document marker', () => deleteDoc(managementTx));

  const historicalTx = doc(management.firestore, `organizations/${orgManagement}/transactions/historical`);
  const historicalSubdoc = doc(management.firestore, `organizations/${orgManagement}/transactions/historical/documents/historic`);
  await adminDb.doc(`organizations/${orgManagement}/transactions/historical`).set(transactionData('historic.pdf'));
  await adminDb.doc(`organizations/${orgManagement}/transactions/historical/documents/historic`).set(linkedDocumentData());
  await adminDb.doc(`organizations/${orgManagement}/transactionDocumentRegistry/historical`).set({
    hasDocuments: true,
    documentCount: 1,
    primaryDocumentId: 'historic',
    registryVersion: 1,
  });
  const markerOnlyTx = doc(management.firestore, `organizations/${orgManagement}/transactions/marker-only`);
  await adminDb.doc(`organizations/${orgManagement}/transactions/marker-only`).set(transactionData(null));
  await adminDb.doc(`organizations/${orgManagement}/transactionDocumentRegistry/marker-only`).set({
    hasDocuments: true,
    documentCount: 1,
    primaryDocumentId: 'orphaned-subdoc',
    registryVersion: 1,
  });
  await denied('Management cannot bypass the canonical API by updating linked-document metadata', () =>
    updateDoc(historicalSubdoc, { filename: 'historic-renamed.pdf' })
  );
  const disposableSubdoc = doc(management.firestore, `organizations/${orgManagement}/transactions/historical/documents/disposable`);
  await denied('Management cannot bypass the canonical API by creating linked-document metadata', () =>
    setDoc(disposableSubdoc, linkedDocumentData('disposable.pdf'))
  );
  await denied('Management cannot bypass the canonical API by deleting linked-document metadata', () =>
    deleteDoc(historicalSubdoc)
  );
  await denied('Management cannot forge the backend-owned document registry', () =>
    setDoc(doc(management.firestore, `organizations/${orgManagement}/transactionDocumentRegistry/forged`), {
      hasDocuments: false,
    })
  );

  const canonicalHistorical = ref(management.storage, `organizations/${orgManagement}/documents/historical/historic.pdf`);
  const canonicalDisposable = ref(management.storage, `organizations/${orgManagement}/documents/disposable/disposable.pdf`);
  const legacyDisposable = ref(management.storage, `organizations/${orgManagement}/transactions/legacy/legacy.pdf`);
  await allowed('Management uploads new canonical movement files', async () => {
    await uploadBytes(canonicalHistorical, pdf, pdfMetadata);
    await uploadBytes(canonicalDisposable, pdf, pdfMetadata);
  });
  await denied('Management cannot directly overwrite a canonical movement file', () =>
    uploadBytes(canonicalHistorical, new Uint8Array([...pdf, 0x0a]), pdfMetadata)
  );
  await denied('Management cannot directly delete a canonical movement file', () => deleteObject(canonicalDisposable));
  await allowed('Management uploads a new legacy movement path', () =>
    uploadBytes(legacyDisposable, pdf, pdfMetadata)
  );
  await denied('Management cannot directly overwrite the legacy movement path', () =>
    uploadBytes(legacyDisposable, new Uint8Array([...pdf, 0x0a]), pdfMetadata)
  );
  await denied('Management cannot directly delete the legacy movement path', () => deleteObject(legacyDisposable));
  const offBankFile = ref(management.storage, `organizations/${orgManagement}/offBankExpenses/expense-1/receipt.pdf`);
  await denied('Management cannot upload project-module expense evidence', () =>
    uploadBytes(offBankFile, pdf, pdfMetadata)
  );

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
  const deniedPendingDoc = doc(deniedEditor.firestore, `organizations/${orgComplete}/pendingDocuments/denied-editor`);
  const deniedPendingFile = ref(deniedEditor.storage, `organizations/${orgComplete}/pendingDocuments/denied-editor/invoice.pdf`);
  await denied('Complete member with moviments.editar denied cannot mutate pending metadata', () =>
    setDoc(deniedPendingDoc, { status: 'draft' })
  );
  await denied('Complete member with moviments.editar denied cannot upload pending files', () =>
    uploadBytes(deniedPendingFile, pdf, pdfMetadata)
  );
  await denied('Complete member with moviments.editar denied cannot upload movement documents', () =>
    uploadBytes(
      ref(deniedEditor.storage, `organizations/${orgComplete}/documents/denied-editor/invoice.pdf`),
      pdf,
      pdfMetadata
    )
  );
  await denied('Complete member with moviments.editar denied cannot upload prebank remittances', () =>
    uploadBytes(
      ref(deniedEditor.storage, `organizations/${orgComplete}/prebankRemittances/denied-editor/remittance.xml`),
      new TextEncoder().encode('<?xml version="1.0"?><Document/>'),
      { contentType: 'application/xml' }
    )
  );

  const completeProject = doc(complete.firestore, `organizations/${orgComplete}/projectModule/_/projects/project-1`);
  const completeBudget = doc(complete.firestore, `organizations/${orgComplete}/projectModule/_/projects/project-1/budgetLines/line-1`);
  const completeFx = doc(complete.firestore, `organizations/${orgComplete}/projectModule/_/projects/project-1/fxTransfers/fx-1`);
  const completeReport = doc(complete.firestore, `organizations/${orgComplete}/expenseReports/report-1`);
  const completeOffBankFile = ref(complete.storage, `organizations/${orgComplete}/offBankExpenses/expense-1/receipt.pdf`);
  const completeReportFile = ref(complete.storage, `organizations/${orgComplete}/expenseReports/report-1/report.pdf`);
  await allowed('Complete mutates project, budget, FX and expense report data', async () => {
    await setDoc(completeProject, { name: 'Projecte', status: 'active' });
    await setDoc(completeBudget, { name: 'Partida', budgetedAmountEUR: 100 });
    await setDoc(completeFx, { date: '2026-08-14', eurSent: 10, localReceived: 12 });
    await setDoc(completeReport, { title: 'Liquidació', status: 'draft' });
  });
  await allowed('Complete uploads project and expense-report evidence', async () => {
    await uploadBytes(completeOffBankFile, pdf, pdfMetadata);
    await uploadBytes(completeReportFile, pdf, pdfMetadata);
  });
  await denied('Management cannot mutate project-module data', () =>
    setDoc(doc(management.firestore, `organizations/${orgManagement}/projectModule/_/projects/project-denied`), { name: 'Denied' })
  );
  await denied('Project section deny blocks direct Firestore project mutation', () =>
    setDoc(doc(projectSectionDenied.firestore, `organizations/${orgComplete}/projectModule/_/projects/section-denied`), { name: 'Denied' })
  );
  await denied('Project section deny blocks direct Storage project upload', () =>
    uploadBytes(ref(projectSectionDenied.storage, `organizations/${orgComplete}/offBankExpenses/section-denied/file.pdf`), pdf, pdfMetadata)
  );

  const corruptPending = doc(corrupt.firestore, `organizations/${orgCorrupt}/pendingDocuments/corrupt`);
  const corruptFile = ref(corrupt.storage, `organizations/${orgCorrupt}/pendingDocuments/corrupt/corrupt.pdf`);
  await denied('Cross-plan fingerprint denies premium Firestore mutation', () =>
    setDoc(corruptPending, { status: 'pending' })
  );
  await denied('Cross-plan fingerprint denies premium Storage mutation', () =>
    uploadBytes(corruptFile, pdf, pdfMetadata)
  );
  await adminDb.doc(`organizations/${orgCorrupt}/subscription/current`).set(subscription('complete', {
    entitlements: { ...exactEntitlements('control'), unexpected: true },
  }));
  await allowed('Informational entitlement-map corruption does not change the v3 plan decision', async () => {
    await setDoc(corruptPending, { status: 'pending' });
    await deleteDoc(corruptPending);
  });
  const { catalogFingerprint: _missingFingerprint, ...missingFingerprint } = subscription('complete');
  await adminDb.doc(`organizations/${orgCorrupt}/subscription/current`).set(missingFingerprint);
  await denied('Missing fingerprint denies premium Firestore mutation', () =>
    setDoc(corruptPending, { status: 'pending' })
  );
  await denied('Missing fingerprint denies premium Storage mutation', () =>
    uploadBytes(corruptFile, pdf, pdfMetadata)
  );
  await adminDb.doc(`organizations/${orgCorrupt}/subscription/current`).set(subscription('complete', {
    catalogFingerprint: 'summa-entitlements-v3-unknown',
  }));
  await denied('Unknown fingerprint denies premium Firestore mutation', () =>
    setDoc(corruptPending, { status: 'pending' })
  );
  await adminDb.doc(`organizations/${orgCorrupt}/subscription/current`).set(subscription('complete', {
    status: 'past_due',
  }));
  await denied('Past-due subscription denies premium Firestore mutation', () =>
    setDoc(corruptPending, { status: 'pending' })
  );
  await adminDb.doc(`organizations/${orgCorrupt}/subscription/current`).set(subscription('complete', {
    status: 'cancelled',
  }));
  await denied('Cancelled subscription denies premium Storage mutation', () =>
    uploadBytes(corruptFile, pdf, pdfMetadata)
  );

  const incompatibleConfigPending = doc(complete.firestore, `organizations/${orgComplete}/pendingDocuments/config-v1-denied`);
  const incompatibleConfigFile = ref(management.storage, `organizations/${orgManagement}/documents/config-v1/denied.pdf`);
  await adminDb.doc('system/entitlements').set({ enforcementMode: 'off', catalogVersion: 1 });
  await denied('A v1 system config cannot reopen premium Firestore mutation even in off mode', () =>
    setDoc(incompatibleConfigPending, { status: 'pending' })
  );
  await denied('A v1 system config cannot reopen premium Storage mutation even in off mode', () =>
    uploadBytes(incompatibleConfigFile, pdf, pdfMetadata)
  );

  await adminDb.doc('system/entitlements').delete();
  await denied('Absent system config fails safe for premium Firestore mutation', () =>
    setDoc(doc(complete.firestore, `organizations/${orgComplete}/pendingDocuments/config-absent-denied`), { status: 'pending' })
  );
  await denied('Absent system config fails safe for premium Storage mutation', () =>
    uploadBytes(ref(management.storage, `organizations/${orgManagement}/documents/config-absent/denied.pdf`), pdf, pdfMetadata)
  );

  await adminDb.doc('system/entitlements').set({ enforcementMode: 'invalid', catalogVersion: 3 });
  await denied('Malformed system config mode fails safe for premium Firestore mutation', () =>
    setDoc(doc(complete.firestore, `organizations/${orgComplete}/pendingDocuments/config-mode-denied`), { status: 'pending' })
  );

  await adminDb.doc('system/entitlements').set({ enforcementMode: 'off', catalogVersion: 2 });
  await denied('A v2 system config cannot reopen premium mutation after catalog v3 cutover', () =>
    setDoc(doc(complete.firestore, `organizations/${orgComplete}/pendingDocuments/config-v2-denied`), { status: 'pending' })
  );

  await adminDb.doc('system/entitlements').set({ enforcementMode: 'off', catalogVersion: 3 });
  const offModePending = doc(complete.firestore, `organizations/${orgComplete}/pendingDocuments/config-v3-off-allowed`);
  const offModeFile = ref(management.storage, `organizations/${orgManagement}/documents/config-v3-off/allowed.pdf`);
  await allowed('Only an explicit compatible v3 off config preserves Firestore no-regression mode', async () => {
    await setDoc(offModePending, { status: 'pending' });
    await deleteDoc(offModePending);
  });
  await allowed('Explicit compatible v3 off allows a new Storage upload', () =>
    uploadBytes(offModeFile, pdf, pdfMetadata)
  );
  await denied('Even v3 off cannot directly overwrite a movement file outside the backend API', () =>
    uploadBytes(offModeFile, new Uint8Array([...pdf, 0x0a]), pdfMetadata)
  );
  await denied('Even v3 off cannot directly delete a movement file outside the backend API', () => deleteObject(offModeFile));

  await adminDb.doc('system/entitlements').set({ enforcementMode: 'active', catalogVersion: 3 });

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
  await adminDb.doc(`organizations/${orgComplete}/subscription/current`).set(subscription('control'));
  await allowed('Project downgrade preserves Firestore and Storage historical reads', async () => {
    assert.equal((await getDoc(completeProject)).exists(), true);
    assert.ok((await getBytes(completeOffBankFile)).byteLength > 0);
  });
  await denied('Project downgrade blocks project mutation', () =>
    updateDoc(completeProject, { name: 'No es pot editar' })
  );
  await denied('Project downgrade blocks project Storage mutation', () =>
    uploadBytes(ref(complete.storage, `organizations/${orgComplete}/offBankExpenses/expense-2/new.pdf`), pdf, pdfMetadata)
  );

  await denied('Control cannot create a parent transaction with document', () =>
    setDoc(doc(management.firestore, `organizations/${orgManagement}/transactions/control-create`), transactionData('new.pdf'))
  );
  const controlBankImport = doc(management.firestore, `organizations/${orgManagement}/transactions/control-bank-import`);
  await allowed('Control still creates and deletes an ordinary bank transaction without a document', async () => {
    await setDoc(controlBankImport, transactionData());
    await deleteDoc(controlBankImport);
  });
  await denied('Control cannot link or replace the parent document field', () =>
    updateDoc(historicalTx, { document: 'replacement.pdf' })
  );
  await denied('Control cannot unlink the parent document field', () =>
    updateDoc(historicalTx, { document: null })
  );
  await denied('Control cannot delete a parent transaction carrying a document', () => deleteDoc(historicalTx));
  await denied('Control cannot delete a parent with mirror null while the canonical registry says it has documents', () =>
    deleteDoc(markerOnlyTx)
  );
  const cleanupMarkerTx = doc(management.firestore, `organizations/${orgManagement}/transactions/cleanup-marker`);
  await adminDb.doc(`organizations/${orgManagement}/transactions/cleanup-marker`).set(transactionData(null));
  await adminDb.doc(`organizations/${orgManagement}/transactionDocumentRegistry/cleanup-marker`).set({
    hasDocuments: false,
    documentCount: 0,
    primaryDocumentId: null,
    registryVersion: 1,
    pendingStorageCleanupPaths: [`organizations/${orgManagement}/documents/cleanup-marker/pending.pdf`],
  });
  await denied('Control cannot delete a parent while backend Storage cleanup is pending', () =>
    deleteDoc(cleanupMarkerTx)
  );
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

  const trailingRulesLog = consumeRulesLog();
  assertNoRulesEngineFailure(trailingRulesLog, 'trailing Rules log');
  assert.doesNotMatch(trailingRulesLog, /evaluation error/i, 'uncorrelated trailing Rules evaluation error');
  console.log(`1..${checks.length}`);
  console.log(`# PASS ${checks.length} semantic entitlement checks on local emulators`);
}

try {
  await run();
} finally {
  await Promise.all(clientApps.map((app) => deleteApp(app).catch(() => undefined)));
  await deleteAdminApp(adminApp).catch(() => undefined);
}
