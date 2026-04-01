import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const rootDir = process.cwd();
const scenario = "summareu-demo";
const baseUrl = process.env.DEMO_BASE_URL || "http://127.0.0.1:3002";
const seedPath = path.join(rootDir, "scripts/.seed-output.json");
const outDir = path.join(rootDir, "output", "playwright", scenario);
const rawDir = path.join(outDir, "raw");
const mp4Path = path.join(outDir, `${scenario}.mp4`);
const summaryPath = path.join(outDir, "recording-summary.json");
const targetWidth = 3840;
const targetHeight = 2160;

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

async function findVideoFile(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  let newest = null;
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await findVideoFile(entryPath);
      if (!newest || (nested && (await fs.stat(nested)).mtimeMs > (await fs.stat(newest)).mtimeMs)) {
        newest = nested;
      }
      continue;
    }

    if (entry.name.endsWith(".webm")) {
      if (!newest || (await fs.stat(entryPath)).mtimeMs > (await fs.stat(newest)).mtimeMs) {
        newest = entryPath;
      }
    }
  }

  return newest;
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

async function main() {
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(rawDir, { recursive: true });

  const seedRaw = await fs.readFile(seedPath, "utf8");
  const seed = JSON.parse(seedRaw);
  const ownerEmail = seed.owner?.email;
  const ownerPassword = seed.owner?.password;

  if (!ownerEmail || !ownerPassword) {
    throw new Error("Seed output missing demo owner credentials.");
  }

  const startedAt = Date.now();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: targetWidth, height: targetHeight },
    screen: { width: targetWidth, height: targetHeight },
    deviceScaleFactor: 1,
    locale: "ca-ES",
    recordVideo: {
      dir: rawDir,
      size: { width: targetWidth, height: targetHeight },
    },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  try {
    await page.goto(`${baseUrl}/demo`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForURL(/\/dashboard$/, { timeout: 30000 });
    await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1200);

    await page.getByRole("link", { name: /Gestionar/i }).first().click();
    await page.waitForURL(/\/polls\/[^/]+/);
    await page.waitForTimeout(1000);

    const select = page.locator("select").first();
    if (await select.count()) {
      await select.selectOption({ index: 0 });
    }
    await page.getByRole("button", { name: /Tancar votació/i }).click();
    await page.waitForURL(/\/owner\/meetings\/[^/]+/);
    await page.waitForTimeout(1200);

    await page.evaluate(() => {
      window.open = (...args) => {
        console.info("window.open suppressed for demo", ...args);
        return null;
      };
    });

    await page.getByRole("button", { name: /Entrar a la reunió/i }).click();
    await page.getByText(/s'ha obert en una nova pestanya/i).waitFor();
    await page.waitForTimeout(2200);
  } finally {
    await context.close();
    await browser.close();
  }

  const webmPath = await findVideoFile(rawDir);
  if (!webmPath) {
    throw new Error(`No webm video file was generated in ${rawDir}`);
  }

  await run("ffmpeg", [
    "-y",
    "-i",
    webmPath,
    "-r",
    "30",
    "-vf",
    `scale=${targetWidth}:${targetHeight}:flags=lanczos`,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    mp4Path,
  ]);

  const durationSeconds = await ffprobeDuration(mp4Path);
  const summary = {
    scenario,
    baseUrl,
    mp4Path,
    webmPath,
    durationSeconds,
    resolution: {
      width: targetWidth,
      height: targetHeight,
    },
    frameRate: 30,
    generatedAt: new Date().toISOString(),
    elapsedSeconds: Number(((Date.now() - startedAt) / 1000).toFixed(1)),
  };

  await fs.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(summary, null, 2));
}

await main();
