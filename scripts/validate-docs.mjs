#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, normalize } from 'node:path';

const ROOT = process.cwd();
const DOCS_DIR = join(ROOT, 'docs');
const CHECKED_PREFIXES = ['docs/', 'src/', 'functions/', 'scripts/', 'tests/'];
const ALLOWLIST_MISSING = new Set([
  'src/i18n/pt.ts',
  'src/i18n/locales/NEW.json',
]);
const requestedFiles = process.argv
  .slice(2)
  .map(file => normalize(join(ROOT, file)))
  .filter(file => file.startsWith(DOCS_DIR) && file.endsWith('.md') && existsSync(file));

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (full.endsWith('.md')) out.push(full);
  }
  return out;
}

function isSkippableRef(ref) {
  if (!ref) return true;
  if (ref.startsWith('http://') || ref.startsWith('https://')) return true;
  if (ref.startsWith('mailto:') || ref.startsWith('tel:')) return true;
  if (ref.startsWith('#') || ref.startsWith('/')) return true;
  if (ref.includes('*') || ref.includes('{') || ref.includes('}') || ref.includes('...')) return true;
  return false;
}

function resolveCandidate(mdFile, ref) {
  const rel = normalize(join(mdFile, '..', ref));
  const rootRel = normalize(join(ROOT, ref));
  return [rel, rootRel];
}

function shouldCheckBacktick(ref) {
  return CHECKED_PREFIXES.some(prefix => ref.startsWith(prefix));
}

function normalizeCodeRef(ref) {
  const noLine = ref.replace(/:\d+(?::\d+)?$/, '');
  return noLine;
}

const missing = [];
const files = requestedFiles.length > 0 ? [...new Set(requestedFiles)] : walk(DOCS_DIR);

for (const file of files) {
  const content = readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    for (const m of line.matchAll(/\[[^\]]*]\(([^)]+)\)/g)) {
      const ref = m[1].trim().split(' ')[0];
      if (isSkippableRef(ref)) continue;
      const [a, b] = resolveCandidate(file, ref);
      if (!existsSync(a) && !existsSync(b)) {
        missing.push(`${file}:${i + 1} markdown link -> ${ref}`);
      }
    }

    for (const m of line.matchAll(/`([^`]+)`/g)) {
      const rawRef = m[1].trim();
      if (rawRef.includes(' ')) continue;
      const ref = normalizeCodeRef(rawRef);
      if (!shouldCheckBacktick(ref)) continue;
      if (isSkippableRef(ref)) continue;
      if (ALLOWLIST_MISSING.has(ref)) continue;
      const [a, b] = resolveCandidate(file, ref);
      if (!existsSync(a) && !existsSync(b)) {
        missing.push(`${file}:${i + 1} code ref -> ${ref}`);
      }
    }
  }
}

if (missing.length > 0) {
  console.error('DOCS_CHECK_FAIL');
  for (const m of missing) console.error(`- ${m}`);
  process.exit(1);
}

console.log('DOCS_CHECK_OK');
