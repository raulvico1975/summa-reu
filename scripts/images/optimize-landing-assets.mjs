#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';

const LANDINGS_ROOT = path.join(process.cwd(), 'public', 'visuals', 'landings');
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.m4v', '.webm']);

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(`${command} exited with code ${code}: ${stderr || stdout}`));
    });
  });
}

async function commandExists(command) {
  try {
    await runCommand('which', [command]);
    return true;
  } catch {
    return false;
  }
}

async function ffmpegHasEncoder(encoderName) {
  try {
    const { stdout } = await runCommand('ffmpeg', ['-hide_banner', '-encoders']);
    return stdout.includes(encoderName);
  } catch {
    return false;
  }
}

function parseSlugFilter() {
  const slugArgIndex = process.argv.indexOf('--slug');
  if (slugArgIndex === -1) return null;

  const value = process.argv[slugArgIndex + 1];
  if (!value) return null;

  return new Set(value.split(',').map((part) => part.trim()).filter(Boolean));
}

function toSeoBasename(filePath) {
  const raw = path.basename(filePath, path.extname(filePath));
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'asset';
}

async function listLandingSlugs() {
  const entries = await fs.readdir(LANDINGS_ROOT, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

async function listSourceFiles(sourceDir) {
  try {
    const entries = await fs.readdir(sourceDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => {
        const ext = path.extname(name).toLowerCase();
        return IMAGE_EXTENSIONS.has(ext) || VIDEO_EXTENSIONS.has(ext);
      })
      .map((name) => path.join(sourceDir, name));
  } catch {
    return [];
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function toWebp(inputPath, outputPath) {
  const ext = path.extname(inputPath).toLowerCase();

  if (ext === '.webp') {
    await fs.copyFile(inputPath, outputPath);
    return;
  }

  await runCommand('cwebp', [
    '-q',
    '82',
    '-m',
    '6',
    '-mt',
    '-sharp_yuv',
    inputPath,
    '-o',
    outputPath,
  ]);
}

async function toAvif(inputPath, outputPath) {
  await runCommand('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-i',
    inputPath,
    '-frames:v',
    '1',
    '-c:v',
    'libaom-av1',
    '-still-picture',
    '1',
    '-crf',
    '32',
    '-b:v',
    '0',
    '-pix_fmt',
    'yuva420p',
    outputPath,
  ]);
}

async function toWebm(inputPath, outputPath) {
  await runCommand('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-i',
    inputPath,
    '-an',
    '-c:v',
    'libvpx-vp9',
    '-b:v',
    '0',
    '-crf',
    '36',
    '-vf',
    "scale='min(1400,iw)':-2:flags=lanczos,fps=24",
    outputPath,
  ]);
}

async function toMp4(inputPath, outputPath) {
  await runCommand('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-i',
    inputPath,
    '-an',
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '26',
    '-movflags',
    '+faststart',
    '-pix_fmt',
    'yuv420p',
    '-vf',
    "scale='min(1400,iw)':-2:flags=lanczos,fps=24",
    outputPath,
  ]);
}

async function toVideoPosterWebp(inputPath, outputPath) {
  await runCommand('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-ss',
    '0.4',
    '-i',
    inputPath,
    '-frames:v',
    '1',
    '-vf',
    "scale='min(1400,iw)':-2:flags=lanczos",
    outputPath,
  ]);
}

async function optimizeLandingAssets() {
  const cwebpReady = await commandExists('cwebp');
  const ffmpegReady = await commandExists('ffmpeg');

  if (!cwebpReady) {
    console.error('[landings-assets] Missing required binary: cwebp');
    process.exit(1);
  }

  if (!ffmpegReady) {
    console.error('[landings-assets] Missing required binary: ffmpeg');
    process.exit(1);
  }

  const avifReady = await ffmpegHasEncoder('libaom-av1');
  const webmReady = await ffmpegHasEncoder('libvpx-vp9');
  const mp4Ready = await ffmpegHasEncoder('libx264');

  if (!avifReady) {
    console.warn('[landings-assets] AVIF encoder not available. AVIF generation will be skipped.');
  }
  if (!webmReady) {
    console.warn('[landings-assets] VP9 encoder not available. WebM generation will be skipped.');
  }
  if (!mp4Ready) {
    console.warn('[landings-assets] H264 encoder not available. MP4 generation will be skipped.');
  }

  const slugFilter = parseSlugFilter();
  const landingSlugs = await listLandingSlugs();

  let totalImages = 0;
  let totalVideos = 0;
  let totalOutputs = 0;

  for (const slug of landingSlugs) {
    if (slugFilter && !slugFilter.has(slug)) {
      continue;
    }

    const sourceDir = path.join(LANDINGS_ROOT, slug, 'source');
    const optimizedDir = path.join(LANDINGS_ROOT, slug, 'optimized');
    const animationsDir = path.join(LANDINGS_ROOT, slug, 'animations');

    const sourceFiles = await listSourceFiles(sourceDir);
    if (sourceFiles.length === 0) {
      continue;
    }

    await ensureDir(optimizedDir);
    await ensureDir(animationsDir);
    console.log(`\n[landings-assets] ${slug}`);

    for (const sourceFile of sourceFiles) {
      const ext = path.extname(sourceFile).toLowerCase();
      const inputStat = await fs.stat(sourceFile);
      const seoBase = toSeoBasename(sourceFile);

      if (IMAGE_EXTENSIONS.has(ext)) {
        totalImages += 1;

        const webpOutput = path.join(optimizedDir, `${seoBase}.webp`);
        await toWebp(sourceFile, webpOutput);
        const webpStat = await fs.stat(webpOutput);
        totalOutputs += 1;

        console.log(
          `  - ${path.basename(sourceFile)} -> optimized/${path.basename(webpOutput)} (${formatBytes(inputStat.size)} -> ${formatBytes(webpStat.size)})`
        );

        if (avifReady) {
          const avifOutput = path.join(optimizedDir, `${seoBase}.avif`);
          await toAvif(sourceFile, avifOutput);
          const avifStat = await fs.stat(avifOutput);
          totalOutputs += 1;

          console.log(
            `  - ${path.basename(sourceFile)} -> optimized/${path.basename(avifOutput)} (${formatBytes(inputStat.size)} -> ${formatBytes(avifStat.size)})`
          );
        }

        continue;
      }

      if (VIDEO_EXTENSIONS.has(ext)) {
        totalVideos += 1;

        if (webmReady) {
          const webmOutput = path.join(animationsDir, `${seoBase}.webm`);
          await toWebm(sourceFile, webmOutput);
          const webmStat = await fs.stat(webmOutput);
          totalOutputs += 1;

          console.log(
            `  - ${path.basename(sourceFile)} -> animations/${path.basename(webmOutput)} (${formatBytes(inputStat.size)} -> ${formatBytes(webmStat.size)})`
          );
        }

        if (mp4Ready) {
          const mp4Output = path.join(animationsDir, `${seoBase}.mp4`);
          await toMp4(sourceFile, mp4Output);
          const mp4Stat = await fs.stat(mp4Output);
          totalOutputs += 1;

          console.log(
            `  - ${path.basename(sourceFile)} -> animations/${path.basename(mp4Output)} (${formatBytes(inputStat.size)} -> ${formatBytes(mp4Stat.size)})`
          );
        }

        const posterOutput = path.join(optimizedDir, `${seoBase}-poster.webp`);
        await toVideoPosterWebp(sourceFile, posterOutput);
        const posterStat = await fs.stat(posterOutput);
        totalOutputs += 1;

        console.log(
          `  - ${path.basename(sourceFile)} -> optimized/${path.basename(posterOutput)} (${formatBytes(inputStat.size)} -> ${formatBytes(posterStat.size)})`
        );
      }
    }
  }

  if (totalImages === 0 && totalVideos === 0) {
    console.log('[landings-assets] No source assets found. Add files to public/visuals/landings/<slug>/source');
    return;
  }

  console.log(
    `\n[landings-assets] Done. Processed ${totalImages} image(s) and ${totalVideos} video(s), generated ${totalOutputs} output file(s).`
  );
}

optimizeLandingAssets().catch((error) => {
  console.error('[landings-assets] Failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
