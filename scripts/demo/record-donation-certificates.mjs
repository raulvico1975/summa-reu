#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { chromium } from 'playwright';

const DEMO_ORG_ID = 'demo-org';
const DEFAULT_BASE_URL = 'http://localhost:9002/demo';
const DEFAULT_TMP_DIR = path.join(process.cwd(), 'tmp', 'donation-certificates-demo');
const DEFAULT_EMAIL = 'demo.recorder@summasocial.local';
const DEFAULT_PASSWORD = 'DemoRecorder!2026';
const SCENARIO_SLUG = 'donation-certificates-demo';
const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), 'output', 'playwright', SCENARIO_SLUG);
const DEMO_DONOR_ID = 'demo_oracle_donor_001';
const DEMO_DONOR_NAME = 'Maria García López';
const DEMO_RETURN_TX_ID = 'demo_oracle_tx_return_donor_001';
const DEMO_REPORT_YEAR = String(new Date().getFullYear());
const COMMERCIAL_VIEWPORT = {
  width: 1920,
  height: 1080,
};
const DEMO_PRESENTATION_SCALE = 0.92;

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
    db.doc(`systemSuperAdmins/${uid}`).set(
      {
        email: normalizedEmail,
        createdAt: nowIso,
        createdBy: 'record-donation-certificates-script',
        autoCreated: true,
      },
      { merge: true }
    ),
    db.doc(`users/${uid}`).set(
      {
        displayName,
        email: normalizedEmail,
        role: 'admin',
        organizationId: DEMO_ORG_ID,
        defaultOrganizationId: DEMO_ORG_ID,
        organizations: [DEMO_ORG_ID],
        updatedAt: nowIso,
      },
      { merge: true }
    ),
    db.doc(`organizations/${DEMO_ORG_ID}/members/${uid}`).set(
      {
        userId: uid,
        email: normalizedEmail,
        displayName,
        role: 'admin',
        joinedAt: nowIso,
        invitationId: 'record-donation-certificates-script',
      },
      { merge: true }
    ),
  ]);

  return {
    uid,
    email: normalizedEmail,
    password,
  };
}

async function assertScenarioDataExists(db) {
  const [donorDoc, returnDoc] = await Promise.all([
    db.doc(`organizations/${DEMO_ORG_ID}/contacts/${DEMO_DONOR_ID}`).get(),
    db.doc(`organizations/${DEMO_ORG_ID}/transactions/${DEMO_RETURN_TX_ID}`).get(),
  ]);

  if (!donorDoc.exists) {
    throw new Error(`No existeix el donant demo ${DEMO_DONOR_ID}. Executa el seed work.`);
  }

  if (!returnDoc.exists) {
    throw new Error(`No existeix la devolució demo ${DEMO_RETURN_TX_ID}. Executa el seed work.`);
  }
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

async function openCertificatesPage(page, credentials, artifactDir) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('#email').fill(credentials.email);
  await page.locator('#password').fill(credentials.password);
  await Promise.all([
    page.waitForURL(/\/demo\/dashboard(?:$|\?)/, { timeout: 30000 }),
    page.getByRole('button', { name: /Acceder|Accedir/i }).click(),
  ]);

  await page.goto(`${BASE_URL}/dashboard/informes/certificats`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: /Certificats|Certificados/i }).waitFor({
    state: 'visible',
    timeout: 30000,
  });
  await waitForAppIdle(page);
  await applyStablePresentation(page);
  await sleep(1400);

  await page.screenshot({
    path: path.join(artifactDir, 'certificates-start.png'),
    fullPage: false,
  });
}

async function runFlow(page, artifactDir) {
  await page.setViewportSize(
    QUALITY_MODE === 'commercial'
      ? { width: COMMERCIAL_VIEWPORT.width, height: COMMERCIAL_VIEWPORT.height }
      : { width: 1440, height: 960 }
  );
  await applyStablePresentation(page);
  await sleep(1000);

  const yearTrigger = page.getByRole('combobox').first();
  await yearTrigger.waitFor({ state: 'visible', timeout: 30000 });
  await moveAndClick(page, yearTrigger);
  let yearOption = page.getByRole('option', { name: DEMO_REPORT_YEAR }).first();
  if (!(await yearOption.count())) {
    yearOption = page.getByText(DEMO_REPORT_YEAR, { exact: true }).last();
  }
  await yearOption.waitFor({ state: 'visible', timeout: 30000 });
  await moveAndClick(page, yearOption);
  await sleep(700);

  const loadButton = page.getByRole('button', { name: /Carregar donants|Cargar donantes/i }).first();
  await loadButton.waitFor({ state: 'visible', timeout: 30000 });
  await moveAndClick(page, loadButton);

  const donorRow = page.locator('tr', { hasText: DEMO_DONOR_NAME }).first();
  await donorRow.waitFor({ state: 'visible', timeout: 30000 });
  await page.getByText(/devolucions|devoluciones/i).first().waitFor({
    state: 'visible',
    timeout: 30000,
  });
  await sleep(2600);

  await page.screenshot({
    path: path.join(artifactDir, 'certificates-list.png'),
    fullPage: false,
  });

  const previewButton = donorRow.locator(
    'button[title*="Vista"], button[title*="Previsual"], button[title*="Preview"]'
  ).first();
  await previewButton.waitFor({ state: 'visible', timeout: 30000 });
  await moveAndClick(page, previewButton);

  const dialog = page.getByRole('dialog');
  await dialog.waitFor({ state: 'visible', timeout: 30000 });
  await dialog.getByText(new RegExp(DEMO_DONOR_NAME, 'i')).first().waitFor({
    state: 'visible',
    timeout: 30000,
  });
  await sleep(3400);

  await page.screenshot({
    path: path.join(artifactDir, 'certificates-preview.png'),
    fullPage: false,
  });
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
  await assertScenarioDataExists(db);

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
    await openCertificatesPage(page, credentials, OUTPUT_DIR);
    const demoStart = Date.now();
    await runFlow(page, OUTPUT_DIR);
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
    donorId: DEMO_DONOR_ID,
    donorName: DEMO_DONOR_NAME,
    reportYear: DEMO_REPORT_YEAR,
    rawVideoPath,
    finalVideoPath,
    durationSeconds: Number(finalDurationSeconds.toFixed(2)),
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
