import process from 'node:process';

const CORE_PATHS = [
  '/api/transactions',
  '/api/remittances',
  '/api/fiscal',
  '/api/stripe',
  '/lib/fiscal',
  '/lib/sepa',
  '/lib/remittances',
];

const EDGE_PATHS = [
  '/app/public',
  '/app/blog',
  '/components/ui',
  '/components/public',
  '/i18n/',
  '/help/',
  '/api/blog',
  '/api/product-updates',
  '/public/',
];

const INDIRECT_CORE_PATHS = ['/src/lib/data.ts', '/lib/data.ts'];

function normalizeFile(file) {
  const raw = String(file ?? '').trim();
  if (!raw) return '';

  const normalized = raw
    .replaceAll('\\', '/')
    .replace(/^\.?\//, '')
    .replace(/\/+/g, '/');

  return `/${normalized}`;
}

function normalizeFiles(files) {
  return (Array.isArray(files) ? files : [])
    .map(normalizeFile)
    .filter(Boolean);
}

function matchesAnyPath(file, paths) {
  return paths.some((path) => file.includes(path));
}

function isApiFile(file) {
  return file.includes('/api/');
}

function isDataTsFile(file) {
  return INDIRECT_CORE_PATHS.some((path) => file === path || file.endsWith(path));
}

export function classifyScope(files) {
  const normalizedFiles = normalizeFiles(files);

  for (const file of normalizedFiles) {
    if (matchesAnyPath(file, CORE_PATHS)) {
      return 'core';
    }
  }

  if (normalizedFiles.some((file) => isDataTsFile(file) || isApiFile(file))) {
    return 'core';
  }

  return 'edge';
}

export function touchesCoreIndirectly(files) {
  const normalizedFiles = normalizeFiles(files);
  return normalizedFiles.some((file) => isDataTsFile(file) || isApiFile(file));
}

export function classifyScopeDetails(files) {
  const normalizedFiles = normalizeFiles(files);
  const scope = classifyScope(normalizedFiles);
  const indirectCore = touchesCoreIndirectly(normalizedFiles);
  const hasExplicitEdgePaths = normalizedFiles.some((file) => matchesAnyPath(file, EDGE_PATHS));
  const risk = scope === 'core' || indirectCore ? 'ALT' : 'BAIX';
  const deployMode = scope === 'edge' && !indirectCore ? 'RAPID' : 'ESTRICTE';
  const verifyProfile = scope === 'edge' && !indirectCore ? 'FAST_PUBLIC' : 'STANDARD';

  return {
    scope,
    risk,
    deployMode,
    verifyProfile,
    touchesCoreIndirectly: indirectCore,
    hasExplicitEdgePaths,
    qaFiscalRequired: !(scope === 'edge' && !indirectCore),
  };
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let buffer = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      buffer += chunk;
    });
    process.stdin.on('end', () => resolve(buffer));
    process.stdin.on('error', reject);
  });
}

function parseInputFiles(argv, stdinText) {
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--format' || arg === '--field') {
      i += 1;
      continue;
    }
    if (arg.startsWith('--format=')) continue;
    if (arg.startsWith('--field=')) continue;
    positional.push(arg);
  }

  if (positional.length > 0) {
    return positional;
  }

  return String(stdinText ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function readOption(argv, name, fallback) {
  const inline = argv.find((arg) => arg.startsWith(`${name}=`));
  if (inline) {
    return inline.slice(name.length + 1);
  }

  const index = argv.indexOf(name);
  if (index !== -1 && typeof argv[index + 1] === 'string') {
    return argv[index + 1];
  }

  return fallback;
}

function printShell(details) {
  process.stdout.write(`SCOPE=${details.scope}\n`);
  process.stdout.write(`RISK=${details.risk}\n`);
  process.stdout.write(`DEPLOY_MODE=${details.deployMode}\n`);
  process.stdout.write(`VERIFY_PROFILE=${details.verifyProfile}\n`);
  process.stdout.write(`TOUCHES_CORE_INDIRECTLY=${details.touchesCoreIndirectly}\n`);
  process.stdout.write(`HAS_EXPLICIT_EDGE_PATHS=${details.hasExplicitEdgePaths}\n`);
  process.stdout.write(`QA_FISCAL_REQUIRED=${details.qaFiscalRequired}\n`);
}

async function main() {
  const argv = process.argv.slice(2);
  const wantsShell = readOption(argv, '--format', 'json') === 'shell';
  const field = readOption(argv, '--field', '');
  const stdinText = process.stdin.isTTY ? '' : await readStdin();
  const files = parseInputFiles(argv, stdinText);
  const details = classifyScopeDetails(files);

  if (field) {
    const value = details[field];
    if (typeof value === 'undefined') {
      process.exitCode = 1;
      return;
    }
    process.stdout.write(String(value));
    return;
  }

  if (wantsShell) {
    printShell(details);
    return;
  }

  process.stdout.write(`${JSON.stringify(details, null, 2)}\n`);
}

const isCliEntry = (() => {
  const entry = process.argv[1];
  return typeof entry === 'string' && entry.endsWith('/scope-classifier.mjs');
})();

if (isCliEntry) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
