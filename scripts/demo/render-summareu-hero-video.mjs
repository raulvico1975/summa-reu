import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const rootDir = process.cwd();
const scenario = "summareu-hero-video";
const baseUrl = process.env.DEMO_BASE_URL || "http://localhost:3004";
const seedPath = path.join(rootDir, "scripts/.seed-output.json");
const outDir = path.join(rootDir, "output", "playwright", scenario);
const framesDir = path.join(outDir, "frames");
const segmentsDir = path.join(outDir, "segments");
const masterMp4Path = path.join(outDir, "summareu-hero-4k.mp4");
const summaryPath = path.join(outDir, "recording-summary.json");
const publicMediaDir = path.join(rootDir, "public", "media", "hero");
const publicMp4Path = path.join(publicMediaDir, "summareu-hero-loop.mp4");
const publicPosterPath = path.join(publicMediaDir, "summareu-hero-poster.png");
const desktopDir = path.join(os.homedir(), "Desktop", "summareu-demo");
const desktopMasterPath = path.join(desktopDir, "SummaReu-hero-4k.mp4");
const width = 3840;
const height = 2160;
const fps = 30;
const xfadeDuration = 0.5;
const cropWidth = 1280;
const cropHeight = 720;
const cropX = 224;
const cropY = 126;

const sceneDurations = {
  dashboardLead: 3.2,
  poll: 3.4,
  meeting: 3.4,
  dashboardTail: 3.0,
};

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
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(framesDir, "dashboard.png") });

    await page.goto(`${baseUrl}/ca/polls/${pollId}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(framesDir, "poll.png") });

    const meetingHref = await page.getByRole("link", { name: /Obrir reunió/i }).first().getAttribute("href");
    if (!meetingHref) {
      throw new Error("Could not resolve the meeting link from the poll page.");
    }

    await page.goto(new URL(meetingHref, baseUrl).toString(), { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(framesDir, "meeting.png") });
  } finally {
    await context.close();
    await browser.close();
  }
}

async function renderShot({ imagePath, outputPath, durationSeconds }) {
  await run("ffmpeg", [
    "-y",
    "-loop",
    "1",
    "-i",
    imagePath,
    "-t",
    `${durationSeconds}`,
    "-vf",
    [
      `crop=${cropWidth}:${cropHeight}:${cropX}:${cropY}`,
      `scale=${width}:${height}:flags=lanczos`,
      "format=yuv420p",
    ].join(","),
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
  let cursor = sceneDurations.dashboardLead - xfadeDuration;

  offsets.push(cursor);
  cursor += sceneDurations.poll - xfadeDuration;
  offsets.push(cursor);
  cursor += sceneDurations.meeting - xfadeDuration;
  offsets.push(cursor);

  await run("ffmpeg", [
    "-y",
    "-i",
    segmentPaths.dashboardLead,
    "-i",
    segmentPaths.poll,
    "-i",
    segmentPaths.meeting,
    "-i",
    segmentPaths.dashboardTail,
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
    masterMp4Path,
  ]);
}

async function createWebDeliverables() {
  await fs.mkdir(publicMediaDir, { recursive: true });
  await run("ffmpeg", [
    "-y",
    "-i",
    masterMp4Path,
    "-vf",
    "scale=1920:1080:flags=lanczos",
    "-r",
    `${fps}`,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-crf",
    "22",
    "-preset",
    "medium",
    "-movflags",
    "+faststart",
    publicMp4Path,
  ]);

  await run("ffmpeg", [
    "-y",
    "-ss",
    "1.0",
    "-i",
    masterMp4Path,
    "-update",
    "1",
    "-frames:v",
    "1",
    publicPosterPath,
  ]);
}

async function main() {
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(framesDir, { recursive: true });
  await fs.mkdir(segmentsDir, { recursive: true });
  await fs.mkdir(desktopDir, { recursive: true });

  await captureScreens();

  const segments = {
    dashboardLead: path.join(segmentsDir, "dashboard-lead.mp4"),
    poll: path.join(segmentsDir, "poll.mp4"),
    meeting: path.join(segmentsDir, "meeting.mp4"),
    dashboardTail: path.join(segmentsDir, "dashboard-tail.mp4"),
  };

  await renderShot({
    imagePath: path.join(framesDir, "dashboard.png"),
    outputPath: segments.dashboardLead,
    durationSeconds: sceneDurations.dashboardLead,
  });
  await renderShot({
    imagePath: path.join(framesDir, "poll.png"),
    outputPath: segments.poll,
    durationSeconds: sceneDurations.poll,
  });
  await renderShot({
    imagePath: path.join(framesDir, "meeting.png"),
    outputPath: segments.meeting,
    durationSeconds: sceneDurations.meeting,
  });
  await renderShot({
    imagePath: path.join(framesDir, "dashboard.png"),
    outputPath: segments.dashboardTail,
    durationSeconds: sceneDurations.dashboardTail,
  });

  await combineScenes(segments);
  await createWebDeliverables();
  await fs.copyFile(masterMp4Path, desktopMasterPath);

  const durationSeconds = await ffprobeDuration(masterMp4Path);
  const summary = {
    scenario,
    baseUrl,
    masterMp4Path,
    publicMp4Path,
    publicPosterPath,
    desktopMasterPath,
    durationSeconds,
    resolution: {
      width,
      height,
    },
    frameRate: fps,
    generatedAt: new Date().toISOString(),
  };

  await fs.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(summary, null, 2));
}

await main();
