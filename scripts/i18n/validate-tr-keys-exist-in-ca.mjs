#!/usr/bin/env node
/**
 * Hard-block validator: totes les claus literals de tr("…") han d'existir a ca.json.
 *
 * Escaneja src/**\/*.ts i src/**\/*.tsx (excloent node_modules, __tests__, .d.ts).
 * Només extreu claus literals (no dinàmiques: tr(variable) s'ignora).
 * Zero dependències externes.
 *
 * Ús: node scripts/i18n/validate-tr-keys-exist-in-ca.mjs
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { dirname, join, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const SRC = join(ROOT, 'src');
const CA_PATH = join(ROOT, 'src/i18n/locales/ca.json');
const requestedFiles = process.argv
  .slice(2)
  .map(file => join(ROOT, file))
  .filter(file => file.startsWith(SRC) && ['.ts', '.tsx'].includes(extname(file)) && !file.endsWith('.d.ts'));

const MAX_PRINT = 200;

// Regex: tr('key') or tr("key") — literal strings only
const TR_RE = /\btr\(\s*["']([^"']+)["']\s*[,)]/g;

// Also match tri("key", params) — interpolated tr
const TRI_RE = /\btri\(\s*["']([^"']+)["']\s*,/g;

const SKIP_DIRS = new Set(['node_modules', '__tests__', '.next', 'dist']);

// Keys that appear in code comments/docs as examples, not real usage
const IGNORE_KEYS = new Set(['missing.key']);

function loadJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch (err) {
    console.error(`ERROR: JSON invàlid a ca.json: ${err.message}`);
    process.exit(1);
  }
}

function walkDir(dir, exts, results = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walkDir(full, exts, results);
    } else if (exts.has(extname(full)) && !full.endsWith('.d.ts')) {
      results.push(full);
    }
  }
  return results;
}

function extractKeys(content) {
  const keys = new Set();
  let match;

  TR_RE.lastIndex = 0;
  while ((match = TR_RE.exec(content)) !== null) {
    keys.add(match[1]);
  }

  TRI_RE.lastIndex = 0;
  while ((match = TRI_RE.exec(content)) !== null) {
    keys.add(match[1]);
  }

  return keys;
}

function main() {
  const ca = loadJson(CA_PATH);
  const caKeys = new Set(Object.keys(ca));

  const files = requestedFiles.length > 0 ? [...new Set(requestedFiles)] : walkDir(SRC, new Set(['.ts', '.tsx']));
  const allKeys = new Set();

  for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    for (const key of extractKeys(content)) {
      allKeys.add(key);
    }
  }

  const missing = [...allKeys].filter(k => !caKeys.has(k) && !IGNORE_KEYS.has(k)).sort();

  if (missing.length > 0) {
    console.error(`\n✗ ${missing.length} clau(s) tr("…") absent(s) a ca.json:`);
    const shown = missing.slice(0, MAX_PRINT);
    for (const k of shown) {
      console.error(`  - ${k}`);
    }
    if (missing.length > MAX_PRINT) {
      console.error(`  … +${missing.length - MAX_PRINT} més`);
    }
    console.error('\n✗ i18n BLOCKED: afegeix les claus a ca.json abans de commitejar.\n');
    process.exit(1);
  }

  console.log(`✓ i18n OK: all ${allKeys.size} tr("…") keys exist in ca.json`);
}

main();
