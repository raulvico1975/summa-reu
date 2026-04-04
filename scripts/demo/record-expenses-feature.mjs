#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { chromium } from 'playwright';
import { getBlockVideoPreset } from './video-block-standards.mjs';

const DEMO_ORG_ID = 'demo-org';
const DEFAULT_BASE_URL = 'http://localhost:9002/demo';
const DEFAULT_EMAIL = 'demo.recorder@summasocial.local';
const DEFAULT_PASSWORD = 'DemoRecorder!2026';
const SCENARIO_SLUG = 'expenses-feature-demo';
const OUTPUT_DIR = path.join(process.cwd(), 'output', 'playwright', SCENARIO_SLUG);
const TMP_DIR = path.join(process.cwd(), 'tmp', SCENARIO_SLUG);
const DRAFT_RAW_DIR = path.join(TMP_DIR, 'draft-raw');
const SEPA_RAW_DIR = path.join(TMP_DIR, 'sepa-raw');
const LIQUIDATIONS_RAW_DIR = path.join(TMP_DIR, 'liquidations-raw');
const PUBLIC_VIDEO = path.join(
  process.cwd(),
  'public',
  'visuals',
  'functionalities',
  'expenses',
  'animations',
  'expenses-feature-ca.mp4'
);
const PUBLIC_POSTER = path.join(
  process.cwd(),
  'public',
  'visuals',
  'functionalities',
  'expenses',
  'optimized',
  'expenses-feature-poster-ca.png'
);
const PUBLIC_VTT = path.join(
  process.cwd(),
  'public',
  'visuals',
  'functionalities',
  'expenses',
  'animations',
  'expenses-feature-ca.vtt'
);
const BLOCK_VIDEO_PRESET = getBlockVideoPreset();
const CAPTURE_VIEWPORT = {
  width: 1600,
  height: 900,
};

const SCENARIO_IDS = {
  draftDoc: 'demo_feature3_doc_draft_invoice_ai',
  confirmedInvoice: 'demo_feature3_doc_confirmed_invoice',
  confirmedPayroll: 'demo_feature3_doc_confirmed_payroll',
  receipt: 'demo_feature3_doc_receipt',
  report: 'demo_feature3_report',
};

const CAPTIONS = [
  { start: 0.0, end: 6.2, text: 'Puges factures i nòmines i la IA et deixa les dades preparades per revisar.' },
  { start: 6.2, end: 12.9, text: 'Quan els documents estan confirmats, pots preparar el pagament SEPA des del mateix flux.' },
  { start: 12.9, end: 22.8, text: 'I les despeses de viatge queden agrupades en una liquidació amb tiquets, quilometratge i PDF llest.' },
];

const FIXED_SEGMENTS = {
  draft: { start: 5.4, end: 9.4 },
  sepa: { start: 3.4, end: 10.4 },
  liquidations: { start: 2.4, end: 10.8 },
};

function log(message) {
  console.log(`[record-expenses-feature] ${message}`);
}

function fail(message) {
  console.error(`[record-expenses-feature] ERROR: ${message}`);
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function resetDir(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
  ensureDir(dirPath);
}

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || process.env[key]) continue;
    if (key === 'GOOGLE_APPLICATION_CREDENTIALS') continue;

    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: 'pipe',
    encoding: 'utf8',
    ...options,
  });

  if (result.error) throw result.error;
  return result;
}

function findBinary(name) {
  const result = runCommand('bash', ['-lc', `command -v ${name}`]);
  return result.status === 0 ? result.stdout.trim() : null;
}

function latestFile(dirPath, extension) {
  if (!fs.existsSync(dirPath)) return null;

  return fs
    .readdirSync(dirPath)
    .filter((name) => name.endsWith(extension))
    .map((name) => {
      const filePath = path.join(dirPath, name);
      const stats = fs.statSync(filePath);
      return { filePath, mtimeMs: stats.mtimeMs };
    })
    .sort((left, right) => right.mtimeMs - left.mtimeMs)[0]?.filePath ?? null;
}

function formatVttTime(totalSeconds) {
  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = Math.floor(safeSeconds % 60);
  const milliseconds = Math.round((safeSeconds - Math.floor(safeSeconds)) * 1000);

  return [
    String(hours).padStart(2, '0'),
    String(minutes).padStart(2, '0'),
    String(seconds).padStart(2, '0'),
  ].join(':') + `.${String(milliseconds).padStart(3, '0')}`;
}

function buildCaptionsVtt() {
  const lines = ['WEBVTT', ''];
  CAPTIONS.forEach((caption, index) => {
    lines.push(String(index + 1));
    lines.push(`${formatVttTime(caption.start)} --> ${formatVttTime(caption.end)}`);
    lines.push(caption.text);
    lines.push('');
  });
  return `${lines.join('\n')}\n`;
}

async function hideNoise(page) {
  await page.addStyleTag({
    content: `
      [data-next-badge-root],
      nextjs-portal,
      #__next-build-watcher,
      button[aria-label="Open Next.js Dev Tools"],
      button[aria-label="Assistent"],
      button[aria-label="Assistant"],
      [data-radix-toast-viewport],
      [data-sonner-toaster],
      [role="status"],
      div[class*="fixed bottom-6 right-6 z-50"],
      div[class*="fixed bottom-6 left-4 z-50"] {
        display: none !important;
      }
    `,
  }).catch(() => {});
}

async function ensureDemoRecorder(auth, db, email, password) {
  const normalizedEmail = email.toLowerCase().trim();
  const displayName = 'Demo Recorder';

  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(normalizedEmail);
    await auth.updateUser(userRecord.uid, {
      password,
      displayName,
      emailVerified: true,
      disabled: false,
    });
    userRecord = await auth.getUser(userRecord.uid);
  } catch (error) {
    if (error?.code !== 'auth/user-not-found') {
      throw error;
    }

    userRecord = await auth.createUser({
      email: normalizedEmail,
      password,
      displayName,
      emailVerified: true,
    });
  }

  const nowIso = new Date().toISOString();
  const uid = userRecord.uid;

  await Promise.all([
    db.doc(`systemSuperAdmins/${uid}`).set({
      email: normalizedEmail,
      createdAt: nowIso,
      createdBy: 'record-expenses-feature-script',
      autoCreated: true,
    }, { merge: true }),
    db.doc(`users/${uid}`).set({
      displayName,
      email: normalizedEmail,
      role: 'admin',
      organizationId: DEMO_ORG_ID,
      defaultOrganizationId: DEMO_ORG_ID,
      organizations: [DEMO_ORG_ID],
      updatedAt: nowIso,
    }, { merge: true }),
    db.doc(`organizations/${DEMO_ORG_ID}/members/${uid}`).set({
      userId: uid,
      email: normalizedEmail,
      displayName,
      role: 'admin',
      joinedAt: nowIso,
      invitationId: 'record-expenses-feature-script',
    }, { merge: true }),
  ]);

  return { uid, email: normalizedEmail, password };
}

async function getScenarioReferences(db) {
  const [contactsSnap, categoriesSnap] = await Promise.all([
    db.collection(`organizations/${DEMO_ORG_ID}/contacts`).get(),
    db.collection(`organizations/${DEMO_ORG_ID}/categories`).get(),
  ]);

  const contacts = contactsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const categories = categoriesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  const supplier =
    contacts.find(
      (contact) =>
        contact.type === 'supplier' &&
        typeof contact.name === 'string' &&
        typeof (contact.iban || contact.bankAccountIban || contact.bankAccount?.iban) === 'string'
    ) ?? null;
  const employee =
    contacts.find((contact) => contact.type === 'employee' && typeof contact.name === 'string') ?? null;
  const expenseCategories = categories.filter((category) => category.type === 'expense');
  const genericExpenseCategory = expenseCategories[0] ?? null;
  const travelCategory =
    expenseCategories.find((category) => /vehicle|viatge|transport|diet/i.test(category.name || '')) ??
    expenseCategories[1] ??
    genericExpenseCategory;

  if (!supplier || !employee || !genericExpenseCategory || !travelCategory) {
    throw new Error('Falten contactes o categories demo per preparar el Bloc 3.');
  }

  return {
    supplier,
    employee,
    genericExpenseCategory,
    travelCategory,
  };
}

async function prepareScenarioData(db) {
  const refs = await getScenarioReferences(db);
  const now = new Date();
  const createdAt = (offsetMinutes) => Timestamp.fromDate(new Date(now.getTime() - offsetMinutes * 60 * 1000));
  const currentYear = now.getFullYear();

  const pendingDocumentsRef = db.collection(`organizations/${DEMO_ORG_ID}/pendingDocuments`);
  const expenseReportsRef = db.collection(`organizations/${DEMO_ORG_ID}/expenseReports`);

  const reportRef = expenseReportsRef.doc(SCENARIO_IDS.report);
  const draftRef = pendingDocumentsRef.doc(SCENARIO_IDS.draftDoc);
  const invoiceRef = pendingDocumentsRef.doc(SCENARIO_IDS.confirmedInvoice);
  const payrollRef = pendingDocumentsRef.doc(SCENARIO_IDS.confirmedPayroll);
  const receiptRef = pendingDocumentsRef.doc(SCENARIO_IDS.receipt);

  await Promise.all([
    reportRef.delete().catch(() => {}),
    draftRef.delete().catch(() => {}),
    invoiceRef.delete().catch(() => {}),
    payrollRef.delete().catch(() => {}),
    receiptRef.delete().catch(() => {}),
  ]);

  const batch = db.batch();

  batch.set(draftRef, {
    status: 'draft',
    type: 'invoice',
    file: {
      storagePath: `organizations/${DEMO_ORG_ID}/pendingDocuments/${SCENARIO_IDS.draftDoc}.pdf`,
      filename: 'factura-manteniment-abril.pdf',
      contentType: 'application/pdf',
      sizeBytes: 382104,
      sha256: null,
    },
    invoiceNumber: 'FAC-2026-0412',
    invoiceDate: `${currentYear}-04-01`,
    amount: 1290.45,
    supplierId: refs.supplier.id,
    categoryId: refs.genericExpenseCategory.id,
    extracted: {
      source: 'ai',
      confidence: 'high',
      evidence: {
        invoiceNumber: 'FAC-2026-0412',
        amount: '1.290,45',
        supplierName: refs.supplier.name,
        invoiceDate: `01/04/${currentYear}`,
      },
    },
    fieldSources: {
      invoiceNumber: 'extracted',
      invoiceDate: 'extracted',
      amount: 'extracted',
      supplierId: 'manual',
      categoryId: 'manual',
    },
    sepa: null,
    matchedTransactionId: null,
    suggestedTransactionIds: [],
    ignoredTransactionIds: [],
    reportId: null,
    createdAt: createdAt(10),
    updatedAt: createdAt(10),
    confirmedAt: null,
  });

  batch.set(invoiceRef, {
    status: 'confirmed',
    type: 'invoice',
    file: {
      storagePath: `organizations/${DEMO_ORG_ID}/pendingDocuments/${SCENARIO_IDS.confirmedInvoice}.pdf`,
      filename: 'factura-lloguer-espai.pdf',
      contentType: 'application/pdf',
      sizeBytes: 245120,
      sha256: null,
    },
    invoiceNumber: 'LL-2026-0415',
    invoiceDate: `${currentYear}-04-02`,
    amount: 842.3,
    supplierId: refs.supplier.id,
    categoryId: refs.genericExpenseCategory.id,
    extracted: null,
    fieldSources: {
      invoiceNumber: 'manual',
      invoiceDate: 'manual',
      amount: 'manual',
      supplierId: 'manual',
      categoryId: 'manual',
    },
    sepa: null,
    matchedTransactionId: null,
    suggestedTransactionIds: [],
    ignoredTransactionIds: [],
    reportId: null,
    createdAt: createdAt(9),
    updatedAt: createdAt(9),
    confirmedAt: createdAt(8),
  });

  batch.set(payrollRef, {
    status: 'confirmed',
    type: 'payroll',
    file: {
      storagePath: `organizations/${DEMO_ORG_ID}/pendingDocuments/${SCENARIO_IDS.confirmedPayroll}.pdf`,
      filename: 'nomina-abril-coordinacio.pdf',
      contentType: 'application/pdf',
      sizeBytes: 198450,
      sha256: null,
    },
    invoiceNumber: 'NOM-2026-04',
    invoiceDate: `${currentYear}-04-03`,
    amount: 1540.0,
    supplierId: refs.employee.id,
    categoryId: refs.genericExpenseCategory.id,
    extracted: null,
    fieldSources: {
      invoiceNumber: 'manual',
      invoiceDate: 'manual',
      amount: 'manual',
      supplierId: 'manual',
      categoryId: 'manual',
    },
    sepa: null,
    matchedTransactionId: null,
    suggestedTransactionIds: [],
    ignoredTransactionIds: [],
    reportId: null,
    createdAt: createdAt(8),
    updatedAt: createdAt(8),
    confirmedAt: createdAt(7),
  });

  batch.set(receiptRef, {
    status: 'matched',
    type: 'receipt',
    file: {
      storagePath: `organizations/${DEMO_ORG_ID}/pendingDocuments/${SCENARIO_IDS.receipt}.jpg`,
      filename: 'tiquet-desplacament-girona.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 154320,
      sha256: null,
    },
    invoiceNumber: null,
    invoiceDate: `${currentYear}-04-04`,
    amount: 86.7,
    supplierId: null,
    categoryId: refs.travelCategory.id,
    extracted: {
      source: 'ai',
      confidence: 'medium',
      evidence: {
        amount: '86,70',
        supplierName: 'Àrea de servei AP-7',
        invoiceDate: `04/04/${currentYear}`,
      },
    },
    fieldSources: {
      invoiceDate: 'extracted',
      amount: 'extracted',
      categoryId: 'manual',
    },
    sepa: null,
    matchedTransactionId: 'demo_feature3_tx_receipt_grouped',
    suggestedTransactionIds: [],
    ignoredTransactionIds: [],
    reportId: SCENARIO_IDS.report,
    createdAt: createdAt(6),
    updatedAt: createdAt(6),
    confirmedAt: createdAt(5),
  });

  batch.set(reportRef, {
    status: 'draft',
    title: 'Desplaçament visita projecte Girona',
    dateFrom: `${currentYear}-04-04`,
    dateTo: `${currentYear}-04-04`,
    location: 'Girona',
    beneficiary: {
      kind: 'employee',
      employeeId: refs.employee.id,
    },
    receiptDocIds: [SCENARIO_IDS.receipt],
    mileage: null,
    mileageItems: [
      {
        id: 'demo_feature3_km_001',
        date: `${currentYear}-04-04`,
        km: 124,
        rateEurPerKm: 0.19,
        totalEur: 23.56,
        notes: 'Anada i tornada Girona',
        attachment: null,
      },
    ],
    totalAmount: 110.26,
    notes: 'Seguiment de projecte i reunió amb equip territorial.',
    matchedTransactionId: null,
    generatedPdf: null,
    sepa: null,
    payment: null,
    createdAt: createdAt(4),
    updatedAt: createdAt(4),
    submittedAt: null,
  });

  await batch.commit();

  return {
    draftFilename: 'factura-manteniment-abril.pdf',
    reportTitle: 'Desplaçament visita projecte Girona',
  };
}

async function login(page, email, password, baseUrl) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await Promise.all([
    page.waitForURL(/\/demo\/dashboard(?:$|\?)/, { timeout: 30000 }),
    page.getByRole('button', { name: /Acceder|Accedir/i }).click(),
  ]);
  await sleep(1200);
}

async function createAuthenticatedState(browser, email, password, baseUrl) {
  const authContext = await browser.newContext({
    viewport: CAPTURE_VIEWPORT,
    locale: 'ca-ES',
  });

  await authContext.addCookies([
    {
      name: 'sidebar_state',
      value: 'false',
      url: 'http://localhost:9002',
      sameSite: 'Lax',
    },
  ]);

  const authPage = await authContext.newPage();
  await login(authPage, email, password, baseUrl);

  const storageStatePath = path.join(TMP_DIR, 'storage-state.json');
  await authContext.storageState({ path: storageStatePath });
  await authContext.close();
  return storageStatePath;
}

async function createRecordedContext(browser, storageStatePath, rawDir, targetUrl) {
  const context = await browser.newContext({
    viewport: CAPTURE_VIEWPORT,
    locale: 'ca-ES',
    storageState: storageStatePath,
    recordVideo: {
      dir: rawDir,
      size: CAPTURE_VIEWPORT,
    },
  });

  await context.addCookies([
    {
      name: 'sidebar_state',
      value: 'false',
      url: 'http://localhost:9002',
      sameSite: 'Lax',
    },
  ]);

  const page = await context.newPage();
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
  await page.keyboard.press('Escape').catch(() => {});
  await page.mouse.move(CAPTURE_VIEWPORT.width * 0.5, 40);
  await sleep(900);
  await hideNoise(page);
  return { context, page };
}

async function waitForPendingDocs(page) {
  await page.getByText(/Pendents de banc|Documents per pagar via SEPA/i).first().waitFor({
    state: 'visible',
    timeout: 30000,
  });
  await sleep(1200);
  await hideNoise(page);
}

async function waitForLiquidacions(page) {
  await page.getByText(/Liquidacions|Agrupa tiquets i quilometratge/i).first().waitFor({
    state: 'visible',
    timeout: 30000,
  });
  await sleep(1200);
  await hideNoise(page);
}

async function runDraftFlow(page, scenarioData) {
  log('Bloc 3 · tram 1: draft amb IA');
  await waitForPendingDocs(page);
  const startMs = Date.now();

  const draftCard = page.getByText(scenarioData.draftFilename).first();
  await draftCard.waitFor({ state: 'visible', timeout: 15000 });
  await sleep(1800);

  const expandButton = page.locator('svg.lucide-chevron-down').first().locator('xpath=..');
  await expandButton.click();
  await sleep(2600);

  await page.screenshot({
    path: path.join(OUTPUT_DIR, 'draft-pending-card.png'),
    fullPage: false,
    animations: 'disabled',
  });

  await sleep(1800);
  return { startMs, endMs: Date.now() };
}

async function runSepaFlow(page) {
  log('Bloc 3 · tram 2: documents confirmats + modal SEPA');
  await waitForPendingDocs(page);
  const startMs = Date.now();

  await page.getByRole('button', { name: /Pendents de banc/i }).click();
  await sleep(1400);

  const selectAll = page.locator('[role="checkbox"]').first();
  await selectAll.click();
  await sleep(900);

  const generateSepaButton = page.getByRole('button', { name: /Generar remesa SEPA/i }).first();
  await generateSepaButton.waitFor({ state: 'visible', timeout: 10000 });
  await generateSepaButton.click();
  const dialog = page.getByRole('dialog').first();
  await dialog.waitFor({ state: 'visible', timeout: 10000 });
  await sleep(3200);

  await page.screenshot({
    path: path.join(OUTPUT_DIR, 'pending-sepa-modal.png'),
    fullPage: false,
    animations: 'disabled',
  });

  await page.keyboard.press('Escape').catch(() => {});
  await dialog.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
  await sleep(500);

  await sleep(1800);
  return { startMs, endMs: Date.now() };
}

async function runLiquidationsFlow(page, scenarioData) {
  log('Bloc 3 · tram 3: liquidacions i tiquets');
  await waitForLiquidacions(page);
  const startMs = Date.now();

  const reportCard = page.getByText(scenarioData.reportTitle).first();
  await reportCard.waitFor({ state: 'visible', timeout: 15000 });
  await sleep(2200);

  await page.screenshot({
    path: path.join(OUTPUT_DIR, 'expense-report-list.png'),
    fullPage: false,
    animations: 'disabled',
  });

  await reportCard.click();

  await page.getByText(/Beneficiari/i).first().waitFor({
    state: 'visible',
    timeout: 15000,
  });
  await sleep(2600);

  await page.screenshot({
    path: path.join(OUTPUT_DIR, 'expense-report-detail.png'),
    fullPage: false,
    animations: 'disabled',
  });

  await sleep(2500);
  return { startMs, endMs: Date.now() };
}

function encodeSegment(ffmpegPath, rawInput, outputPath, startSeconds, endSeconds) {
  runCommand(ffmpegPath, [
    '-y',
    '-i',
    rawInput,
    '-an',
    '-vf',
    `trim=start=${startSeconds.toFixed(2)}:end=${endSeconds.toFixed(2)},setpts=PTS-STARTPTS,scale=3840:2160:flags=lanczos`,
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-r',
    '30',
    '-b:v',
    '18M',
    '-minrate',
    '18M',
    '-maxrate',
    '18M',
    '-bufsize',
    '36M',
    '-x264-params',
    'nal-hrd=cbr:force-cfr=1',
    '-pix_fmt',
    'yuv420p',
    outputPath,
  ]);
}

const envDemoPath = path.join(process.cwd(), '.env.demo');
loadEnvFile(envDemoPath);
process.env.APP_ENV = process.env.APP_ENV || 'demo';
process.env.NEXT_PUBLIC_APP_ENV = process.env.NEXT_PUBLIC_APP_ENV || 'demo';

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
if (!projectId) {
  fail('Falta NEXT_PUBLIC_FIREBASE_PROJECT_ID a .env.demo.');
}

const BASE_URL = process.env.DEMO_BASE_URL || DEFAULT_BASE_URL;
const EMAIL = process.env.DEMO_RECORDER_EMAIL || DEFAULT_EMAIL;
const PASSWORD = process.env.DEMO_RECORDER_PASSWORD || DEFAULT_PASSWORD;

async function main() {
  log('Preparant carpetes i binaris...');
  resetDir(OUTPUT_DIR);
  resetDir(TMP_DIR);
  ensureDir(DRAFT_RAW_DIR);
  ensureDir(SEPA_RAW_DIR);
  ensureDir(LIQUIDATIONS_RAW_DIR);
  ensureDir(path.dirname(PUBLIC_VIDEO));
  ensureDir(path.dirname(PUBLIC_POSTER));
  ensureDir(path.dirname(PUBLIC_VTT));

  const ffmpegPath = findBinary('ffmpeg');
  const ffprobePath = findBinary('ffprobe');
  if (!ffmpegPath || !ffprobePath) {
    fail('No he trobat ffmpeg/ffprobe al sistema.');
  }

  log('Inicialitzant Admin SDK...');
  if (getApps().length === 0) {
    initializeApp({
      credential: applicationDefault(),
      projectId,
    });
  }

  log('Preparant dades demo del Bloc 3...');
  const db = getFirestore();
  const auth = getAuth();
  await ensureDemoRecorder(auth, db, EMAIL, PASSWORD);
  const scenarioData = await prepareScenarioData(db);

  log('Obrint Chrome per gravar...');
  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome',
  });

  let draftContext = null;
  let sepaContext = null;
  let liquidationsContext = null;

  try {
    log('Creant estat autenticat...');
    const storageStatePath = await createAuthenticatedState(browser, EMAIL, PASSWORD, BASE_URL);

    log('Gravant tram draft amb IA...');
    const draft = await createRecordedContext(
      browser,
      storageStatePath,
      DRAFT_RAW_DIR,
      `${BASE_URL}/dashboard/movimientos/pendents`
    );
    draftContext = draft.context;
    const draftFlow = await runDraftFlow(draft.page, scenarioData);
    await draft.context.close();
    draftContext = null;

    log('Gravant tram SEPA...');
    const sepa = await createRecordedContext(
      browser,
      storageStatePath,
      SEPA_RAW_DIR,
      `${BASE_URL}/dashboard/movimientos/pendents`
    );
    sepaContext = sepa.context;
    const sepaFlow = await runSepaFlow(sepa.page);
    await sepa.context.close();
    sepaContext = null;

    log('Gravant tram de liquidacions...');
    const liquidations = await createRecordedContext(
      browser,
      storageStatePath,
      LIQUIDATIONS_RAW_DIR,
      `${BASE_URL}/dashboard/movimientos/liquidacions`
    );
    liquidationsContext = liquidations.context;
    const liquidacionsFlow = await runLiquidationsFlow(liquidations.page, scenarioData);
    await liquidations.context.close();
    liquidationsContext = null;

    await browser.close();

    const draftRaw = latestFile(DRAFT_RAW_DIR, '.webm');
    const sepaRaw = latestFile(SEPA_RAW_DIR, '.webm');
    const liquidationsRaw = latestFile(LIQUIDATIONS_RAW_DIR, '.webm');
    if (!draftRaw || !sepaRaw || !liquidationsRaw) {
      fail('No he trobat tots els vídeos raw del Bloc 3.');
    }

    const draftRawTarget = path.join(OUTPUT_DIR, `${SCENARIO_SLUG}.draft.raw.webm`);
    const sepaRawTarget = path.join(OUTPUT_DIR, `${SCENARIO_SLUG}.sepa.raw.webm`);
    const liquidationsRawTarget = path.join(OUTPUT_DIR, `${SCENARIO_SLUG}.liquidations.raw.webm`);
    fs.copyFileSync(draftRaw, draftRawTarget);
    fs.copyFileSync(sepaRaw, sepaRawTarget);
    fs.copyFileSync(liquidationsRaw, liquidationsRawTarget);

    const draftSegment = path.join(OUTPUT_DIR, `${SCENARIO_SLUG}.draft.segment.mp4`);
    const sepaSegment = path.join(OUTPUT_DIR, `${SCENARIO_SLUG}.sepa.segment.mp4`);
    const liquidacionsSegment = path.join(OUTPUT_DIR, `${SCENARIO_SLUG}.liquidacions.segment.mp4`);

    const draftStartSeconds = FIXED_SEGMENTS.draft.start;
    const draftEndSeconds = FIXED_SEGMENTS.draft.end;
    const sepaStartSeconds = FIXED_SEGMENTS.sepa.start;
    const sepaEndSeconds = FIXED_SEGMENTS.sepa.end;
    const liquidacionsStartSeconds = FIXED_SEGMENTS.liquidations.start;
    const liquidacionsEndSeconds = FIXED_SEGMENTS.liquidations.end;

    log('Codificant segments 4K...');
    encodeSegment(ffmpegPath, draftRawTarget, draftSegment, draftStartSeconds, draftEndSeconds);
    encodeSegment(ffmpegPath, sepaRawTarget, sepaSegment, sepaStartSeconds, sepaEndSeconds);
    encodeSegment(ffmpegPath, liquidationsRawTarget, liquidacionsSegment, liquidacionsStartSeconds, liquidacionsEndSeconds);

    log('Concatenant vídeo final...');
    const finalVideo = path.join(OUTPUT_DIR, `${SCENARIO_SLUG}.mp4`);
    const concatResult = runCommand(ffmpegPath, [
      '-y',
      '-i',
      draftSegment,
      '-i',
      sepaSegment,
      '-i',
      liquidacionsSegment,
      '-filter_complex',
      '[0:v][1:v][2:v]concat=n=3:v=1:a=0[vout]',
      '-map',
      '[vout]',
      '-c:v',
      'libx264',
      '-preset',
      'slow',
      '-r',
      '30',
      '-b:v',
      '18M',
      '-minrate',
      '18M',
      '-maxrate',
      '18M',
      '-bufsize',
      '36M',
      '-x264-params',
      'nal-hrd=cbr:force-cfr=1',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      finalVideo,
    ]);
    if (concatResult.status !== 0) {
      throw new Error(concatResult.stderr || 'No s ha pogut concatenar el vídeo del Bloc 3.');
    }

    fs.copyFileSync(finalVideo, PUBLIC_VIDEO);
    fs.copyFileSync(path.join(OUTPUT_DIR, 'expense-report-list.png'), PUBLIC_POSTER);
    fs.writeFileSync(PUBLIC_VTT, buildCaptionsVtt(), 'utf8');

    const probe = runCommand(ffprobePath, [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height,r_frame_rate,avg_frame_rate,bit_rate',
      '-show_entries',
      'format=duration',
      '-of',
      'json',
      finalVideo,
    ]);

    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'recording-summary.json'),
      JSON.stringify(
        {
          scenario: SCENARIO_SLUG,
          language: 'ca',
          captureViewport: `${CAPTURE_VIEWPORT.width}x${CAPTURE_VIEWPORT.height}`,
          outputVideo: finalVideo,
          publicVideo: PUBLIC_VIDEO,
          publicPoster: PUBLIC_POSTER,
          publicVtt: PUBLIC_VTT,
          ffprobe: probe.stdout ? JSON.parse(probe.stdout) : null,
          createdAt: new Date().toISOString(),
        },
        null,
        2
      )
    );

    log(`Vídeo final: ${finalVideo}`);
    log(`Asset públic: ${PUBLIC_VIDEO}`);
  } catch (error) {
    await draftContext?.close().catch(() => {});
    await sepaContext?.close().catch(() => {});
    await liquidationsContext?.close().catch(() => {});
    await browser.close().catch(() => {});
    throw error;
  }
}

await main();
