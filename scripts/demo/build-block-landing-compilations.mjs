#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();

const TASKS = [
  {
    slug: 'gestio-projectes-justificacio',
    clips: [
      'public/visuals/web/features-v3/block5_pressupost_partides_loop_4k.mp4',
      'public/visuals/web/features-v3/block5_assignacio_despeses_loop_4k.mp4',
      'public/visuals/web/features-v3/block5_captura_terreny_loop_4k.mp4',
      'public/visuals/web/features-v3/block5_export_financador_loop_4k.mp4',
    ],
    outputVideo: 'public/visuals/landings/gestio-projectes-justificacio/animations/gestio-projectes-bloc.mp4',
    outputPoster: 'public/visuals/landings/gestio-projectes-justificacio/optimized/gestio-projectes-bloc-poster.webp',
    posterSource: 'public/visuals/web/features-v3/block5_pressupost_partides_start_4k.webp',
  },
  {
    slug: 'control-visibilitat-entitats',
    clips: [
      'public/visuals/web/features-v3/block6_dashboard_loop_4k.mp4',
      'public/visuals/web/features-v3/block6_informe_junta_loop_4k.mp4',
      'public/visuals/web/features-v3/block6_exportacio_dades_loop_4k.mp4',
    ],
    outputVideo: 'public/visuals/landings/control-visibilitat-entitats/animations/control-visibilitat-bloc.mp4',
    outputPoster: 'public/visuals/landings/control-visibilitat-entitats/optimized/control-visibilitat-bloc-poster.webp',
    posterSource: 'public/visuals/web/features-v3/block6_dashboard_start_4k.webp',
  },
];

function fail(message) {
  console.error(`[build-block-landing-compilations] ERROR: ${message}`);
  process.exit(1);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'pipe',
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    fail(result.stderr || `${command} failed`);
  }

  return result.stdout.trim();
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function buildConcatVideo(task) {
  for (const clip of task.clips) {
    if (!fs.existsSync(path.join(ROOT, clip))) {
      fail(`Missing clip for ${task.slug}: ${clip}`);
    }
  }

  ensureDir(task.outputVideo);
  ensureDir(task.outputPoster);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'summa-block-landing-'));
  const listPath = path.join(tempDir, `${task.slug}.txt`);
  const listContent = task.clips
    .map((clip) => `file '${path.join(ROOT, clip).replace(/'/g, "'\\''")}'`)
    .join('\n');

  fs.writeFileSync(listPath, `${listContent}\n`, 'utf8');

  run('ffmpeg', [
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    listPath,
    '-c',
    'copy',
    '-movflags',
    '+faststart',
    path.join(ROOT, task.outputVideo),
  ]);

  fs.copyFileSync(path.join(ROOT, task.posterSource), path.join(ROOT, task.outputPoster));
  fs.rmSync(tempDir, { recursive: true, force: true });
}

for (const task of TASKS) {
  buildConcatVideo(task);
  console.log(`[build-block-landing-compilations] built ${task.slug}`);
}
