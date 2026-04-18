import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const rootDir = process.cwd();
const scenario = "summareu-hero-ai-minutes";
const baseUrl = process.env.DEMO_BASE_URL || "http://localhost:3004";
const outDir = path.join(rootDir, "output", "playwright", scenario);
const framesDir = path.join(outDir, "frames");
const segmentsDir = path.join(outDir, "segments");
const mp4Path = path.join(outDir, `${scenario}.mp4`);
const summaryPath = path.join(outDir, "recording-summary.json");
const desktopDir = path.join(os.homedir(), "Desktop", "summareu-demo");
const desktopMp4Path = path.join(desktopDir, "SummaReu-hero-ai-4k.mp4");
const width = 3840;
const height = 2160;
const fps = 30;
const fontRegular = "/System/Library/Fonts/Avenir Next.ttc";
const fontBold = "/System/Library/Fonts/Avenir.ttc";
const productShotWidth = 3080;
const productShotHeight = 1732;
const productShotX = Math.round((width - productShotWidth) / 2);
const productShotY = 330;

const sceneDurations = {
  intro: 2.4,
  ready: 3.4,
  minutes: 3.8,
  outro: 1.8,
};

const xfadeDuration = 0.4;

function escapeDrawtext(value) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll(":", "\\:")
    .replaceAll("'", "\\'")
    .replaceAll(",", "\\,");
}

async function run(command, args, options = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      ...options,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

async function ffprobeDuration(filePath) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", filePath],
      { stdio: ["ignore", "pipe", "inherit"] }
    );

    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe exited with code ${code}`));
        return;
      }

      const parsed = Number.parseFloat(stdout.trim());
      resolve(Number.isFinite(parsed) ? parsed : null);
    });
  });
}

function buildTextFilters({
  eyebrow,
  title,
  subtitle,
  accentY,
  eyebrowY,
  titleY,
  subtitleY,
  x,
  titleSize,
  subtitleSize,
}) {
  const escapedEyebrow = escapeDrawtext(eyebrow);
  const escapedTitle = escapeDrawtext(title);
  const escapedSubtitle = escapeDrawtext(subtitle);

  return [
    `drawbox=x=${x}:y=${accentY}:w=220:h=8:color=0x38bdf8@0.96:t=fill`,
    `drawtext=fontfile='${fontRegular}':text='${escapedEyebrow}':fontcolor=0x9dd7f7:fontsize=42:x=${x + 8}:y=${eyebrowY}`,
    `drawtext=fontfile='${fontBold}':text='${escapedTitle}':fontcolor=white:fontsize=${titleSize}:line_spacing=14:x=${x}:y=${titleY}`,
    `drawtext=fontfile='${fontRegular}':text='${escapedSubtitle}':fontcolor=0xdbe4ee:fontsize=${subtitleSize}:line_spacing=10:x=${x + 6}:y=${subtitleY}`,
  ].join(",");
}

async function seedReadyState() {
  const script = `
process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8085';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
process.env.FIREBASE_STORAGE_EMULATOR_HOST ||= '127.0.0.1:9199';
process.env.FIREBASE_PROJECT_ID ||= 'summa-board';
process.env.FIREBASE_STORAGE_BUCKET ||= 'summa-board.firebasestorage.app';
const { initializeApp, getApps } = await import('firebase-admin/app');
const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
const app = getApps()[0] || initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID, storageBucket: process.env.FIREBASE_STORAGE_BUCKET });
const db = getFirestore(app);
const meetingId = 'demo-meeting';
const recordingId = 'demo-recording';
const transcript = [
  "Anna: Obrim la reunió mensual per validar acords i tancar l'acta sense feina manual.",
  "Pere: Confirmem pressupost, seguiment de subvencions i calendari d'activitats del proper trimestre.",
  "Laia: Queda aprovat el pressupost i encarrego a secretaria revisar els punts clau abans de dijous.",
  "Marc: També acordem compartir l'acta amb la junta i arxivar-la automàticament a Summa Reu.",
  "Anna: Perfecte, deixem responsables i tanquem reunió."
].join('\\n');
const minutesMarkdown = [
  '# Acta de la Junta mensual',
  '',
  '**Generada automàticament amb IA a partir de la gravació**',
  '',
  '## Resum',
  "S'aprova el pressupost del trimestre, es revisa el seguiment de subvencions i es valida el calendari d'activitats.",
  '',
  '## Acords',
  '- Aprovar el pressupost actualitzat del proper trimestre.',
  "- Compartir l'acta final amb la junta directiva.",
  "- Deixar l'acta arxivada a Summa Reu per consulta posterior.",
  '',
  '## Tasques',
  '- Secretaria: revisar punts clau abans de dijous.',
  '- Coordinació: enviar resum i seguiment en 7 dies.',
].join('\\n');
await db.collection('meetings').doc(meetingId).set({
  recordingStatus: 'ready',
  transcript,
  minutesDraft: minutesMarkdown,
  recordingUrl: null,
  lastWebhookAt: Date.now(),
  processingDeadlineAt: null,
  recoveryState: null,
  recoveryReason: null,
}, { merge: true });
await db.collection('meetings').doc(meetingId).collection('transcripts').doc(recordingId).set({
  recordingId,
  status: 'done',
  text: transcript,
  storagePathTxt: null,
  createdAt: FieldValue.serverTimestamp(),
}, { merge: true });
await db.collection('meetings').doc(meetingId).collection('minutes').doc(recordingId).set({
  recordingId,
  status: 'done',
  minutesMarkdown,
  minutesJson: {
    language: 'ca',
    summary: "Aprovació de pressupost, seguiment de subvencions i acta generada sense treball manual.",
    attendees: ['Anna', 'Pere', 'Laia', 'Marc'],
    agenda: ['Pressupost', 'Subvencions', 'Calendari'],
    decisions: [
      { id: 'd1', text: 'Aprovar el pressupost actualitzat del proper trimestre.', owner: 'Tresoreria', dueDate: null, tags: ['pressupost'] },
      { id: 'd2', text: "Arxivar l'acta a Summa Reu i compartir-la amb la junta.", owner: 'Secretaria', dueDate: null, tags: ['acta'] }
    ],
    tasks: [
      { id: 't1', text: 'Revisar punts clau abans de dijous.', owner: 'Secretaria', dueDate: null, status: 'todo' },
      { id: 't2', text: 'Enviar resum i seguiment en 7 dies.', owner: 'Coordinació', dueDate: null, status: 'doing' }
    ]
  },
  createdAt: FieldValue.serverTimestamp(),
}, { merge: true });
console.log(JSON.stringify({ ready: true, meetingId }, null, 2));
`;

  await run("node", [
    "--input-type=module",
    "--eval",
    script,
  ], {
    env: {
      ...process.env,
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:8085",
      FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
      FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
      FIREBASE_PROJECT_ID: "summa-board",
      FIREBASE_STORAGE_BUCKET: "summa-board.firebasestorage.app",
    },
  });
}

async function captureFrames() {
  await fs.mkdir(framesDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1728, height: 972 },
    screen: { width: 1728, height: 972 },
    deviceScaleFactor: 1,
    locale: "ca-ES",
  });

  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  try {
    await page.goto(`${baseUrl}/demo`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForURL(/\/dashboard$/, { timeout: 30000 });
    await page.goto(`${baseUrl}/owner/meetings/demo-meeting`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(framesDir, "ready-top.png") });

    await page.locator("h2", { hasText: /Acta/i }).scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(framesDir, "minutes.png") });
  } finally {
    await context.close();
    await browser.close();
  }
}

async function renderBlurScene({ imagePath, outputPath, durationSeconds, eyebrow, title, subtitle }) {
  const frames = Math.round(durationSeconds * fps);
  const filters = [
    `scale=${width}:${height}:flags=lanczos`,
    "boxblur=24:4",
    "eq=brightness=-0.16:saturation=0.92",
    `zoompan=z='min(zoom+0.00045,1.045)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${width}x${height}:fps=${fps}`,
    "format=yuv420p",
    "drawbox=x=0:y=0:w=3840:h=2160:color=0x07111f@0.46:t=fill",
    buildTextFilters({
      eyebrow,
      title,
      subtitle,
      accentY: 1530,
      eyebrowY: 1562,
      titleY: 1638,
      subtitleY: 1774,
      x: 160,
      titleSize: 110,
      subtitleSize: 54,
    }),
  ];

  await run("ffmpeg", [
    "-y",
    "-loop",
    "1",
    "-i",
    imagePath,
    "-t",
    `${durationSeconds}`,
    "-vf",
    filters.join(","),
    "-r",
    `${fps}`,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    outputPath,
  ]);
}

async function renderProductScene({ imagePath, outputPath, durationSeconds, eyebrow, title, subtitle }) {
  const shadowX = productShotX - 28;
  const shadowY = productShotY - 28;
  const shadowWidth = productShotWidth + 56;
  const shadowHeight = productShotHeight + 56;
  const filterComplex = [
    [
      `[0:v]scale=${width}:${height}:flags=lanczos`,
      "boxblur=32:10",
      "eq=brightness=-0.24:saturation=0.88",
      "format=yuv420p[bg]",
    ].join(","),
    [
      `[1:v]scale=${productShotWidth}:${productShotHeight}:flags=lanczos`,
      "format=rgba[fg]",
    ].join(","),
    [
      `[bg]drawbox=x=0:y=0:w=${width}:h=${height}:color=0x07111f@0.54:t=fill`,
      `drawbox=x=${shadowX}:y=${shadowY}:w=${shadowWidth}:h=${shadowHeight}:color=0x000000@0.24:t=fill`,
      `drawbox=x=${productShotX}:y=${productShotY}:w=${productShotWidth}:h=${productShotHeight}:color=0xffffff@0.12:t=6[base]`,
    ].join(","),
    `[base][fg]overlay=x=${productShotX}:y=${productShotY}[composed]`,
    [
      "[composed]",
      buildTextFilters({
        eyebrow,
        title,
        subtitle,
        accentY: 104,
        eyebrowY: 136,
        titleY: 198,
        subtitleY: 316,
        x: 170,
        titleSize: 84,
        subtitleSize: 40,
      }),
      "[v]",
    ].join(""),
  ].join(";");

  await run("ffmpeg", [
    "-y",
    "-loop",
    "1",
    "-i",
    imagePath,
    "-loop",
    "1",
    "-i",
    imagePath,
    "-t",
    `${durationSeconds}`,
    "-filter_complex",
    filterComplex,
    "-map",
    "[v]",
    "-r",
    `${fps}`,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    outputPath,
  ]);
}

async function combineScenes(segmentPaths) {
  const offsets = [];
  let cursor = sceneDurations.intro - xfadeDuration;
  offsets.push(cursor);
  cursor += sceneDurations.ready - xfadeDuration;
  offsets.push(cursor);
  cursor += sceneDurations.minutes - xfadeDuration;
  offsets.push(cursor);

  await run("ffmpeg", [
    "-y",
    "-i",
    segmentPaths.intro,
    "-i",
    segmentPaths.ready,
    "-i",
    segmentPaths.minutes,
    "-i",
    segmentPaths.outro,
    "-filter_complex",
    [
      `[0:v][1:v]xfade=transition=fade:duration=${xfadeDuration}:offset=${offsets[0]}[v1]`,
      `[v1][2:v]xfade=transition=fade:duration=${xfadeDuration}:offset=${offsets[1]}[v2]`,
      `[v2][3:v]xfade=transition=fade:duration=${xfadeDuration}:offset=${offsets[2]}[v]`,
    ].join(";"),
    "-map",
    "[v]",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    mp4Path,
  ]);
}

async function main() {
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(framesDir, { recursive: true });
  await fs.mkdir(segmentsDir, { recursive: true });
  await fs.mkdir(desktopDir, { recursive: true });

  await seedReadyState();
  await captureFrames();

  const frames = {
    readyTop: path.join(framesDir, "ready-top.png"),
    minutes: path.join(framesDir, "minutes.png"),
  };

  const segments = {
    intro: path.join(segmentsDir, "intro.mp4"),
    ready: path.join(segmentsDir, "ready.mp4"),
    minutes: path.join(segmentsDir, "minutes.mp4"),
    outro: path.join(segmentsDir, "outro.mp4"),
  };

  await renderBlurScene({
    imagePath: frames.minutes,
    outputPath: segments.intro,
    durationSeconds: sceneDurations.intro,
    eyebrow: "SUMMA REU",
    title: "Actes fetes amb IA",
    subtitle: "Grava la reunió una vegada. Tens una acta llesta al moment.",
  });

  await renderProductScene({
    imagePath: frames.readyTop,
    outputPath: segments.ready,
    durationSeconds: sceneDurations.ready,
    eyebrow: "RESULTAT DISPONIBLE",
    title: "La IA prepara transcripció i acta",
    subtitle: "Sense copiar notes, sense perseguir documents, sense feina manual.",
  });

  await renderProductScene({
    imagePath: frames.minutes,
    outputPath: segments.minutes,
    durationSeconds: sceneDurations.minutes,
    eyebrow: "ACTA LLISTA",
    title: "Guardada i exportable en un clic",
    subtitle: "Editable dins de Summa Reu i arxivada per consultar-la quan calgui.",
  });

  await renderBlurScene({
    imagePath: frames.minutes,
    outputPath: segments.outro,
    durationSeconds: sceneDurations.outro,
    eyebrow: "MENYS ESFORÇ ADMINISTRATIU",
    title: "Més decisió. Menys postreunió.",
    subtitle: "Summa Reu",
  });

  await combineScenes(segments);
  await fs.copyFile(mp4Path, desktopMp4Path);

  const durationSeconds = await ffprobeDuration(mp4Path);
  const summary = {
    scenario,
    baseUrl,
    mp4Path,
    desktopMp4Path,
    durationSeconds,
    resolution: { width, height },
    frameRate: fps,
    generatedAt: new Date().toISOString(),
    scenes: ["intro", "ready", "minutes", "outro"],
  };

  await fs.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(summary, null, 2));
}

await main();
