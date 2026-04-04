#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const RECORDING_DIR = path.join(ROOT, 'output', 'playwright', 'bank-reconciliation-demo');
const SOURCE_VIDEO = path.join(RECORDING_DIR, 'bank-reconciliation-demo.mp4');
const SOURCE_AI_IMAGE = path.join(RECORDING_DIR, 'after-ai-categorization.png');
const SOURCE_RESULT_IMAGE = path.join(RECORDING_DIR, 'reconciliation-result.png');

const OUTPUT_DIR = path.join(ROOT, 'output', 'playwright', 'bank-reconciliation-feature');
const TMP_DIR = path.join(ROOT, 'tmp', 'bank-reconciliation-feature');
const PUBLIC_VIDEO = path.join(
  ROOT,
  'public',
  'visuals',
  'functionalities',
  'conciliation',
  'animations',
  'conciliation-feature-ca.mp4'
);
const PUBLIC_POSTER = path.join(
  ROOT,
  'public',
  'visuals',
  'functionalities',
  'conciliation',
  'optimized',
  'conciliation-feature-poster-ca.png'
);
const PUBLIC_VTT = path.join(
  ROOT,
  'public',
  'visuals',
  'functionalities',
  'conciliation',
  'animations',
  'conciliation-feature-ca.vtt'
);

const SEGMENTS = [
  { kind: 'video', sourceStart: 4.0, sourceEnd: 7.8, name: 'import-account' },
  { kind: 'video', sourceStart: 8.0, sourceEnd: 15.4, name: 'import-dedupe' },
  { kind: 'video', sourceStart: 25.5, sourceEnd: 27.8, name: 'imported-rows' },
  { kind: 'video', sourceStart: 28.0, sourceEnd: 30.5, name: 'ai-processing' },
  { kind: 'image', source: SOURCE_AI_IMAGE, duration: 2.2, name: 'ai-result' },
  { kind: 'image', source: SOURCE_RESULT_IMAGE, duration: 3.3, name: 'final-result' },
];

const CAPTIONS = [
  { start: 0.0, end: 3.8, text: "Importa l'extracte bancari des de Moviments" },
  { start: 3.8, end: 11.2, text: "Revisa els duplicats abans d'incorporar nous moviments" },
  { start: 11.2, end: 13.5, text: 'Treballes només amb els moviments nous del cas' },
  { start: 13.5, end: 18.2, text: 'La IA proposa categories i accelera la conciliació' },
  { start: 18.2, end: 21.5, text: 'Cada moviment queda classificat i connectat amb el seu context' },
];

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function resetDir(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
  ensureDir(dirPath);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'pipe',
    encoding: 'utf8',
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `${command} ha fallat`);
  }

  return result.stdout;
}

function findBinary(name) {
  const result = spawnSync('bash', ['-lc', `command -v ${name}`], {
    stdio: 'pipe',
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    return null;
  }

  return result.stdout.trim() || null;
}

function formatSeconds(seconds) {
  return Number(seconds.toFixed(2)).toString();
}

function formatVttTime(totalSeconds) {
  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = Math.floor(safeSeconds % 60);
  const milliseconds = Math.round((safeSeconds - Math.floor(safeSeconds)) * 1000);

  return [
    String(hours).padStart(2, '0'),
    String(minutes).padStart(2, '0'),
    String(seconds).padStart(2, '0'),
  ].join(':') + `.${String(milliseconds).padStart(3, '0')}`;
}

function encodeVideoSegment(ffmpegPath, segment, outputPath) {
  run(ffmpegPath, [
    '-y',
    '-ss',
    formatSeconds(segment.sourceStart),
    '-i',
    SOURCE_VIDEO,
    '-t',
    formatSeconds(segment.sourceEnd - segment.sourceStart),
    '-an',
    '-vf',
    'scale=3840:2160:flags=lanczos',
    '-r',
    '30',
    '-c:v',
    'libx264',
    '-preset',
    'slow',
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
    '-movflags',
    '+faststart',
    outputPath,
  ]);
}

function encodeStillSegment(ffmpegPath, segment, outputPath) {
  run(ffmpegPath, [
    '-y',
    '-loop',
    '1',
    '-i',
    segment.source,
    '-t',
    formatSeconds(segment.duration),
    '-an',
    '-vf',
    'scale=3840:2160:flags=lanczos',
    '-r',
    '30',
    '-c:v',
    'libx264',
    '-preset',
    'slow',
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
    '-movflags',
    '+faststart',
    outputPath,
  ]);
}

function buildCaptionsVtt() {
  const lines = ['WEBVTT', ''];

  CAPTIONS.forEach((caption, index) => {
    lines.push(String(index + 1));
    lines.push(`${formatVttTime(caption.start)} --> ${formatVttTime(caption.end)}`);
    lines.push(caption.text);
    lines.push('');
  });

  return `${lines.join('\n')}\n`;
}

function main() {
  if (!fs.existsSync(SOURCE_VIDEO)) {
    throw new Error(`No existeix el màster de conciliació: ${SOURCE_VIDEO}`);
  }
  if (!fs.existsSync(SOURCE_AI_IMAGE) || !fs.existsSync(SOURCE_RESULT_IMAGE)) {
    throw new Error('Falten captures de suport del cas de conciliació.');
  }

  const ffmpeg = findBinary('ffmpeg');
  const ffprobe = findBinary('ffprobe');
  if (!ffmpeg || !ffprobe) {
    throw new Error('No s ha trobat ffmpeg/ffprobe al sistema.');
  }

  resetDir(OUTPUT_DIR);
  resetDir(TMP_DIR);
  ensureDir(path.dirname(PUBLIC_VIDEO));
  ensureDir(path.dirname(PUBLIC_POSTER));
  ensureDir(path.dirname(PUBLIC_VTT));

  const segmentPaths = [];

  SEGMENTS.forEach((segment, index) => {
    const segmentPath = path.join(TMP_DIR, `${String(index + 1).padStart(2, '0')}-${segment.name}.mp4`);
    if (segment.kind === 'video') {
      encodeVideoSegment(ffmpeg, segment, segmentPath);
    } else {
      encodeStillSegment(ffmpeg, segment, segmentPath);
    }
    segmentPaths.push(segmentPath);
  });

  const concatListPath = path.join(TMP_DIR, 'concat.txt');
  fs.writeFileSync(
    concatListPath,
    segmentPaths.map((segmentPath) => `file '${segmentPath.replace(/'/g, "'\\''")}'`).join('\n'),
    'utf8'
  );

  const outputVideo = path.join(OUTPUT_DIR, 'bank-reconciliation-feature-ca.mp4');
  run(ffmpeg, [
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    concatListPath,
    '-an',
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
    '-movflags',
    '+faststart',
    outputVideo,
  ]);

  fs.copyFileSync(outputVideo, PUBLIC_VIDEO);
  fs.copyFileSync(SOURCE_RESULT_IMAGE, PUBLIC_POSTER);
  fs.writeFileSync(PUBLIC_VTT, buildCaptionsVtt(), 'utf8');

  const probeOutput = run(ffprobe, [
    '-v',
    'error',
    '-show_entries',
    'stream=width,height,r_frame_rate,bit_rate',
    '-show_entries',
    'format=duration',
    '-of',
    'json',
    outputVideo,
  ]);

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'recording-summary.json'),
    JSON.stringify(
      {
        scenario: 'bank-reconciliation-feature',
        sourceRecording: SOURCE_VIDEO,
        outputVideo,
        publicVideo: PUBLIC_VIDEO,
        publicPoster: PUBLIC_POSTER,
        publicVtt: PUBLIC_VTT,
        segments: SEGMENTS,
        ffprobe: JSON.parse(probeOutput),
        createdAt: new Date().toISOString(),
      },
      null,
      2
    )
  );

  console.log(`[build-bank-reconciliation-feature] Vídeo final: ${outputVideo}`);
  console.log(`[build-bank-reconciliation-feature] Asset públic: ${PUBLIC_VIDEO}`);
}

main();
