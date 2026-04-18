import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const rootDir = process.cwd();
const scenario = "summareu-premium-video";
const baseUrl = process.env.DEMO_BASE_URL || "http://localhost:3004";
const seedPath = path.join(rootDir, "scripts/.seed-output.json");
const outDir = path.join(rootDir, "output", "playwright", scenario);
const framesDir = path.join(outDir, "frames");
const segmentsDir = path.join(outDir, "segments");
const mp4Path = path.join(outDir, `${scenario}.mp4`);
const summaryPath = path.join(outDir, "recording-summary.json");
const desktopDir = path.join(os.homedir(), "Desktop", "summareu-demo");
const desktopMp4Path = path.join(desktopDir, "SummaReu-premium-4k.mp4");
const width = 3840;
const height = 2160;
const fps = 30;
const fontRegular = "/System/Library/Fonts/Avenir Next.ttc";
const fontBold = "/System/Library/Fonts/Avenir.ttc";
const productShotWidth = 3000;
const productShotHeight = 1688;
const productShotX = Math.round((width - productShotWidth) / 2);
const productShotY = 380;

const sceneDurations = {
  intro: 2.8,
  dashboard: 4.4,
  poll: 4.4,
  meeting: 4.6,
  outro: 2.8,
};

const xfadeDuration = 0.45;

function escapeDrawtext(value) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll(":", "\\:")
    .replaceAll("'", "\\'")
    .replaceAll(",", "\\,");
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
    `drawtext=fontfile='${fontRegular}':text='${escapedSubtitle}':fontcolor=0xd5dde8:fontsize=${subtitleSize}:line_spacing=10:x=${x + 6}:y=${subtitleY}`,
  ].join(",");
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

async function captureScreens() {
  const seed = JSON.parse(await fs.readFile(seedPath, "utf8"));
  const pollId = seed.poll?.pollId;

  if (!pollId) {
    throw new Error("Seed output missing demo poll id.");
  }

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
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(framesDir, "dashboard.png") });

    await page.goto(`${baseUrl}/ca/polls/${pollId}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(framesDir, "poll.png") });

    const meetingHref = await page.getByRole("link", { name: /Obrir reunió/i }).first().getAttribute("href");
    if (!meetingHref) {
      throw new Error("Could not resolve the meeting link from the poll page.");
    }

    await page.goto(new URL(meetingHref, baseUrl).toString(), { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.evaluate(() => {
      window.open = (...args) => {
        console.info("window.open suppressed for premium capture", ...args);
        return null;
      };
    });
    await page.getByRole("button", { name: /Entrar a la reunió/i }).click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(framesDir, "meeting.png") });
  } finally {
    await context.close();
    await browser.close();
  }
}

function buildCaptionFilters({ eyebrow, title, subtitle }) {
  return [
    "drawbox=x=0:y=1500:w=3840:h=660:color=0x07111f@0.26:t=fill",
    buildTextFilters({
      eyebrow,
      title,
      subtitle,
      accentY: 1640,
      eyebrowY: 1672,
      titleY: 1748,
      subtitleY: 1888,
      x: 112,
      titleSize: 102,
      subtitleSize: 50,
    }),
  ].join(",");
}

async function renderScene({ imagePath, outputPath, durationSeconds, eyebrow, title, subtitle, blurred = false }) {
  const frames = Math.round(durationSeconds * fps);
  const baseFilters = [
    `scale=${width}:${height}:flags=lanczos`,
    blurred ? "boxblur=24:3" : null,
    blurred ? "eq=brightness=-0.12:saturation=0.9" : null,
    `zoompan=z='min(zoom+0.00045,1.05)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${width}x${height}:fps=${fps}`,
    "format=yuv420p",
    blurred ? "drawbox=x=0:y=0:w=3840:h=2160:color=0x040912@0.48:t=fill" : null,
    buildCaptionFilters({ eyebrow, title, subtitle }),
  ].filter(Boolean);

  await run("ffmpeg", [
    "-y",
    "-loop",
    "1",
    "-i",
    imagePath,
    "-t",
    `${durationSeconds}`,
    "-vf",
    baseFilters.join(","),
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
      "eq=brightness=-0.22:saturation=0.88",
      "format=yuv420p[bg]",
    ].join(","),
    [
      `[1:v]scale=${productShotWidth}:${productShotHeight}:flags=lanczos`,
      "format=rgba[fg]",
    ].join(","),
    [
      `[bg]drawbox=x=0:y=0:w=${width}:h=${height}:color=0x05101d@0.56:t=fill`,
      `drawbox=x=${shadowX}:y=${shadowY}:w=${shadowWidth}:h=${shadowHeight}:color=0x000000@0.22:t=fill`,
      `drawbox=x=${productShotX}:y=${productShotY}:w=${productShotWidth}:h=${productShotHeight}:color=0xffffff@0.10:t=6[base]`,
    ].join(","),
    `[base][fg]overlay=x=${productShotX}:y=${productShotY}[composed]`,
    [
      "[composed]",
      buildTextFilters({
        eyebrow,
        title,
        subtitle,
        accentY: 112,
        eyebrowY: 144,
        titleY: 206,
        subtitleY: 332,
        x: 180,
        titleSize: 88,
        subtitleSize: 42,
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
  cursor += sceneDurations.dashboard - xfadeDuration;
  offsets.push(cursor);
  cursor += sceneDurations.poll - xfadeDuration;
  offsets.push(cursor);
  cursor += sceneDurations.meeting - xfadeDuration;
  offsets.push(cursor);

  await run("ffmpeg", [
    "-y",
    "-i",
    segmentPaths.intro,
    "-i",
    segmentPaths.dashboard,
    "-i",
    segmentPaths.poll,
    "-i",
    segmentPaths.meeting,
    "-i",
    segmentPaths.outro,
    "-filter_complex",
    [
      `[0:v][1:v]xfade=transition=fade:duration=${xfadeDuration}:offset=${offsets[0]}[v1]`,
      `[v1][2:v]xfade=transition=fade:duration=${xfadeDuration}:offset=${offsets[1]}[v2]`,
      `[v2][3:v]xfade=transition=fade:duration=${xfadeDuration}:offset=${offsets[2]}[v3]`,
      `[v3][4:v]xfade=transition=fade:duration=${xfadeDuration}:offset=${offsets[3]}[v]`,
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

  await captureScreens();

  const images = {
    dashboard: path.join(framesDir, "dashboard.png"),
    poll: path.join(framesDir, "poll.png"),
    meeting: path.join(framesDir, "meeting.png"),
  };

  const segments = {
    intro: path.join(segmentsDir, "intro.mp4"),
    dashboard: path.join(segmentsDir, "dashboard.mp4"),
    poll: path.join(segmentsDir, "poll.mp4"),
    meeting: path.join(segmentsDir, "meeting.mp4"),
    outro: path.join(segmentsDir, "outro.mp4"),
  };

  await renderScene({
    imagePath: images.dashboard,
    outputPath: segments.intro,
    durationSeconds: sceneDurations.intro,
    eyebrow: "SUMMA REU",
    title: "Convoca, vota i tanca actes",
    subtitle: "La plataforma premium per coordinar reunions d'entitats.",
    blurred: true,
  });

  await renderProductScene({
    imagePath: images.dashboard,
    outputPath: segments.dashboard,
    durationSeconds: sceneDurations.dashboard,
    eyebrow: "TAULER OPERATIU",
    title: "Tot el seguiment en un sol espai",
    subtitle: "Votacions actives, resultats i control operatiu sense fils dispersos.",
  });

  await renderProductScene({
    imagePath: images.poll,
    outputPath: segments.poll,
    durationSeconds: sceneDurations.poll,
    eyebrow: "VOTACIONS",
    title: "Tria la millor data amb claredat",
    subtitle: "Comparteix el link, recull disponibilitat i tanca decisions amb context.",
  });

  await renderProductScene({
    imagePath: images.meeting,
    outputPath: segments.meeting,
    durationSeconds: sceneDurations.meeting,
    eyebrow: "REUNIONS I ACTES",
    title: "Obre la reunió, grava i genera una acta",
    subtitle: "Un flux net per documentar acords, transcripció i seguiment.",
  });

  await renderScene({
    imagePath: images.meeting,
    outputPath: segments.outro,
    durationSeconds: sceneDurations.outro,
    eyebrow: "MENYS COORDINACIÓ",
    title: "Més decisió. Més traçabilitat.",
    subtitle: "Summa Reu",
    blurred: true,
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
    resolution: {
      width,
      height,
    },
    frameRate: fps,
    generatedAt: new Date().toISOString(),
    scenes: [
      "intro",
      "dashboard",
      "poll",
      "meeting",
      "outro",
    ],
  };

  await fs.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(summary, null, 2));
}

await main();
