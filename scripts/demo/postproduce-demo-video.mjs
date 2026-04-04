#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT_DIR = process.cwd();
const STORYBOARD_DIR = path.join(ROOT_DIR, 'scripts', 'demo', 'video-storyboards');
const DEFAULT_TMP_DIR = path.join(ROOT_DIR, 'tmp', 'demo-postproduction');
const DEFAULT_LOGO_PATH = path.join(ROOT_DIR, 'public', 'brand', 'summa-logo-full-transparent-inter.png');
const DEFAULT_BRAND_VIDEO_DIR = path.join(ROOT_DIR, 'public', 'brand', 'video');
const DEFAULT_FONT_BOLD = '/System/Library/Fonts/Supplemental/Arial Bold.ttf';
const DEFAULT_FONT_REGULAR = '/System/Library/Fonts/Supplemental/Arial.ttf';
const DEFAULT_FONT_UI = '/System/Library/Fonts/SFNS.ttf';
const DEFAULT_FPS = 30;
const DEFAULT_CRF = 14;
const DEFAULT_PRESET = 'slow';
const DEFAULT_TRANSITION_SECONDS = 0.36;
const SUPPORTED_VARIANTS = ['ca', 'es', 'dual'];
const SUPPORTED_CAPTION_STYLES = ['legacy', 'summa-card', 'summa-subtitle'];

function parseArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function parseFlag(name) {
  return process.argv.includes(name);
}

function fail(message) {
  console.error(`[postproduce-demo] ERROR: ${message}`);
  process.exit(1);
}

function log(message) {
  console.log(`[postproduce-demo] ${message}`);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function resetDir(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
  ensureDir(dirPath);
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT_DIR,
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

function formatSrtTime(totalSeconds) {
  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = Math.floor(safeSeconds % 60);
  const milliseconds = Math.round((safeSeconds - Math.floor(safeSeconds)) * 1000);

  return [
    String(hours).padStart(2, '0'),
    String(minutes).padStart(2, '0'),
    String(seconds).padStart(2, '0'),
  ].join(':') + `,${String(milliseconds).padStart(3, '0')}`;
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

function escapeFilterPath(filePath) {
  return filePath
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/,/g, '\\,')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');
}

function probeVideo(ffprobePath, inputPath) {
  const result = runCommand(ffprobePath, [
    '-v',
    'error',
    '-show_entries',
    'stream=width,height,r_frame_rate:format=duration',
    '-of',
    'json',
    inputPath,
  ]);

  if (result.status !== 0) {
    throw new Error(result.stderr || 'ffprobe ha fallat.');
  }

  const parsed = JSON.parse(result.stdout);
  const stream = parsed.streams?.[0];
  const duration = Number(parsed.format?.duration);

  if (!stream?.width || !stream?.height || !Number.isFinite(duration)) {
    throw new Error('No s han pogut llegir les metadades del video.');
  }

  return {
    width: Number(stream.width),
    height: Number(stream.height),
    fps: stream.r_frame_rate || `${DEFAULT_FPS}/1`,
    durationSeconds: duration,
  };
}

async function loadStoryboard(slug) {
  const storyboardPath = path.join(STORYBOARD_DIR, `${slug}.mjs`);
  if (!fs.existsSync(storyboardPath)) {
    fail(`No existeix el storyboard ${slug} a ${storyboardPath}`);
  }

  const imported = await import(pathToFileURL(storyboardPath).href);
  const storyboard = imported.default;
  if (!storyboard?.slug || !Array.isArray(storyboard.captions)) {
    fail(`Storyboard invalid: ${storyboardPath}`);
  }

  return { storyboard, storyboardPath };
}

function resolveFont(preferredPath, familyFallback) {
  if (preferredPath && fs.existsSync(preferredPath)) {
    return preferredPath;
  }

  const match = runCommand('fc-match', [familyFallback, '--format=%{file}\n']);
  if (match.status === 0 && match.stdout.trim()) {
    return match.stdout.trim();
  }

  fail(`No s ha trobat una font valida per ${familyFallback}`);
}

function firstExistingPath(candidates) {
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function getBrandClipCandidates(kind, variant) {
  const primaryLanguage = getPrimaryLanguageForVariant(variant);
  const genericCandidates = [
    path.join(DEFAULT_BRAND_VIDEO_DIR, `demo-${kind}.mov`),
    path.join(DEFAULT_BRAND_VIDEO_DIR, `demo-${kind}.mp4`),
  ];

  if (variant === 'dual') {
    return genericCandidates;
  }

  return [
    path.join(DEFAULT_BRAND_VIDEO_DIR, `demo-${kind}-${primaryLanguage}.mov`),
    path.join(DEFAULT_BRAND_VIDEO_DIR, `demo-${kind}-${primaryLanguage}.mp4`),
    ...genericCandidates,
  ];
}

function isLocalizedMap(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function resolveLocalizedValue(value, language, fallbackLanguage = 'ca') {
  if (typeof value === 'string') {
    return value;
  }

  if (!isLocalizedMap(value)) {
    fail(`Valor localitzat invalid per idioma ${language}`);
  }

  if (typeof value[language] === 'string') {
    return value[language];
  }

  if (typeof value[fallbackLanguage] === 'string') {
    return value[fallbackLanguage];
  }

  const firstString = Object.values(value).find((entry) => typeof entry === 'string');
  if (typeof firstString === 'string') {
    return firstString;
  }

  fail(`No s ha trobat text valid per idioma ${language}`);
}

function parseVariantsArg(rawVariant) {
  if (!rawVariant) {
    return ['ca'];
  }

  if (rawVariant === 'dual') {
    return ['dual'];
  }

  if (rawVariant === 'all') {
    return ['ca', 'es'];
  }

  if (!SUPPORTED_VARIANTS.includes(rawVariant)) {
    fail(`Variant no suportada: ${rawVariant}`);
  }

  return [rawVariant];
}

function parseCaptionStyleArg(rawStyle) {
  if (!rawStyle) {
    return 'summa-subtitle';
  }

  if (!SUPPORTED_CAPTION_STYLES.includes(rawStyle)) {
    fail(`Estil de captions no suportat: ${rawStyle}`);
  }

  return rawStyle;
}

function resolveStoryboardPresentation(storyboard) {
  const presentation =
    typeof storyboard.presentation === 'object' && storyboard.presentation !== null
      ? storyboard.presentation
      : {};

  return {
    includeIntro: presentation.includeIntro !== false,
    includeOutro: presentation.includeOutro !== false,
    embedCaptions: presentation.embedCaptions !== false,
    captionTextMode: presentation.captionTextMode === 'subtitle' ? 'subtitle' : 'full',
  };
}

function normalizeEditSegments(rawSegments, maxDurationSeconds) {
  if (!Array.isArray(rawSegments) || rawSegments.length === 0) {
    return [];
  }

  return rawSegments.map((segment, index) => {
    const sourceStart = Number(segment?.sourceStart ?? segment?.start);
    const sourceEnd = Number(segment?.sourceEnd ?? segment?.end);

    if (!Number.isFinite(sourceStart) || !Number.isFinite(sourceEnd)) {
      fail(`Segment d edicio invalid a l index ${index}.`);
    }

    if (sourceStart < 0 || sourceEnd <= sourceStart) {
      fail(`Segment d edicio fora de rang a l index ${index}.`);
    }

    if (sourceEnd > maxDurationSeconds + 0.01) {
      fail(`Segment d edicio supera la durada del video a l index ${index}.`);
    }

    return {
      sourceStart,
      sourceEnd,
      durationSeconds: sourceEnd - sourceStart,
    };
  });
}

function getPrimaryLanguageForVariant(variant) {
  return variant === 'es' ? 'es' : 'ca';
}

function writeTextAsset(dirPath, fileName, content) {
  const filePath = path.join(dirPath, fileName);
  fs.writeFileSync(filePath, `${content}\n`, 'utf8');
  return filePath;
}

function prepareLocalizedTextAssets(storyboard, dirPath, variant) {
  ensureDir(dirPath);

  const primaryLanguage = getPrimaryLanguageForVariant(variant);
  const secondaryLanguage = variant === 'dual' ? 'es' : null;

  const intro = {
    eyebrow: writeTextAsset(
      dirPath,
      'intro-eyebrow.txt',
      resolveLocalizedValue(storyboard.intro.eyebrow, primaryLanguage)
    ),
    title: writeTextAsset(
      dirPath,
      'intro-title.txt',
      resolveLocalizedValue(storyboard.intro.title, primaryLanguage)
    ),
    subtitle: writeTextAsset(
      dirPath,
      'intro-subtitle.txt',
      resolveLocalizedValue(storyboard.intro.subtitle, primaryLanguage)
    ),
  };

  const outro = {
    eyebrow: writeTextAsset(
      dirPath,
      'outro-eyebrow.txt',
      resolveLocalizedValue(storyboard.outro.eyebrow, primaryLanguage)
    ),
    title: writeTextAsset(
      dirPath,
      'outro-title.txt',
      resolveLocalizedValue(storyboard.outro.title, primaryLanguage)
    ),
    subtitle: writeTextAsset(
      dirPath,
      'outro-subtitle.txt',
      resolveLocalizedValue(storyboard.outro.subtitle, primaryLanguage)
    ),
  };

  const captions = storyboard.captions.map((caption, index) => {
    const suffix = String(index + 1).padStart(2, '0');
    const primaryHeadline = resolveLocalizedValue(caption.headline, primaryLanguage);
    const primaryBody = resolveLocalizedValue(caption.body, primaryLanguage);
    const primarySubtitle = resolveLocalizedValue(caption.subtitle ?? caption.headline, primaryLanguage);
    const secondaryHeadline = secondaryLanguage
      ? resolveLocalizedValue(caption.headline, secondaryLanguage)
      : null;
    const secondaryBody = secondaryLanguage
      ? resolveLocalizedValue(caption.body, secondaryLanguage)
      : null;
    const secondarySubtitle =
      secondaryLanguage === null
        ? null
        : resolveLocalizedValue(caption.subtitle ?? caption.headline, secondaryLanguage);

    return {
      start: caption.start,
      end: caption.end,
      surface: caption.surface === 'dark' ? 'dark' : 'light',
      primaryHeadline,
      primaryBody,
      primarySubtitle,
      secondaryHeadline,
      secondaryBody,
      secondarySubtitle,
      primaryHeadlinePath: writeTextAsset(dirPath, `caption-${suffix}-primary-headline.txt`, primaryHeadline),
      primaryBodyPath: writeTextAsset(dirPath, `caption-${suffix}-primary-body.txt`, primaryBody),
      primarySubtitlePath: writeTextAsset(dirPath, `caption-${suffix}-primary-subtitle.txt`, primarySubtitle),
      secondaryHeadlinePath:
        secondaryHeadline === null
          ? null
          : writeTextAsset(dirPath, `caption-${suffix}-secondary-headline.txt`, secondaryHeadline),
      secondaryBodyPath:
        secondaryBody === null
          ? null
          : writeTextAsset(dirPath, `caption-${suffix}-secondary-body.txt`, secondaryBody),
      secondarySubtitlePath:
        secondarySubtitle === null
          ? null
          : writeTextAsset(dirPath, `caption-${suffix}-secondary-subtitle.txt`, secondarySubtitle),
    };
  });

  return { intro, outro, captions, primaryLanguage, secondaryLanguage };
}

function buildFadeAlphaExpression(start, end, fadeInSeconds = 0.22, fadeOutSeconds = 0.24) {
  const fadeInEnd = Math.min(end, start + fadeInSeconds);
  const fadeOutStart = Math.max(start, end - fadeOutSeconds);
  return [
    `if(lt(t\\,${start.toFixed(2)})\\,0\\,`,
    `if(lt(t\\,${fadeInEnd.toFixed(2)})\\,(t-${start.toFixed(2)})/${Math.max(fadeInEnd - start, 0.01).toFixed(2)}\\,`,
    `if(lt(t\\,${fadeOutStart.toFixed(2)})\\,1\\,`,
    `if(lt(t\\,${end.toFixed(2)})\\,(${end.toFixed(2)}-t)/${Math.max(end - fadeOutStart, 0.01).toFixed(2)}\\,0))))`,
  ].join('');
}

function resolveSubtitlePalette(caption, variant) {
  if (caption.surface === 'dark') {
    return {
      primaryColor: '0xf8fafc',
      secondaryColor: variant === 'dual' ? '0xe2e8f0' : '0xf8fafc',
      primaryShadow: '0x020617@0.48',
      secondaryShadow: '0x020617@0.40',
    };
  }

  return {
    primaryColor: '0x111827',
    secondaryColor: variant === 'dual' ? '0x4b5563' : '0x111827',
    primaryShadow: '0x0f172a@0.10',
    secondaryShadow: '0x0f172a@0.08',
  };
}

function buildLegacySingleCaptionFilter(caption, fonts) {
  const enable = `between(t\\,${caption.start.toFixed(2)}\\,${caption.end.toFixed(2)})`;
  return [
    `drawbox=x=92:y=ih-152:w=1060:h=110:color=0x0f172a@0.84:t=fill:enable='${enable}'`,
    `drawbox=x=92:y=ih-152:w=12:h=110:color=0x0ea5e9@1:t=fill:enable='${enable}'`,
    `drawtext=fontfile='${escapeFilterPath(fonts.bold)}':textfile='${escapeFilterPath(caption.primaryHeadlinePath)}':fontcolor=white:fontsize=34:x=124:y=h-138:line_spacing=6:enable='${enable}'`,
    `drawtext=fontfile='${escapeFilterPath(fonts.regular)}':textfile='${escapeFilterPath(caption.primaryBodyPath)}':fontcolor=0xe2e8f0:fontsize=22:x=124:y=h-92:line_spacing=8:enable='${enable}'`,
  ];
}

function buildLegacyDualCaptionFilter(caption, fonts) {
  const enable = `between(t\\,${caption.start.toFixed(2)}\\,${caption.end.toFixed(2)})`;
  return [
    `drawbox=x=92:y=ih-214:w=1280:h=176:color=0x0f172a@0.86:t=fill:enable='${enable}'`,
    `drawbox=x=92:y=ih-214:w=12:h=176:color=0x0ea5e9@1:t=fill:enable='${enable}'`,
    `drawtext=fontfile='${escapeFilterPath(fonts.bold)}':textfile='${escapeFilterPath(caption.primaryHeadlinePath)}':fontcolor=white:fontsize=30:x=124:y=h-198:line_spacing=6:enable='${enable}'`,
    `drawtext=fontfile='${escapeFilterPath(fonts.regular)}':textfile='${escapeFilterPath(caption.primaryBodyPath)}':fontcolor=0xe2e8f0:fontsize=20:x=124:y=h-156:line_spacing=8:enable='${enable}'`,
    `drawbox=x=124:y=ih-114:w=1216:h=1:color=0xffffff@0.18:t=fill:enable='${enable}'`,
    `drawtext=fontfile='${escapeFilterPath(fonts.bold)}':textfile='${escapeFilterPath(caption.secondaryHeadlinePath)}':fontcolor=0xbfdbfe:fontsize=28:x=124:y=h-96:line_spacing=6:enable='${enable}'`,
    `drawtext=fontfile='${escapeFilterPath(fonts.regular)}':textfile='${escapeFilterPath(caption.secondaryBodyPath)}':fontcolor=0xcbd5e1:fontsize=19:x=124:y=h-58:line_spacing=8:enable='${enable}'`,
  ];
}

function buildSummaCardSingleCaptionFilter(caption, fonts) {
  const enable = `between(t\\,${caption.start.toFixed(2)}\\,${caption.end.toFixed(2)})`;
  return [
    `drawbox=x=106:y=ih-174:w=1020:h=118:color=0x0f172a@0.10:t=fill:enable='${enable}'`,
    `drawbox=x=90:y=ih-188:w=1020:h=118:color=0xffffff@0.95:t=fill:enable='${enable}'`,
    `drawbox=x=90:y=ih-188:w=1020:h=118:color=0xcbd5e1@0.78:t=2:enable='${enable}'`,
    `drawbox=x=90:y=ih-188:w=1020:h=4:color=0x38bdf8@0.98:t=fill:enable='${enable}'`,
    `drawtext=fontfile='${escapeFilterPath(fonts.bold)}':textfile='${escapeFilterPath(caption.primaryHeadlinePath)}':fontcolor=0x0f172a:fontsize=33:x=126:y=h-170:line_spacing=6:enable='${enable}'`,
    `drawtext=fontfile='${escapeFilterPath(fonts.regular)}':textfile='${escapeFilterPath(caption.primaryBodyPath)}':fontcolor=0x475569:fontsize=21:x=126:y=h-122:line_spacing=8:enable='${enable}'`,
  ];
}

function buildSummaCardDualCaptionFilter(caption, fonts) {
  const enable = `between(t\\,${caption.start.toFixed(2)}\\,${caption.end.toFixed(2)})`;
  return [
    `drawbox=x=108:y=ih-244:w=1168:h=188:color=0x0f172a@0.10:t=fill:enable='${enable}'`,
    `drawbox=x=92:y=ih-258:w=1168:h=188:color=0xffffff@0.95:t=fill:enable='${enable}'`,
    `drawbox=x=92:y=ih-258:w=1168:h=188:color=0xcbd5e1@0.78:t=2:enable='${enable}'`,
    `drawbox=x=92:y=ih-258:w=1168:h=4:color=0x38bdf8@0.98:t=fill:enable='${enable}'`,
    `drawtext=fontfile='${escapeFilterPath(fonts.bold)}':textfile='${escapeFilterPath(caption.primaryHeadlinePath)}':fontcolor=0x0f172a:fontsize=31:x=128:y=h-232:line_spacing=6:enable='${enable}'`,
    `drawtext=fontfile='${escapeFilterPath(fonts.regular)}':textfile='${escapeFilterPath(caption.primaryBodyPath)}':fontcolor=0x475569:fontsize=20:x=128:y=h-188:line_spacing=8:enable='${enable}'`,
    `drawbox=x=128:y=ih-144:w=1096:h=1:color=0xcbd5e1@0.95:t=fill:enable='${enable}'`,
    `drawtext=fontfile='${escapeFilterPath(fonts.bold)}':textfile='${escapeFilterPath(caption.secondaryHeadlinePath)}':fontcolor=0x0284c7:fontsize=27:x=128:y=h-124:line_spacing=6:enable='${enable}'`,
    `drawtext=fontfile='${escapeFilterPath(fonts.regular)}':textfile='${escapeFilterPath(caption.secondaryBodyPath)}':fontcolor=0x64748b:fontsize=17:x=128:y=h-92:line_spacing=6:enable='${enable}'`,
  ];
}

function buildSummaSubtitleSingleCaptionFilter(caption, fonts) {
  const enable = `between(t\\,${caption.start.toFixed(2)}\\,${caption.end.toFixed(2)})`;
  const alpha = buildFadeAlphaExpression(caption.start, caption.end);
  const palette = resolveSubtitlePalette(caption, 'single');
  return [
    `drawtext=fontfile='${escapeFilterPath(fonts.ui)}':textfile='${escapeFilterPath(caption.primarySubtitlePath)}':fontcolor=${palette.primaryColor}:alpha='${alpha}':fontsize=44:x=(w-text_w)/2:y=h-122:line_spacing=8:shadowcolor=${palette.primaryShadow}:shadowx=0:shadowy=2:fix_bounds=1:enable='${enable}'`,
  ];
}

function buildSummaSubtitleDualCaptionFilter(caption, fonts) {
  const enable = `between(t\\,${caption.start.toFixed(2)}\\,${caption.end.toFixed(2)})`;
  const alpha = buildFadeAlphaExpression(caption.start, caption.end);
  const palette = resolveSubtitlePalette(caption, 'dual');
  return [
    `drawtext=fontfile='${escapeFilterPath(fonts.ui)}':textfile='${escapeFilterPath(caption.primarySubtitlePath)}':fontcolor=${palette.primaryColor}:alpha='${alpha}':fontsize=44:x=(w-text_w)/2:y=h-150:line_spacing=8:shadowcolor=${palette.primaryShadow}:shadowx=0:shadowy=2:fix_bounds=1:enable='${enable}'`,
    `drawtext=fontfile='${escapeFilterPath(fonts.ui)}':textfile='${escapeFilterPath(caption.secondarySubtitlePath)}':fontcolor=${palette.secondaryColor}:alpha='${alpha}':fontsize=34:x=(w-text_w)/2:y=h-98:line_spacing=7:shadowcolor=${palette.secondaryShadow}:shadowx=0:shadowy=2:fix_bounds=1:enable='${enable}'`,
  ];
}

function buildMainFilterScript(captions, fonts, variant, captionStyle) {
  const lines = [];

  for (const caption of captions) {
    if (captionStyle === 'summa-subtitle') {
      lines.push(
        ...(variant === 'dual'
          ? buildSummaSubtitleDualCaptionFilter(caption, fonts)
          : buildSummaSubtitleSingleCaptionFilter(caption, fonts))
      );
      continue;
    }

    if (captionStyle === 'summa-card') {
      lines.push(
        ...(variant === 'dual'
          ? buildSummaCardDualCaptionFilter(caption, fonts)
          : buildSummaCardSingleCaptionFilter(caption, fonts))
      );
      continue;
    }

    lines.push(
      ...(variant === 'dual'
        ? buildLegacyDualCaptionFilter(caption, fonts)
        : buildLegacySingleCaptionFilter(caption, fonts))
    );
  }

  return `${lines.join(',')}\n`;
}

function buildIntroOrOutroFilterScript(kind, textAssets, fonts) {
  const isIntro = kind === 'intro';
  const logoScaleWidth = isIntro ? 500 : 360;
  const accentY = isIntro ? 180 : 190;
  const titleY = isIntro ? 280 : 300;
  const subtitleY = isIntro ? 395 : 420;

  return [
    `[1:v]scale=${logoScaleWidth}:-1[logo]`,
    `[0:v][logo]overlay=x=W-w-120:y=120[base]`,
    `[base]drawbox=x=120:y=${accentY}:w=92:h=10:color=0x0ea5e9@1:t=fill,` +
      `drawtext=fontfile='${escapeFilterPath(fonts.bold)}':textfile='${escapeFilterPath(textAssets.eyebrow)}':fontcolor=0x0284c7:fontsize=30:x=120:y=220,` +
      `drawtext=fontfile='${escapeFilterPath(fonts.bold)}':textfile='${escapeFilterPath(textAssets.title)}':fontcolor=0x0f172a:fontsize=74:x=120:y=${titleY},` +
      `drawtext=fontfile='${escapeFilterPath(fonts.regular)}':textfile='${escapeFilterPath(textAssets.subtitle)}':fontcolor=0x475569:fontsize=30:x=120:y=${subtitleY}:line_spacing=10[v]`,
  ].join(';\n') + '\n';
}

function renderClip(ffmpegPath, args) {
  const result = runCommand(ffmpegPath, args);
  if (result.status !== 0) {
    throw new Error(result.stderr || 'ffmpeg ha fallat');
  }
}

function renderIntroOrOutro(ffmpegPath, clipPath, durationSeconds, dimensions, logoPath, filterScriptPath) {
  renderClip(ffmpegPath, [
    '-y',
    '-f',
    'lavfi',
    '-i',
    `color=c=#f8fafc:s=${dimensions.width}x${dimensions.height}:r=${DEFAULT_FPS}:d=${formatSeconds(durationSeconds)}`,
    '-loop',
    '1',
    '-i',
    logoPath,
    '-filter_complex_script',
    filterScriptPath,
    '-map',
    '[v]',
    '-an',
    '-shortest',
    '-t',
    formatSeconds(durationSeconds),
    '-r',
    String(DEFAULT_FPS),
    '-c:v',
    'libx264',
    '-preset',
    DEFAULT_PRESET,
    '-crf',
    String(DEFAULT_CRF),
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    clipPath,
  ]);
}

function renderMainVideo(ffmpegPath, inputPath, outputPath, filterScriptPath) {
  renderClip(ffmpegPath, [
    '-y',
    '-i',
    inputPath,
    '-filter_script:v',
    filterScriptPath,
    '-an',
    '-r',
    String(DEFAULT_FPS),
    '-c:v',
    'libx264',
    '-preset',
    DEFAULT_PRESET,
    '-crf',
    String(DEFAULT_CRF),
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    outputPath,
  ]);
}

function renderEditedMainSource(ffmpegPath, inputPath, outputPath, segments) {
  if (segments.length === 0) {
    fail('Cal almenys un segment per editar el clip principal.');
  }

  if (segments.length === 1) {
    const segment = segments[0];
    renderClip(ffmpegPath, [
      '-y',
      '-i',
      inputPath,
      '-filter:v',
      `trim=start=${formatSeconds(segment.sourceStart)}:end=${formatSeconds(segment.sourceEnd)},setpts=PTS-STARTPTS`,
      '-an',
      '-r',
      String(DEFAULT_FPS),
      '-c:v',
      'libx264',
      '-preset',
      DEFAULT_PRESET,
      '-crf',
      String(DEFAULT_CRF),
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      outputPath,
    ]);

    return {
      durationSeconds: segment.durationSeconds,
    };
  }

  const filterSegments = segments.map(
    (segment, index) =>
      `[0:v]trim=start=${formatSeconds(segment.sourceStart)}:end=${formatSeconds(segment.sourceEnd)},setpts=PTS-STARTPTS[s${index}]`
  );
  filterSegments.push(
    `${segments.map((_, index) => `[s${index}]`).join('')}concat=n=${segments.length}:v=1:a=0[v]`
  );

  renderClip(ffmpegPath, [
    '-y',
    '-i',
    inputPath,
    '-filter_complex',
    filterSegments.join(';'),
    '-map',
    '[v]',
    '-an',
    '-r',
    String(DEFAULT_FPS),
    '-c:v',
    'libx264',
    '-preset',
    DEFAULT_PRESET,
    '-crf',
    String(DEFAULT_CRF),
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    outputPath,
  ]);

  return {
    durationSeconds: segments.reduce((total, segment) => total + segment.durationSeconds, 0),
  };
}

function crossfadeClips(ffmpegPath, clips, outputPath, requestedTransitionSeconds = DEFAULT_TRANSITION_SECONDS) {
  const safeClips = clips.filter((clip) => Number.isFinite(clip.durationSeconds) && clip.durationSeconds > 0.2);
  if (safeClips.length === 0) {
    fail('No hi ha clips valids per compondre el video final.');
  }

  if (safeClips.length === 1) {
    renderClip(ffmpegPath, [
      '-y',
      '-i',
      safeClips[0].path,
      '-an',
      '-c:v',
      'libx264',
      '-preset',
      DEFAULT_PRESET,
      '-crf',
      String(DEFAULT_CRF),
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      outputPath,
    ]);
    return {
      durationSeconds: safeClips[0].durationSeconds,
      transitions: [],
    };
  }

  let currentDuration = safeClips[0].durationSeconds;
  let currentLabel = '[0:v]';
  const filterSegments = [];
  const transitions = [];

  for (let index = 1; index < safeClips.length; index += 1) {
    const previousClip = safeClips[index - 1];
    const nextClip = safeClips[index];
    const maxTransition = Math.min(
      requestedTransitionSeconds,
      Math.max(previousClip.durationSeconds - 0.12, 0.12),
      Math.max(nextClip.durationSeconds - 0.12, 0.12)
    );
    const transitionSeconds = Number(Math.max(0.12, maxTransition).toFixed(2));
    const offsetSeconds = Number(Math.max(0, currentDuration - transitionSeconds).toFixed(2));
    const outputLabel = index === safeClips.length - 1 ? '[v]' : `[v${index}]`;

    filterSegments.push(
      `${currentLabel}[${index}:v]xfade=transition=fade:duration=${formatSeconds(transitionSeconds)}:offset=${formatSeconds(offsetSeconds)}${outputLabel}`
    );
    transitions.push({
      from: previousClip.name,
      to: nextClip.name,
      durationSeconds: transitionSeconds,
    });

    currentLabel = outputLabel;
    currentDuration = currentDuration + nextClip.durationSeconds - transitionSeconds;
  }

  renderClip(ffmpegPath, [
    '-y',
    ...safeClips.flatMap((clip) => ['-i', clip.path]),
    '-an',
    '-filter_complex',
    filterSegments.join(';'),
    '-map',
    '[v]',
    '-c:v',
    'libx264',
    '-preset',
    DEFAULT_PRESET,
    '-crf',
    String(DEFAULT_CRF),
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    outputPath,
  ]);

  return {
    durationSeconds: currentDuration,
    transitions,
  };
}

function normalizeExternalClip(ffmpegPath, assetPath, outputPath, dimensions) {
  renderClip(ffmpegPath, [
    '-y',
    '-i',
    assetPath,
    '-f',
    'lavfi',
    '-i',
    `color=c=#f8fafc:s=${dimensions.width}x${dimensions.height}:r=${DEFAULT_FPS}`,
    '-filter_complex',
    `[0:v]fps=${DEFAULT_FPS},scale=${dimensions.width}:${dimensions.height}:force_original_aspect_ratio=decrease[clip];[1:v][clip]overlay=(W-w)/2:(H-h)/2:shortest=1[v]`,
    '-map',
    '[v]',
    '-an',
    '-r',
    String(DEFAULT_FPS),
    '-c:v',
    'libx264',
    '-preset',
    DEFAULT_PRESET,
    '-crf',
    String(DEFAULT_CRF),
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    outputPath,
  ]);
}

function buildCaptionLines(caption, variant, captionTextMode) {
  if (captionTextMode === 'subtitle') {
    const lines = [caption.primarySubtitle];

    if (variant === 'dual' && caption.secondarySubtitle) {
      lines.push(caption.secondarySubtitle);
    }

    return lines;
  }

  const lines = [caption.primaryHeadline, caption.primaryBody];

  if (variant === 'dual' && caption.secondaryHeadline && caption.secondaryBody) {
    lines.push(caption.secondaryHeadline, caption.secondaryBody);
  }

  return lines;
}

function writeSrt(captions, outputPath, introOffsetSeconds, variant, captionTextMode) {
  const blocks = captions.map((caption, index) => {
    const start = formatSrtTime(introOffsetSeconds + caption.start);
    const end = formatSrtTime(introOffsetSeconds + caption.end);
    const lines = buildCaptionLines(caption, variant, captionTextMode);

    return [
      String(index + 1),
      `${start} --> ${end}`,
      ...lines,
      '',
    ].join('\n');
  });

  fs.writeFileSync(outputPath, blocks.join('\n'), 'utf8');
}

function writeVtt(captions, outputPath, introOffsetSeconds, variant, captionTextMode) {
  const blocks = captions.map((caption, index) => {
    const start = formatVttTime(introOffsetSeconds + caption.start);
    const end = formatVttTime(introOffsetSeconds + caption.end);
    const lines = buildCaptionLines(caption, variant, captionTextMode);

    return [
      String(index + 1),
      `${start} --> ${end}`,
      ...lines,
      '',
    ].join('\n');
  });

  fs.writeFileSync(outputPath, `WEBVTT\n\n${blocks.join('\n')}`, 'utf8');
}

function derivePaths(storyboard, variant, inputPathArg, outputPathArg) {
  const artifactDir = path.join(ROOT_DIR, 'output', 'playwright', storyboard.recordingSlug);
  const inputPath = inputPathArg || path.join(artifactDir, `${storyboard.recordingSlug}.mp4`);
  const outputPath = outputPathArg || path.join(artifactDir, `${storyboard.slug}.${variant}.mp4`);
  const outputStem = path.basename(outputPath, path.extname(outputPath));
  const srtPath = path.join(path.dirname(outputPath), `${outputStem}.srt`);
  const vttPath = path.join(path.dirname(outputPath), `${outputStem}.vtt`);
  const summaryPath = path.join(artifactDir, 'recording-summary.json');

  return { artifactDir, inputPath, outputPath, srtPath, vttPath, summaryPath, outputStem };
}

function updateRecordingSummary(summaryPath, payload, options = {}) {
  const { setAsPrimary = false } = options;
  let summary = {};
  if (fs.existsSync(summaryPath)) {
    summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  }

  const currentPost = summary.postproduction ?? {};
  const currentStoryboards = currentPost.storyboards ?? {};
  const currentStoryboard = currentStoryboards[payload.storyboardSlug] ?? {};
  const currentVariants = currentStoryboard.variants ?? {};

  const nextSummary = {
    ...summary,
    postproduction: {
      ...currentPost,
      ...(setAsPrimary
        ? {
            storyboardSlug: payload.storyboardSlug,
            storyboardPath: payload.storyboardPath,
            brandedVideoPath: payload.brandedVideoPath,
            subtitlesPath: payload.subtitlesPath,
            webvttPath: payload.webvttPath,
            introAssetPath: payload.introAssetPath,
            outroAssetPath: payload.outroAssetPath,
            introDurationSeconds: payload.introDurationSeconds,
            outroDurationSeconds: payload.outroDurationSeconds,
            createdAt: payload.createdAt,
          }
        : {}),
      lastRender: payload,
      storyboards: {
        ...currentStoryboards,
        [payload.storyboardSlug]: {
          ...currentStoryboard,
          storyboardPath: payload.storyboardPath,
          recordingSlug: payload.recordingSlug,
          variants: {
            ...currentVariants,
            [payload.variant]: {
              variant: payload.variant,
              language: payload.language,
              captionMode: payload.captionMode,
              captionStyle: payload.captionStyle,
              brandedVideoPath: payload.brandedVideoPath,
              subtitlesPath: payload.subtitlesPath,
              webvttPath: payload.webvttPath,
              introAssetPath: payload.introAssetPath,
              outroAssetPath: payload.outroAssetPath,
              introDurationSeconds: payload.introDurationSeconds,
              outroDurationSeconds: payload.outroDurationSeconds,
              durationSeconds: payload.durationSeconds,
              createdAt: payload.createdAt,
            },
          },
        },
      },
    },
  };

  fs.writeFileSync(summaryPath, `${JSON.stringify(nextSummary, null, 2)}\n`, 'utf8');
}

function assertSingleVariantOutputOverride(variants, outputOverride) {
  if (variants.length > 1 && outputOverride) {
    fail('No pots usar --output quan renderitzes mes d una variant alhora.');
  }
}

async function renderVariant({
  variant,
  isPrimaryVariant,
  captionStyle,
  skipSummary,
  storyboard,
  storyboardPath,
  inputPathArg,
  outputPathArg,
  ffmpegPath,
  ffprobePath,
      fonts,
      logoPath,
      introAssetPath,
      outroAssetPath,
}) {
  const { artifactDir, inputPath, outputPath, srtPath, vttPath, summaryPath } = derivePaths(
    storyboard,
    variant,
    inputPathArg,
    outputPathArg
  );

  if (!fs.existsSync(inputPath)) {
    fail(`No existeix el video d entrada: ${inputPath}`);
  }

  ensureDir(artifactDir);

  const videoMeta = probeVideo(ffprobePath, inputPath);
  const presentation = resolveStoryboardPresentation(storyboard);
  const editSegments = normalizeEditSegments(storyboard.edit?.segments, videoMeta.durationSeconds);
  const tmpDir = path.join(DEFAULT_TMP_DIR, `${storyboard.slug}-${variant}`);
  resetDir(tmpDir);

  const textAssets = prepareLocalizedTextAssets(storyboard, path.join(tmpDir, 'text'), variant);
  const introFilterPath = path.join(tmpDir, 'intro.filter');
  const outroFilterPath = path.join(tmpDir, 'outro.filter');
  const mainFilterPath = path.join(tmpDir, 'main.filter');

  fs.writeFileSync(
    introFilterPath,
    buildIntroOrOutroFilterScript('intro', textAssets.intro, fonts),
    'utf8'
  );
  fs.writeFileSync(
    outroFilterPath,
    buildIntroOrOutroFilterScript('outro', textAssets.outro, fonts),
    'utf8'
  );
  fs.writeFileSync(
    mainFilterPath,
    buildMainFilterScript(textAssets.captions, fonts, variant, captionStyle),
    'utf8'
  );

  const introClipPath = path.join(tmpDir, 'intro.mp4');
  const editedMainSourcePath = path.join(tmpDir, 'main-source.mp4');
  const mainClipPath = path.join(tmpDir, 'main.mp4');
  const outroClipPath = path.join(tmpDir, 'outro.mp4');

  let mainSourcePath = inputPath;
  let mainSourceDurationSeconds = videoMeta.durationSeconds;

  if (editSegments.length > 0) {
    log(`[${variant}] Compactant el clip principal en ${editSegments.length} segments...`);
    const editedMeta = renderEditedMainSource(ffmpegPath, inputPath, editedMainSourcePath, editSegments);
    mainSourcePath = editedMainSourcePath;
    mainSourceDurationSeconds = editedMeta.durationSeconds;
  }

  const introClipMeta = { durationSeconds: 0 };
  if (presentation.includeIntro) {
    if (introAssetPath) {
      log(`[${variant}] Usant intro externa: ${introAssetPath}`);
      normalizeExternalClip(ffmpegPath, introAssetPath, introClipPath, videoMeta);
    } else {
      const fallbackIntroDuration = Number(storyboard.introDurationSeconds ?? 2.4);
      log(`[${variant}] Renderitzant intro de fallback...`);
      renderIntroOrOutro(
        ffmpegPath,
        introClipPath,
        fallbackIntroDuration,
        videoMeta,
        logoPath,
        introFilterPath
      );
    }
    Object.assign(introClipMeta, probeVideo(ffprobePath, introClipPath));
  }

  let renderedMainPath = mainSourcePath;
  if (presentation.embedCaptions) {
    log(`[${variant}] Aplicant captions al clip principal...`);
    renderMainVideo(ffmpegPath, mainSourcePath, mainClipPath, mainFilterPath);
    renderedMainPath = mainClipPath;
  } else {
    log(`[${variant}] Exportant clip principal net, sense captions cremades...`);
  }

  const outroClipMeta = { durationSeconds: 0 };
  if (presentation.includeOutro) {
    if (outroAssetPath) {
      log(`[${variant}] Usant outro externa: ${outroAssetPath}`);
      normalizeExternalClip(ffmpegPath, outroAssetPath, outroClipPath, videoMeta);
    } else {
      const fallbackOutroDuration = Number(storyboard.outroDurationSeconds ?? 2.4);
      log(`[${variant}] Renderitzant outro de fallback...`);
      renderIntroOrOutro(
        ffmpegPath,
        outroClipPath,
        fallbackOutroDuration,
        videoMeta,
        logoPath,
        outroFilterPath
      );
    }
    Object.assign(outroClipMeta, probeVideo(ffprobePath, outroClipPath));
  }

  const clips = [];
  if (presentation.includeIntro) {
    clips.push({ name: 'intro', path: introClipPath, durationSeconds: introClipMeta.durationSeconds });
  }
  clips.push({ name: 'main', path: renderedMainPath, durationSeconds: mainSourceDurationSeconds });
  if (presentation.includeOutro) {
    clips.push({ name: 'outro', path: outroClipPath, durationSeconds: outroClipMeta.durationSeconds });
  }

  log(
    `[${variant}] Composant ${clips.map((clip) => clip.name).join(' + ')}${
      clips.length > 1 ? ' amb transicions suaus' : ''
    }...`
  );
  const compositionMeta = crossfadeClips(
    ffmpegPath,
    clips,
    outputPath
  );

  const introToMainTransition = compositionMeta.transitions.find(
    (transition) => transition.from === 'intro' && transition.to === 'main'
  );
  const effectiveMainOffsetSeconds = Math.max(
    0,
    presentation.includeIntro
      ? introClipMeta.durationSeconds - (introToMainTransition?.durationSeconds ?? 0)
      : 0
  );

  writeSrt(
    textAssets.captions,
    srtPath,
    effectiveMainOffsetSeconds,
    variant,
    presentation.captionTextMode
  );
  writeVtt(
    textAssets.captions,
    vttPath,
    effectiveMainOffsetSeconds,
    variant,
    presentation.captionTextMode
  );
  const finalMeta = probeVideo(ffprobePath, outputPath);

  const renderMeta = {
    storyboardSlug: storyboard.slug,
    storyboardPath,
    recordingSlug: storyboard.recordingSlug,
    variant,
    language: textAssets.primaryLanguage,
    captionMode: variant === 'dual' ? 'bilingual' : 'single-language',
    captionStyle: presentation.embedCaptions ? captionStyle : 'external',
    brandedVideoPath: outputPath,
    subtitlesPath: srtPath,
    webvttPath: vttPath,
    introAssetPath: presentation.includeIntro ? introAssetPath || null : null,
    outroAssetPath: presentation.includeOutro ? outroAssetPath || null : null,
    introDurationSeconds: Number(introClipMeta.durationSeconds.toFixed(2)),
    outroDurationSeconds: Number(outroClipMeta.durationSeconds.toFixed(2)),
    transitions: compositionMeta.transitions,
    durationSeconds: Number(finalMeta.durationSeconds.toFixed(2)),
    createdAt: new Date().toISOString(),
  };

  if (!skipSummary) {
    updateRecordingSummary(summaryPath, renderMeta, {
      setAsPrimary: isPrimaryVariant,
    });
  }

  log(`[${variant}] Video final: ${outputPath}`);
  log(`[${variant}] Subtitols: ${srtPath}`);
}

async function main() {
  const storyboardSlug = parseArg('--storyboard');
  if (!storyboardSlug) {
    fail('Has d indicar --storyboard <slug>.');
  }

  const variants = parseVariantsArg(parseArg('--variant'));
  assertSingleVariantOutputOverride(variants, parseArg('--output'));
  const primaryVariant = variants.includes('dual') ? 'dual' : variants[0];
  const captionStyle = parseCaptionStyleArg(parseArg('--caption-style'));
  const skipSummary = parseFlag('--skip-summary');

  const ffmpegPath = findBinary('ffmpeg');
  const ffprobePath = findBinary('ffprobe');
  if (!ffmpegPath || !ffprobePath) {
    fail('Cal tenir ffmpeg i ffprobe disponibles al sistema.');
  }

  const { storyboard, storyboardPath } = await loadStoryboard(storyboardSlug);

  const fonts = {
    bold: resolveFont(DEFAULT_FONT_BOLD, 'Arial Bold'),
    regular: resolveFont(DEFAULT_FONT_REGULAR, 'Arial'),
    ui: fs.existsSync(DEFAULT_FONT_UI) ? DEFAULT_FONT_UI : resolveFont(DEFAULT_FONT_REGULAR, 'Arial'),
  };

  const logoPath = DEFAULT_LOGO_PATH;
  if (!fs.existsSync(logoPath)) {
    fail(`No s ha trobat el logo de marca: ${logoPath}`);
  }

  const explicitIntroAssetPath = parseArg('--intro-asset');
  const explicitOutroAssetPath = parseArg('--outro-asset');
  const inputPathArg = parseArg('--input');
  const outputPathArg = parseArg('--output');

  for (const variant of variants) {
    const introAssetPath =
      explicitIntroAssetPath || firstExistingPath(getBrandClipCandidates('intro', variant));
    const outroAssetPath =
      explicitOutroAssetPath || firstExistingPath(getBrandClipCandidates('outro', variant));

    await renderVariant({
      variant,
      isPrimaryVariant: variant === primaryVariant,
      captionStyle,
      skipSummary,
      storyboard,
      storyboardPath,
      inputPathArg,
      outputPathArg,
      ffmpegPath,
      ffprobePath,
      fonts,
      logoPath,
      introAssetPath,
      outroAssetPath,
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
