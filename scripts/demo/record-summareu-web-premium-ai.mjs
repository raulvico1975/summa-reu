import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";

const rootDir = process.cwd();
const scenario = "summareu-web-combined-v3";
const premiumFramesDir = path.join(rootDir, "output", "playwright", "summareu-premium-video", "frames");
const heroFramesDir = path.join(rootDir, "output", "playwright", "summareu-hero-ai-minutes", "frames");
const outDir = path.join(rootDir, "output", "playwright", scenario);
const segmentsDir = path.join(outDir, "segments");
const mp4Path = path.join(outDir, "SummaReu-web-premium-ai-4k.mp4");
const summaryPath = path.join(outDir, "recording-summary.json");
const desktopDir = path.join(os.homedir(), "Desktop", "summareu-demo");
const desktopMp4Path = path.join(desktopDir, "SummaReu-web-premium-ai-4k.mp4");

const width = 3840;
const height = 2160;
const fps = 30;
const fadeDuration = 0.28;
const fontRegular = "/System/Library/Fonts/Avenir Next.ttc";
const fontBold = "/System/Library/Fonts/Avenir.ttc";
const productShotWidth = 2820;
const productShotHeight = 1586;
const productShotX = Math.round((width - productShotWidth) / 2);
const productShotY = 500;
const textX = 200;

const scenes = [
  {
    id: "intro",
    type: "blur-center",
    imagePath: path.join(premiumFramesDir, "dashboard.png"),
    durationSeconds: 2.4,
    eyebrow: "SUMMA REU",
    title: "Convoca, vota i tanca actes",
    subtitle: "La plataforma premium per coordinar reunions i acords d'entitats.",
  },
  {
    id: "dashboard",
    type: "product",
    imagePath: path.join(premiumFramesDir, "dashboard.png"),
    durationSeconds: 3.7,
    eyebrow: "TAULER OPERATIU",
    title: "Tot el seguiment en un sol espai",
    subtitle: "Votacions actives, resultats i control operatiu sense fils dispersos.",
  },
  {
    id: "poll",
    type: "product",
    imagePath: path.join(premiumFramesDir, "poll.png"),
    durationSeconds: 3.7,
    eyebrow: "VOTACIONS",
    title: "Tria la millor data amb claredat",
    subtitle: "Comparteix el link. Recull disponibilitat i tanca decisions amb context.",
  },
  {
    id: "meeting",
    type: "product",
    imagePath: path.join(premiumFramesDir, "meeting.png"),
    durationSeconds: 3.8,
    eyebrow: "REUNIONS I ACTES",
    title: "Obre la reunió i grava sense fricció",
    subtitle: "Un flux net per documentar acords, transcripció i seguiment.",
  },
  {
    id: "ready",
    type: "product",
    imagePath: path.join(heroFramesDir, "ready-top.png"),
    durationSeconds: 3.4,
    eyebrow: "RESULTAT DISPONIBLE",
    title: "La IA prepara transcripció i acta",
    subtitle: "Sense copiar notes, sense perseguir documents, sense feina manual.",
  },
  {
    id: "minutes",
    type: "product",
    imagePath: path.join(heroFramesDir, "minutes.png"),
    durationSeconds: 3.8,
    eyebrow: "ACTA LLISTA",
    title: "Guardada i exportable en un clic",
    subtitle: "Editable dins de Summa Reu i arxivada per consultar-la quan calgui.",
  },
  {
    id: "outro",
    type: "blur-center",
    imagePath: path.join(heroFramesDir, "minutes.png"),
    durationSeconds: 2.5,
    eyebrow: "MENYS POSTREUNIÓ",
    title: "Actes generades i arxivades sense esforç",
    subtitle: "Summa Reu",
  },
];

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

function buildLeftTextFilters({ eyebrow, title, subtitle }) {
  const escapedEyebrow = escapeDrawtext(eyebrow);
  const escapedTitle = escapeDrawtext(title);
  const escapedSubtitle = escapeDrawtext(subtitle);

  return [
    `drawbox=x=${textX}:y=112:w=210:h=8:color=0x38bdf8@0.96:t=fill`,
    `drawtext=fontfile='${fontRegular}':text='${escapedEyebrow}':fontcolor=0x9dd7f7:fontsize=38:x=${textX + 8}:y=146`,
    `drawtext=fontfile='${fontBold}':text='${escapedTitle}':fontcolor=white:fontsize=80:line_spacing=12:x=${textX}:y=208`,
    `drawtext=fontfile='${fontRegular}':text='${escapedSubtitle}':fontcolor=0xdbe4ee:fontsize=38:line_spacing=10:x=${textX + 6}:y=318`,
  ].join(",");
}

function buildCenteredTextFilters({ eyebrow, title, subtitle }) {
  const escapedEyebrow = escapeDrawtext(eyebrow);
  const escapedTitle = escapeDrawtext(title);
  const escapedSubtitle = escapeDrawtext(subtitle);
  const accentX = Math.round((width - 220) / 2);

  return [
    `drawbox=x=${accentX}:y=760:w=220:h=8:color=0x38bdf8@0.96:t=fill`,
    `drawtext=fontfile='${fontRegular}':text='${escapedEyebrow}':fontcolor=0x9dd7f7:fontsize=38:x=(w-text_w)/2:y=796`,
    `drawtext=fontfile='${fontBold}':text='${escapedTitle}':fontcolor=white:fontsize=92:line_spacing=16:x=(w-text_w)/2:y=884`,
    `drawtext=fontfile='${fontRegular}':text='${escapedSubtitle}':fontcolor=0xdbe4ee:fontsize=42:line_spacing=12:x=(w-text_w)/2:y=1034`,
  ].join(",");
}

async function ensureFrames() {
  for (const scene of scenes) {
    await fs.access(scene.imagePath);
  }
}

async function renderBlurCenteredScene(scene, outputPath) {
  const frames = Math.round(scene.durationSeconds * fps);
  const filters = [
    `scale=${width}:${height}:flags=lanczos`,
    "boxblur=28:5",
    "eq=brightness=-0.18:saturation=0.88",
    `zoompan=z='min(zoom+0.0004,1.04)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${width}x${height}:fps=${fps}`,
    "format=yuv420p",
    "drawbox=x=0:y=0:w=3840:h=2160:color=0x07111f@0.52:t=fill",
    buildCenteredTextFilters(scene),
  ];

  await run("ffmpeg", [
    "-y",
    "-loop",
    "1",
    "-i",
    scene.imagePath,
    "-t",
    `${scene.durationSeconds}`,
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

async function renderProductScene(scene, outputPath) {
  const shadowX = productShotX - 24;
  const shadowY = productShotY - 24;
  const shadowWidth = productShotWidth + 48;
  const shadowHeight = productShotHeight + 48;

  const filterComplex = [
    [
      `[0:v]scale=${width}:${height}:flags=lanczos`,
      "boxblur=30:10",
      "eq=brightness=-0.24:saturation=0.84",
      "format=yuv420p[bg]",
    ].join(","),
    [
      `[1:v]scale=${productShotWidth}:${productShotHeight}:flags=lanczos`,
      "format=rgba[fg]",
    ].join(","),
    [
      `[bg]drawbox=x=0:y=0:w=${width}:h=${height}:color=0x07111f@0.56:t=fill`,
      "drawbox=x=0:y=0:w=3840:h=420:color=0x050d17@0.42:t=fill",
      `drawbox=x=${shadowX}:y=${shadowY}:w=${shadowWidth}:h=${shadowHeight}:color=0x000000@0.24:t=fill`,
      `drawbox=x=${productShotX}:y=${productShotY}:w=${productShotWidth}:h=${productShotHeight}:color=0xffffff@0.10:t=6[base]`,
    ].join(","),
    `[base][fg]overlay=x=${productShotX}:y=${productShotY}[composed]`,
    [
      "[composed]",
      buildLeftTextFilters(scene),
      "[v]",
    ].join(""),
  ].join(";");

  await run("ffmpeg", [
    "-y",
    "-loop",
    "1",
    "-i",
    scene.imagePath,
    "-loop",
    "1",
    "-i",
    scene.imagePath,
    "-t",
    `${scene.durationSeconds}`,
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

async function applySegmentFade(inputPath, outputPath, durationSeconds) {
  const fadeOutStart = Math.max(durationSeconds - fadeDuration, 0);

  await run("ffmpeg", [
    "-y",
    "-i",
    inputPath,
    "-vf",
    `fade=t=in:st=0:d=${fadeDuration},fade=t=out:st=${fadeOutStart}:d=${fadeDuration}`,
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
  const args = ["-y"];

  for (const segmentPath of segmentPaths) {
    args.push("-i", segmentPath);
  }

  const concatInputs = segmentPaths.map((_, index) => `[${index}:v]`).join("");

  args.push(
    "-filter_complex",
    `${concatInputs}concat=n=${segmentPaths.length}:v=1:a=0[v]`,
    "-map",
    "[v]",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    mp4Path
  );

  await run("ffmpeg", args);
}

async function main() {
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(segmentsDir, { recursive: true });
  await fs.mkdir(desktopDir, { recursive: true });

  await ensureFrames();

  const segmentPaths = [];

  for (const scene of scenes) {
    const rawOutputPath = path.join(segmentsDir, `${scene.id}.raw.mp4`);
    const outputPath = path.join(segmentsDir, `${scene.id}.mp4`);
    segmentPaths.push(outputPath);

    if (scene.type === "blur-center") {
      await renderBlurCenteredScene(scene, rawOutputPath);
      await applySegmentFade(rawOutputPath, outputPath, scene.durationSeconds);
      continue;
    }

    await renderProductScene(scene, rawOutputPath);
    await applySegmentFade(rawOutputPath, outputPath, scene.durationSeconds);
  }

  await combineScenes(segmentPaths);
  await fs.copyFile(mp4Path, desktopMp4Path);

  const durationSeconds = await ffprobeDuration(mp4Path);
  const summary = {
    scenario,
    mp4Path,
    desktopMp4Path,
    durationSeconds,
    resolution: { width, height },
    frameRate: fps,
    generatedAt: new Date().toISOString(),
    scenes: scenes.map(({ id }) => id),
  };

  await fs.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(summary, null, 2));
}

await main();
