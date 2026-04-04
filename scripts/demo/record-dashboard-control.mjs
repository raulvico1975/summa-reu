#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

import { chromium } from 'playwright';

const BASE_URL = process.env.DEMO_BASE_URL || 'http://localhost:9002/demo';
const EMAIL = process.env.DEMO_RECORDER_EMAIL || 'demo.recorder@summasocial.local';
const PASSWORD = process.env.DEMO_RECORDER_PASSWORD || 'DemoRecorder!2026';
const SCENARIO_SLUG = 'dashboard-control-demo';
const CAPTURE_VIEWPORT = { width: 1920, height: 1080 };
const OUTPUT_DIR = path.join(process.cwd(), 'output', 'playwright', SCENARIO_SLUG);
const TMP_DIR = path.join(process.cwd(), 'tmp', SCENARIO_SLUG);
const OPENING_RAW_DIR = path.join(TMP_DIR, 'video-opening-raw');
const SETTLED_RAW_DIR = path.join(TMP_DIR, 'video-settled-raw');
const PUBLIC_VIDEO = path.join(
  process.cwd(),
  'public',
  'visuals',
  'functionalities',
  'dashboard',
  'animations',
  'dashboard-control-feature-ca.mp4'
);
const PUBLIC_POSTER = path.join(
  process.cwd(),
  'public',
  'visuals',
  'functionalities',
  'dashboard',
  'optimized',
  'dashboard-control-feature-poster-ca.png'
);

function log(message) {
  console.log(`[record-dashboard-control] ${message}`);
}

function fail(message) {
  console.error(`[record-dashboard-control] ERROR: ${message}`);
  process.exit(1);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function resetDir(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
  ensureDir(dirPath);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'pipe',
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || `${command} failed`);
  }
}

function commandPath(name) {
  const result = spawnSync('bash', ['-lc', `command -v ${name}`], {
    stdio: 'pipe',
    encoding: 'utf8',
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

function latestFile(dirPath, extension) {
  if (!fs.existsSync(dirPath)) return null;
  const candidates = fs
    .readdirSync(dirPath)
    .filter((name) => name.endsWith(extension))
    .map((name) => {
      const filePath = path.join(dirPath, name);
      const stats = fs.statSync(filePath);
      return { filePath, mtimeMs: stats.mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates[0]?.filePath ?? null;
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
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

async function waitForDashboard(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => {
    const body = document.body?.innerText || '';
    const euroMatches = body.match(/\d{1,3}(?:\.\d{3})*,\d{2}\s€/g) || [];
    return body.includes('Compartir resum') && body.includes('Obligacions fiscals') && euroMatches.length >= 6;
  }, null, { timeout: 30000 });
}

async function login(page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('#email').fill(EMAIL);
  await page.locator('#password').fill(PASSWORD);
  await Promise.all([
    page.waitForURL(/\/demo\/dashboard(?:$|\?)/, { timeout: 30000 }),
    page.getByRole('button', { name: /Acceder|Accedir/i }).click(),
  ]);
  await waitForDashboard(page);
}

async function createAuthenticatedState(browser) {
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
  await login(authPage);

  const storageStatePath = path.join(TMP_DIR, 'storage-state.json');
  await authContext.storageState({ path: storageStatePath });
  await authContext.close();
  return storageStatePath;
}

async function selectYearFilter(page) {
  const combos = page.getByRole('combobox');
  await combos.nth(0).click();
  await sleep(650);
  await page.getByRole('option', { name: /Any|Año/i }).click();
  await sleep(850);
}

async function waitForStableDashboardMetrics(page) {
  await page.waitForFunction(() => {
    const labels = [
      'Ingressos Totals',
      'Despeses Operatives',
      'Transferències a Terreny',
      'Balanç Operatiu',
    ];

    const findCardText = (label) => {
      const labelNode = Array.from(document.querySelectorAll('p, span, div, a')).find((node) => {
        const text = node.textContent?.replace(/\s+/g, ' ').trim() || '';
        return text === label;
      });

      if (!labelNode) return '';

      const card = labelNode.closest('.rounded-lg');
      if (!card) return '';
      return card.textContent?.replace(/\s+/g, ' ').trim() || '';
    };

    return labels.every((label) => {
      const text = findCardText(label);
      return text.includes(label) && text.includes('€');
    });
  }, null, { timeout: 20000 });

  await sleep(1600);
}

async function moveMouseTo(page, locator) {
  const box = await locator.boundingBox();
  if (!box) return;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 16 });
  await sleep(220);
}

async function createRecordedDashboardContext(browser, storageStatePath, rawDir, targetUrl = `${BASE_URL}/dashboard`) {
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
  await waitForDashboard(page);
  await page.keyboard.press('Escape').catch(() => {});
  await page.mouse.move(960, 40);
  await sleep(1200);
  await hideNoise(page);

  return { context, page };
}

async function runOpeningFlow(page) {
  await waitForStableDashboardMetrics(page);
  const startMs = Date.now();

  await page.screenshot({
    path: path.join(OUTPUT_DIR, 'dashboard-start.png'),
    fullPage: false,
    animations: 'disabled',
  });

  await sleep(2200);
  const combos = page.getByRole('combobox');
  await combos.nth(0).click();
  await sleep(450);
  const yearOption = page.getByRole('option', { name: /Any|Año/i });
  await yearOption.hover().catch(() => {});
  await sleep(650);

  return {
    startMs,
    endMs: Date.now(),
  };
}

async function runSettledFlow(page) {
  await waitForStableDashboardMetrics(page);
  await sleep(1000);
  const startMs = Date.now();

  const moneyBlock = page.getByText(/Diners|Ingressos Totals|Balanç Operatiu|Saldo Operatiu/i).first();
  if (await moneyBlock.isVisible().catch(() => false)) {
    await moveMouseTo(page, moneyBlock);
  }
  await sleep(1800);

  const supportersBlock = page.getByText(/Qui ens sosté|Donants actius|Socis actius/i).first();
  if (await supportersBlock.isVisible().catch(() => false)) {
    await moveMouseTo(page, supportersBlock);
  }
  await sleep(900);

  const fiscalBlock = page.getByText(/Obligacions fiscals|Model 182|Model 347/i).first();
  if (await fiscalBlock.isVisible().catch(() => false)) {
    await moveMouseTo(page, fiscalBlock);
  }
  await sleep(700);

  await page.screenshot({
    path: path.join(OUTPUT_DIR, 'dashboard-overview.png'),
    fullPage: false,
    animations: 'disabled',
  });

  const shareButton = page.getByRole('button', { name: /Compartir resum|Compartir resumen/i });
  await shareButton.click();
  const shareDialog = page.getByRole('dialog');
  await shareDialog.waitFor({ state: 'visible', timeout: 30000 });
  await sleep(3200);

  await page.screenshot({
    path: path.join(OUTPUT_DIR, 'dashboard-share-summary.png'),
    fullPage: false,
    animations: 'disabled',
  });

  const exportExcelButton = shareDialog.getByRole('button', { name: /Excel/i }).first();
  if (await exportExcelButton.isVisible().catch(() => false)) {
    await moveMouseTo(page, exportExcelButton);
  }
  await sleep(1200);

  const emailButton = shareDialog.getByRole('button', { name: /Enviar per email|Enviar por email/i }).first();
  if (await emailButton.isVisible().catch(() => false)) {
    await moveMouseTo(page, emailButton);
  }
  await sleep(3400);

  return {
    startMs,
    endMs: Date.now(),
  };
}

function encodeSegment(ffmpeg, rawInput, outputPath, startSeconds, endSeconds) {
  run(ffmpeg, [
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

async function main() {
  resetDir(OUTPUT_DIR);
  resetDir(TMP_DIR);
  ensureDir(OPENING_RAW_DIR);
  ensureDir(SETTLED_RAW_DIR);
  ensureDir(path.dirname(PUBLIC_VIDEO));
  ensureDir(path.dirname(PUBLIC_POSTER));

  const ffmpeg = commandPath('ffmpeg');
  const ffprobe = commandPath('ffprobe');
  if (!ffmpeg || !ffprobe) {
    fail('No he trobat ffmpeg/ffprobe al sistema.');
  }

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const storageStatePath = await createAuthenticatedState(browser);
  const currentYear = new Date().getFullYear();
  const yearDashboardUrl = `${BASE_URL}/dashboard?periodType=year&periodYear=${currentYear}`;

  let openingContext = null;
  let settledContext = null;

  try {
    const opening = await createRecordedDashboardContext(browser, storageStatePath, OPENING_RAW_DIR);
    openingContext = opening.context;
    const openingFlow = await runOpeningFlow(opening.page);
    await opening.context.close();
    openingContext = null;

    const settled = await createRecordedDashboardContext(browser, storageStatePath, SETTLED_RAW_DIR, yearDashboardUrl);
    settledContext = settled.context;
    const settledFlow = await runSettledFlow(settled.page);
    await settled.context.close();
    settledContext = null;
    await browser.close();

    const openingRawVideo = latestFile(OPENING_RAW_DIR, '.webm');
    const settledRawVideo = latestFile(SETTLED_RAW_DIR, '.webm');
    if (!openingRawVideo || !settledRawVideo) {
      fail('No he trobat tots els vídeos raw de Playwright.');
    }

    const openingRawTarget = path.join(OUTPUT_DIR, `${SCENARIO_SLUG}.opening.raw.webm`);
    const settledRawTarget = path.join(OUTPUT_DIR, `${SCENARIO_SLUG}.settled.raw.webm`);
    fs.copyFileSync(openingRawVideo, openingRawTarget);
    fs.copyFileSync(settledRawVideo, settledRawTarget);

    const openingSegment = path.join(OUTPUT_DIR, `${SCENARIO_SLUG}.opening.segment.mp4`);
    const settledSegment = path.join(OUTPUT_DIR, `${SCENARIO_SLUG}.settled.segment.mp4`);

    const openingRawStartMs = fs.statSync(openingRawVideo).birthtimeMs;
    const settledRawStartMs = fs.statSync(settledRawVideo).birthtimeMs;
    const openingStartSeconds = Math.max(0, (openingFlow.startMs - openingRawStartMs) / 1000 - 0.35);
    const openingEndSeconds = Math.max(openingStartSeconds + 1, (openingFlow.endMs - openingRawStartMs) / 1000 - 0.08);
    const settledStartSeconds = Math.max(0, (settledFlow.startMs - settledRawStartMs) / 1000 - 0.35);
    const settledEndSeconds = Math.max(settledStartSeconds + 1, (settledFlow.endMs - settledRawStartMs) / 1000);

    encodeSegment(ffmpeg, openingRawTarget, openingSegment, openingStartSeconds, openingEndSeconds);
    encodeSegment(ffmpeg, settledRawTarget, settledSegment, settledStartSeconds, settledEndSeconds);

    const finalVideo = path.join(OUTPUT_DIR, `${SCENARIO_SLUG}.mp4`);
    run(ffmpeg, [
      '-y',
      '-i',
      openingSegment,
      '-i',
      settledSegment,
      '-filter_complex',
      '[0:v][1:v]concat=n=2:v=1:a=0[vout]',
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
      finalVideo,
    ]);

    fs.copyFileSync(finalVideo, PUBLIC_VIDEO);

    run(ffmpeg, [
      '-y',
      '-ss',
      '10.0',
      '-i',
      finalVideo,
      '-frames:v',
      '1',
      PUBLIC_POSTER,
    ]);

    const probe = spawnSync(
      ffprobe,
      [
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
      ],
      { stdio: 'pipe', encoding: 'utf8' }
    );

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
    await openingContext?.close().catch(() => {});
    await settledContext?.close().catch(() => {});
    await browser.close().catch(() => {});
    throw error;
  }
}

await main();
