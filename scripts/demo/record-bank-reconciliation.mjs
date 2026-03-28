#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { chromium } from 'playwright';

const DEMO_ORG_ID = 'demo-org';
const DEFAULT_BASE_URL = 'http://localhost:9002/demo';
const DEFAULT_TMP_DIR = path.join(process.cwd(), 'tmp', 'bank-reconciliation-demo');
const DEFAULT_EMAIL = 'demo.recorder@summasocial.local';
const DEFAULT_PASSWORD = 'DemoRecorder!2026';
const SCENARIO_SLUG = 'bank-reconciliation-demo';
const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), 'output', 'playwright', SCENARIO_SLUG);
const DEMO_BANK_ACCOUNT_ID = 'demo_bank_account_main_001';
const COMMERCIAL_VIEWPORT = {
  width: 1920,
  height: 1080,
};
const DEMO_PRESENTATION_SCALE = 0.92;

const SCENARIO_ROWS = {
  candidate: {
    description: 'Factura servei neteja oficina',
    amount: -198.45,
  },
  donor: {
    description: 'Aportacio campanya socies demo conciliacio',
    amount: 45.0,
  },
  supplier: {
    description: 'Factura material oficina demo conciliacio',
    amount: -128.4,
  },
  employee: {
    description: 'Reemborsament desplacament equip demo conciliacio',
    amount: -62.15,
  },
};

const EXPECTED_CATEGORY_LABELS = {
  donor: 'Quotes socis',
  supplier: 'Material oficina',
  employee: 'Viatges i dietes',
};

function log(message) {
  console.log(`[record-demo] ${message}`);
}

function fail(message) {
  console.error(`[record-demo] ERROR: ${message}`);
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function hasFlag(name) {
  return process.argv.includes(name);
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

  if (result.error) {
    throw result.error;
  }

  return result;
}

function findBinary(name) {
  const result = runCommand('bash', ['-lc', `command -v ${name}`]);
  if (result.status !== 0) return null;
  return result.stdout.trim() || null;
}

function formatSeconds(seconds) {
  return Number(seconds.toFixed(2)).toString();
}

function formatCsvAmount(amount) {
  const absolute = Math.abs(Number(amount)).toFixed(2).replace('.', ',');
  return amount < 0 ? `-${absolute}` : absolute;
}

function formatLocalIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatCsvDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  return `${day}/${month}/${year}`;
}

function shiftDate(baseDate, offsetDays) {
  const nextDate = new Date(baseDate);
  nextDate.setDate(nextDate.getDate() + offsetDays);
  return nextDate;
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
    log(`Usuari tecnic reutilitzat (${userRecord.uid}).`);
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
    log(`Usuari tecnic creat (${userRecord.uid}).`);
  }

  const nowIso = new Date().toISOString();
  const uid = userRecord.uid;

  await Promise.all([
    db.doc(`systemSuperAdmins/${uid}`).set({
      email: normalizedEmail,
      createdAt: nowIso,
      createdBy: 'record-bank-reconciliation-script',
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
      invitationId: 'record-bank-reconciliation-script',
    }, { merge: true }),
  ]);

  return {
    uid,
    email: normalizedEmail,
    password,
  };
}

async function deleteTransactionsByDescriptions(db, descriptions) {
  let deletedCount = 0;

  for (const description of descriptions) {
    const snapshot = await db
      .collection(`organizations/${DEMO_ORG_ID}/transactions`)
      .where('description', '==', description)
      .get();

    if (snapshot.empty) continue;

    for (let index = 0; index < snapshot.docs.length; index += 50) {
      const batch = db.batch();
      const chunk = snapshot.docs.slice(index, index + 50);
      chunk.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }

    deletedCount += snapshot.size;
  }

  return deletedCount;
}

async function getScenarioContacts(db) {
  const contactsSnapshot = await db
    .collection(`organizations/${DEMO_ORG_ID}/contacts`)
    .get();

  const contacts = contactsSnapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((contact) => contact.type === 'donor' || contact.type === 'supplier' || contact.type === 'employee')
    .sort((left, right) => left.id.localeCompare(right.id));

  const donor = contacts.find((contact) => contact.type === 'donor' && typeof contact.name === 'string');
  const supplier = contacts.find((contact) => contact.type === 'supplier' && typeof contact.name === 'string');
  const employee = contacts.find((contact) => contact.type === 'employee' && typeof contact.name === 'string');

  if (!donor || !supplier || !employee) {
    fail('No hi ha contactes demo suficients per gravar la conciliacio bancaria.');
  }

  return {
    donor: { id: donor.id, name: donor.name },
    supplier: { id: supplier.id, name: supplier.name },
    employee: { id: employee.id, name: employee.name },
  };
}

async function getDefaultBankAccount(db) {
  const explicitDoc = await db.doc(`organizations/${DEMO_ORG_ID}/bankAccounts/${DEMO_BANK_ACCOUNT_ID}`).get();
  if (explicitDoc.exists) {
    const data = explicitDoc.data() ?? {};
    return {
      id: explicitDoc.id,
      name: data.name ?? explicitDoc.id,
    };
  }

  const bankAccountsSnapshot = await db.collection(`organizations/${DEMO_ORG_ID}/bankAccounts`).get();
  const bankAccounts = bankAccountsSnapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((account) => account.isActive !== false)
    .sort((left, right) => {
      const leftScore = Number(left.isDemoData === true) * 10 + Number(Boolean(left.iban)) * 5 + Number(left.isDefault === true);
      const rightScore = Number(right.isDemoData === true) * 10 + Number(Boolean(right.iban)) * 5 + Number(right.isDefault === true);
      if (leftScore === rightScore) return left.id.localeCompare(right.id);
      return rightScore - leftScore;
    });

  if (bankAccounts.length === 0) {
    fail('La demo no te cap compte bancari actiu per importar extractes.');
  }

  return {
    id: bankAccounts[0].id,
    name: bankAccounts[0].name ?? bankAccounts[0].id,
  };
}

async function prepareScenarioData(db, tmpDir) {
  const bankAccount = await getDefaultBankAccount(db);
  const contacts = await getScenarioContacts(db);

  const descriptionsToPurge = Object.values(SCENARIO_ROWS).map((row) => row.description);
  const deletedCount = await deleteTransactionsByDescriptions(db, descriptionsToPurge);
  if (deletedCount > 0) {
    log(`S'han netejat ${deletedCount} moviments previs del cas de conciliacio.`);
  }

  const today = new Date();
  const candidateExistingDate = shiftDate(today, -5);
  const candidateImportDate = shiftDate(today, -3);
  const donorDate = shiftDate(today, -2);
  const supplierDate = shiftDate(today, -1);
  const employeeDate = shiftDate(today, 0);
  const scenarioKey = Date.now().toString();

  const existingCandidateTxId = 'demo_tx_bank_reconciliation_candidate_001';
  await db.doc(`organizations/${DEMO_ORG_ID}/transactions/${existingCandidateTxId}`).set({
    date: formatLocalIsoDate(candidateExistingDate),
    description: SCENARIO_ROWS.candidate.description,
    note: 'Candidat existent per demo de conciliacio bancaria',
    amount: SCENARIO_ROWS.candidate.amount,
    category: null,
    document: null,
    contactId: null,
    source: 'bank',
    transactionType: 'normal',
    bankAccountId: bankAccount.id,
    createdAt: new Date().toISOString(),
    createdBy: 'record-bank-reconciliation-script',
    updatedAt: FieldValue.serverTimestamp(),
    isDemoData: true,
  }, { merge: true });

  const csvRows = [
    ['D. Operativa', 'Concepte', 'D. Valor', 'Import', 'Saldo'],
    [formatCsvDate(candidateImportDate), SCENARIO_ROWS.candidate.description, formatCsvDate(candidateImportDate), formatCsvAmount(SCENARIO_ROWS.candidate.amount), '9.801,55'],
    [formatCsvDate(donorDate), SCENARIO_ROWS.donor.description, formatCsvDate(donorDate), formatCsvAmount(SCENARIO_ROWS.donor.amount), '9.846,55'],
    [formatCsvDate(supplierDate), SCENARIO_ROWS.supplier.description, formatCsvDate(supplierDate), formatCsvAmount(SCENARIO_ROWS.supplier.amount), '9.718,15'],
    [formatCsvDate(employeeDate), SCENARIO_ROWS.employee.description, formatCsvDate(employeeDate), formatCsvAmount(SCENARIO_ROWS.employee.amount), '9.656,00'],
  ];

  const csvPath = path.join(tmpDir, `bank-reconciliation-${scenarioKey}.csv`);
  fs.writeFileSync(csvPath, `${csvRows.map((row) => row.join(';')).join('\n')}\n`, 'utf8');

  return {
    bankAccount,
    contacts,
    csvPath,
    searchTerm: 'demo conciliacio',
    scenarioKey,
  };
}

async function waitForAppIdle(page) {
  await page.waitForLoadState('domcontentloaded');
  await sleep(600);
}

async function moveAndClick(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 });
    await sleep(180);
  }
  await locator.click();
}

async function setCollapsedSidebarCookie(context, baseUrl) {
  const origin = new URL(baseUrl).origin;
  await context.addCookies([
    {
      name: 'sidebar_state',
      value: 'false',
      url: origin,
      sameSite: 'Lax',
    },
  ]);
}

async function applyStablePresentation(page) {
  await page.evaluate((scale) => {
    document.documentElement.style.zoom = String(scale);
    if (document.body) {
      document.body.style.zoom = String(scale);
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, DEMO_PRESENTATION_SCALE);
  await sleep(250);
}

async function clickButton(page, pattern, scope = page) {
  const locator = scope.getByRole('button', { name: pattern }).first();
  await locator.waitFor({ state: 'visible', timeout: 30000 });
  await moveAndClick(page, locator);
}

async function openMovementsPage(page, credentials, artifactDir) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('#email').fill(credentials.email);
  await page.locator('#password').fill(credentials.password);
  await Promise.all([
    page.waitForURL(/\/demo\/dashboard(?:$|\?)/, { timeout: 30000 }),
    page.getByRole('button', { name: /Acceder|Accedir/i }).click(),
  ]);

  await page.goto(`${BASE_URL}/dashboard/movimientos`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: /Moviments/i }).waitFor({ state: 'visible', timeout: 30000 });
  await waitForAppIdle(page);
  await applyStablePresentation(page);
  await sleep(1400);

  const markerPath = path.join(artifactDir, 'movements-start.png');
  await page.screenshot({ path: markerPath, fullPage: false });
}

async function startImport(page, csvPath) {
  await clickButton(page, /Importar/i);
  await sleep(250);
  const fileInput = page.locator('input[type="file"][accept*=".csv"]').first();
  await fileInput.setInputFiles(csvPath);
}

async function confirmBankAccountDialog(page, artifactDir) {
  const dialog = page.getByRole('dialog');
  await dialog.waitFor({ state: 'visible', timeout: 30000 });
  await dialog.getByRole('button', { name: /Continuar|Continue/i }).first().waitFor({
    state: 'visible',
    timeout: 30000,
  });
  await waitForAppIdle(page);
  await sleep(1400);

  const overlapCheckbox = dialog.locator('#overlap-acknowledge');
  if (await overlapCheckbox.count()) {
    const isChecked = await overlapCheckbox.getAttribute('data-state').catch(() => null);
    if (isChecked !== 'checked') {
      await moveAndClick(page, overlapCheckbox);
      await sleep(300);
    }
  }

  const dialogShotPath = path.join(artifactDir, 'import-account-dialog.png');
  await page.screenshot({ path: dialogShotPath, fullPage: false });

  await clickButton(page, /Continuar|Continue/i, dialog);
}

async function handleDedupeSummary(page, artifactDir) {
  await sleep(3500);
  const precheckPath = path.join(artifactDir, 'after-account-continue.png');
  await page.screenshot({ path: precheckPath, fullPage: false });

  const dialog = page.getByRole('dialog');
  const dialogCount = await dialog.count().catch(() => 0);
  if (dialogCount > 0) {
    const dialogText = await dialog.first().textContent().catch(() => '');
    if (dialogText) {
      log(`Dialog detectat despres del fitxer: ${dialogText.slice(0, 160).replace(/\s+/g, ' ')}`);
    }
  }

  await dialog.waitFor({ state: 'visible', timeout: 30000 });
  await dialog.getByRole('button', { name: /Importar .*nous|Importar .*nuevos|Importar/i }).first().waitFor({
    state: 'visible',
    timeout: 30000,
  });
  await waitForAppIdle(page);
  await sleep(1600);

  const scrollRegion = dialog.locator('.overflow-y-auto').first();
  if (await scrollRegion.count()) {
    await scrollRegion.hover();
    await page.mouse.wheel(0, 380);
    await sleep(900);
  }

  const dedupeShotPath = path.join(artifactDir, 'import-dedupe.png');
  await page.screenshot({ path: dedupeShotPath, fullPage: false });

  await clickButton(page, /Importar 3 nous|Importar .*nous/i, dialog);
  await dialog.waitFor({ state: 'hidden', timeout: 45000 });

  const successToast = page.getByText(
    /Importaci[oó] Exitosa|Importaci[oó]n Exitosa|No hi ha transaccions noves|No hay transacciones nuevas/i
  ).first();
  const errorToast = page.getByText(
    /Error de Processament|Error de Procesamiento|Sessi[oó] no v[aà]lida|Sesion no valida/i
  ).first();

  const toastResult = await Promise.race([
    successToast.waitFor({ state: 'visible', timeout: 9000 }).then(() => 'success').catch(() => null),
    errorToast.waitFor({ state: 'visible', timeout: 9000 }).then(() => 'error').catch(() => null),
    sleep(5000).then(() => 'settled'),
  ]);

  if (toastResult === 'error') {
    const errorPath = path.join(artifactDir, 'import-error.png');
    await page.screenshot({ path: errorPath, fullPage: false });
    const errorText = await errorToast.textContent().catch(() => 'Error desconegut durant la importacio.');
    throw new Error(errorText || 'La importacio ha fallat.');
  }

  await waitForAppIdle(page);
  await sleep(1800);
}

async function searchImportedRows(page, searchTerm) {
  const searchInput = page
    .locator('input[placeholder*="concepte"], input[placeholder*="concepto"], input[placeholder*="nota"], input[placeholder*="importe"]')
    .first();

  if (!(await searchInput.count())) {
    return;
  }

  const waitForTransactionsResponse = () =>
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/transactions/page?') &&
        response.request().method() === 'GET' &&
        response.status() === 200,
      { timeout: 30000 }
    ).catch(() => null);

  const currentValue = (await searchInput.inputValue().catch(() => '')).trim();

  if (currentValue === searchTerm) {
    const clearResponse = waitForTransactionsResponse();
    await searchInput.fill('');
    await clearResponse;
    await sleep(300);
  }

  const fillResponse = waitForTransactionsResponse();
  await searchInput.fill(searchTerm);
  await fillResponse;
  await sleep(1200);
}

async function runBatchCategorization(page) {
  const categorizeButton = page.getByRole('button', {
    name: /Suggerir categories|Sugerir categorias|Sugerir categorias amb IA/i,
  }).first();

  await categorizeButton.waitFor({ state: 'visible', timeout: 30000 });
  await moveAndClick(page, categorizeButton);

  const stopButton = page.getByRole('button', { name: /Aturar|Detener|Stop/i }).first();
  await stopButton.waitFor({ state: 'visible', timeout: 30000 });
  await categorizeButton.waitFor({ state: 'visible', timeout: 90000 });
  await sleep(1800);
}

async function waitForScenarioCategories(db, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  const collection = db.collection(`organizations/${DEMO_ORG_ID}/transactions`);
  const descriptions = [
    SCENARIO_ROWS.donor.description,
    SCENARIO_ROWS.supplier.description,
    SCENARIO_ROWS.employee.description,
  ];

  while (Date.now() < deadline) {
    const snapshots = await Promise.all(
      descriptions.map((description) =>
        collection.where('description', '==', description).limit(1).get()
      )
    );

    const allCategorized = snapshots.every((snapshot) => {
      if (snapshot.empty) return false;
      const data = snapshot.docs[0].data() ?? {};
      return typeof data.category === 'string' && data.category.trim().length > 0;
    });

    if (allCategorized) {
      return;
    }

    await sleep(1500);
  }

  throw new Error('La categoritzacio IA no ha persistit a temps als moviments importats.');
}

async function getRowByDescription(page, description) {
  const row = page.locator('tbody tr:visible').filter({ hasText: description }).first();
  await row.waitFor({ state: 'visible', timeout: 30000 });
  return row;
}

async function assignContactToRow(page, row, contactName) {
  const cells = row.locator('td');
  const cellCount = await cells.count();
  const contactCellIndex = cellCount > 5 ? 5 : Math.max(0, cellCount - 3);
  const contactButton = cells.nth(contactCellIndex).locator('button').first();
  await moveAndClick(page, contactButton);
  await sleep(250);

  const popover = page.locator('[cmdk-root]').last();
  await popover.waitFor({ state: 'visible', timeout: 20000 });

  const searchInput = popover.locator('input').first();
  await searchInput.fill(contactName);
  await sleep(450);

  const option = popover.getByText(contactName, { exact: true }).first();
  await option.waitFor({ state: 'visible', timeout: 20000 });
  await moveAndClick(page, option);
  await popover.waitFor({ state: 'hidden', timeout: 20000 });
  await sleep(700);
}

async function refreshAndFocusScenario(page, searchTerm) {
  await searchImportedRows(page, searchTerm);
  await getRowByDescription(page, SCENARIO_ROWS.donor.description);
  await getRowByDescription(page, SCENARIO_ROWS.supplier.description);
  await getRowByDescription(page, SCENARIO_ROWS.employee.description);
}

async function waitForCategoryLabels(page) {
  const expectations = [
    { description: SCENARIO_ROWS.donor.description, label: EXPECTED_CATEGORY_LABELS.donor },
    { description: SCENARIO_ROWS.supplier.description, label: EXPECTED_CATEGORY_LABELS.supplier },
    { description: SCENARIO_ROWS.employee.description, label: EXPECTED_CATEGORY_LABELS.employee },
  ];

  for (const expectation of expectations) {
    await page.waitForFunction(
      ({ description, label }) => {
        const rows = Array.from(document.querySelectorAll('tbody tr'));
        return rows.some((row) => {
          const element = row;
          const isVisible = element instanceof HTMLElement && element.offsetParent !== null;
          if (!isVisible) return false;
          const text = element.innerText || '';
          return text.includes(description) && text.includes(label);
        });
      },
      expectation,
      {
      timeout: 30000,
      }
    );
  }
}

async function runFlow(page, db, scenarioData, artifactDir) {
  await page.setViewportSize(
    QUALITY_MODE === 'commercial'
      ? { width: COMMERCIAL_VIEWPORT.width, height: COMMERCIAL_VIEWPORT.height }
      : { width: 1440, height: 960 }
  );
  await applyStablePresentation(page);
  await sleep(1200);

  await startImport(page, scenarioData.csvPath);
  await confirmBankAccountDialog(page, artifactDir);
  await handleDedupeSummary(page, artifactDir);
  await refreshAndFocusScenario(page, scenarioData.searchTerm);
  await sleep(1200);

  await runBatchCategorization(page);
  await waitForScenarioCategories(db);
  await refreshAndFocusScenario(page, scenarioData.searchTerm);
  await waitForCategoryLabels(page);
  await sleep(2200);

  const categorizedPath = path.join(artifactDir, 'after-ai-categorization.png');
  await page.screenshot({ path: categorizedPath, fullPage: false });

  const donorRow = await getRowByDescription(page, SCENARIO_ROWS.donor.description);
  await assignContactToRow(page, donorRow, scenarioData.contacts.donor.name);

  const supplierRow = await getRowByDescription(page, SCENARIO_ROWS.supplier.description);
  await assignContactToRow(page, supplierRow, scenarioData.contacts.supplier.name);

  const employeeRow = await getRowByDescription(page, SCENARIO_ROWS.employee.description);
  await assignContactToRow(page, employeeRow, scenarioData.contacts.employee.name);

  await waitForCategoryLabels(page);
  await sleep(1500);

  const resultPath = path.join(artifactDir, 'reconciliation-result.png');
  await page.screenshot({ path: resultPath, fullPage: false });
}

function convertVideo(ffmpegPath, inputPath, outputPath, trimStartSeconds, durationSeconds) {
  const args = [
    '-y',
    '-ss',
    formatSeconds(trimStartSeconds),
    '-i',
    inputPath,
    '-t',
    formatSeconds(durationSeconds),
    '-an',
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '18',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    outputPath,
  ];

  const result = runCommand(ffmpegPath, args);
  if (result.status !== 0) {
    throw new Error(result.stderr || 'ffmpeg ha fallat');
  }
}

const envDemoPath = path.join(process.cwd(), '.env.demo');
loadEnvFile(envDemoPath);
process.env.APP_ENV = process.env.APP_ENV || 'demo';
process.env.NEXT_PUBLIC_APP_ENV = process.env.NEXT_PUBLIC_APP_ENV || 'demo';

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
if (!projectId) {
  fail('Falta NEXT_PUBLIC_FIREBASE_PROJECT_ID a .env.demo.');
}

const QUALITY_MODE = (parseArg('--quality') || process.env.DEMO_RECORDING_QUALITY || 'commercial').trim();
if (!['standard', 'commercial'].includes(QUALITY_MODE)) {
  fail(`Qualitat no suportada: ${QUALITY_MODE}`);
}

const BASE_URL = parseArg('--base-url') || process.env.DEMO_BASE_URL || DEFAULT_BASE_URL;
const OUTPUT_DIR = parseArg('--output') || DEFAULT_OUTPUT_DIR;
const TMP_DIR = parseArg('--tmp') || DEFAULT_TMP_DIR;
const MAX_VIDEO_SECONDS_ARG = parseArg('--duration');
const MAX_VIDEO_SECONDS = MAX_VIDEO_SECONDS_ARG ? Number(MAX_VIDEO_SECONDS_ARG) : null;
const EMAIL = process.env.DEMO_RECORDER_EMAIL || DEFAULT_EMAIL;
const PASSWORD = process.env.DEMO_RECORDER_PASSWORD || DEFAULT_PASSWORD;

async function main() {
  resetDir(OUTPUT_DIR);
  resetDir(TMP_DIR);

  if (hasFlag('--reseed')) {
    log('Reseed work de la demo abans de gravar...');
    const reseedResult = runCommand('node', ['--import', 'tsx', 'scripts/demo/seed-cli.ts', '--mode', 'work'], {
      stdio: 'inherit',
    });
    if (reseedResult.status !== 0) {
      fail('El reseed de demo ha fallat.');
    }
  }

  if (getApps().length === 0) {
    initializeApp({
      credential: applicationDefault(),
      projectId,
    });
  }

  const db = getFirestore();
  const auth = getAuth();
  const credentials = await ensureDemoRecorder(auth, db, EMAIL, PASSWORD);
  const scenarioData = await prepareScenarioData(db, TMP_DIR);

  const ffmpegPath = findBinary('ffmpeg');
  if (!ffmpegPath) {
    fail('No s ha trobat ffmpeg al sistema.');
  }

  log(`Obrint navegador a ${BASE_URL}...`);
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    slowMo: 180,
  });

  const contextOptions = {
    viewport:
      QUALITY_MODE === 'commercial'
        ? { width: COMMERCIAL_VIEWPORT.width, height: COMMERCIAL_VIEWPORT.height }
        : { width: 1440, height: 960 },
    locale: 'ca-ES',
    acceptDownloads: true,
  };

  const videoDir = path.join(TMP_DIR, 'video-raw');
  ensureDir(videoDir);
  contextOptions.recordVideo = {
    dir: videoDir,
    size:
      QUALITY_MODE === 'commercial'
        ? { width: COMMERCIAL_VIEWPORT.width, height: COMMERCIAL_VIEWPORT.height }
        : { width: 1440, height: 960 },
  };

  const context = await browser.newContext(contextOptions);
  context.setDefaultTimeout(30000);
  await setCollapsedSidebarCookie(context, BASE_URL);

  const page = await context.newPage();
  const video = page.video();

  let trimStartSeconds = 0;
  let finalDurationSeconds = 0;
  let rawVideoPath = null;
  let finalVideoPath = null;
  const recordingStartedAt = Date.now();

  try {
    await openMovementsPage(page, credentials, OUTPUT_DIR);
    const demoStart = Date.now();
    await runFlow(page, db, scenarioData, OUTPUT_DIR);
    const demoEnd = Date.now();
    trimStartSeconds = (demoStart - recordingStartedAt) / 1000;
    const measuredDurationSeconds = Math.max(1, (demoEnd - demoStart) / 1000);
    finalDurationSeconds = MAX_VIDEO_SECONDS
      ? Math.min(MAX_VIDEO_SECONDS, measuredDurationSeconds)
      : measuredDurationSeconds;
  } finally {
    await context.close();
    await browser.close();
  }

  if (!video) {
    fail('Playwright no ha retornat cap video.');
  }

  const videoPath = await video.path();
  const rawTargetPath = path.join(OUTPUT_DIR, `${SCENARIO_SLUG}.raw.webm`);
  fs.copyFileSync(videoPath, rawTargetPath);
  rawVideoPath = rawTargetPath;

  finalVideoPath = path.join(OUTPUT_DIR, `${SCENARIO_SLUG}.mp4`);
  convertVideo(ffmpegPath, rawTargetPath, finalVideoPath, trimStartSeconds, finalDurationSeconds);

  const summary = {
    scenario: SCENARIO_SLUG,
    quality: QUALITY_MODE,
    cursorVisible: false,
    baseUrl: BASE_URL,
    email: credentials.email,
    csvPath: scenarioData.csvPath,
    bankAccountId: scenarioData.bankAccount.id,
    rawVideoPath,
    finalVideoPath,
    durationSeconds: Number(finalDurationSeconds.toFixed(2)),
    contacts: scenarioData.contacts,
    searchTerm: scenarioData.searchTerm,
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(OUTPUT_DIR, 'recording-summary.json'), JSON.stringify(summary, null, 2));

  log(`Video final: ${finalVideoPath}`);
  log(`Durada: ${summary.durationSeconds}s`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
