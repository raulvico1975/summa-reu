#!/usr/bin/env node
/**
 * Runner per entorn DEMO
 * Carrega .env.demo manualment i executa next dev
 *
 * Ús: npm run dev:demo
 *
 * NO usa dotenv ni cap dependència externa.
 */

import { spawn } from 'child_process';
import { readFileSync, existsSync, lstatSync, realpathSync } from 'fs';
import { resolve, dirname, sep } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const envDemoPath = resolve(projectRoot, '.env.demo');

// ─────────────────────────────────────────────────────────────────────────────
// Parsejar .env.demo manualment
// ─────────────────────────────────────────────────────────────────────────────

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) {
    console.error(`\x1b[31mError: No s'ha trobat ${filePath}\x1b[0m`);
    console.error('Crea el fitxer .env.demo amb les credencials del projecte Firebase demo.');
    process.exit(1);
  }

  const content = readFileSync(filePath, 'utf-8');
  const env = {};

  for (const line of content.split('\n')) {
    // Ignorar línies buides i comentaris
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Parsejar KEY=VALUE
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    // Treure cometes si n'hi ha
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validar variables requerides
// ─────────────────────────────────────────────────────────────────────────────

function validateEnv(env) {
  const required = [
    'APP_ENV',
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  ];

  const missing = required.filter(key => !env[key]);

  if (missing.length > 0) {
    console.error('\x1b[31mError: Variables requerides no definides a .env.demo:\x1b[0m');
    missing.forEach(key => console.error(`  - ${key}`));
    console.error('\nOmple els valors buits a .env.demo amb les credencials del projecte Firebase demo.');
    process.exit(1);
  }

  if (env.APP_ENV !== 'demo') {
    console.error('\x1b[31mError: APP_ENV ha de ser "demo" a .env.demo\x1b[0m');
    process.exit(1);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Netejar GOOGLE_APPLICATION_CREDENTIALS si el fitxer no existeix
// Això permet que ADC (gcloud auth application-default login) funcioni
// ─────────────────────────────────────────────────────────────────────────────

function cleanupCredentialsEnv(env) {
  const credPath = env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credPath) {
    // Resoldre path relatiu
    const absolutePath = resolve(projectRoot, credPath);
    if (!existsSync(absolutePath)) {
      console.log('\x1b[33m[DEMO]\x1b[0m GOOGLE_APPLICATION_CREDENTIALS apunta a fitxer inexistent.');
      console.log('\x1b[33m[DEMO]\x1b[0m Eliminant variable per usar ADC (gcloud auth application-default login).\n');
      delete env.GOOGLE_APPLICATION_CREDENTIALS;
    }
  }
  return env;
}

function chooseBundler() {
  const requested = process.env.NEXT_DEV_BUNDLER?.trim().toLowerCase();
  if (requested === 'webpack' || requested === 'turbopack') return requested;

  const nodeModulesPath = resolve(projectRoot, 'node_modules');
  if (!existsSync(nodeModulesPath)) return 'turbopack';

  try {
    const stat = lstatSync(nodeModulesPath);
    if (!stat.isSymbolicLink()) return 'turbopack';

    const resolved = realpathSync(nodeModulesPath);
    const withinProjectRoot =
      resolved === projectRoot || resolved.startsWith(`${projectRoot}${sep}`);

    if (!withinProjectRoot) {
      console.log(
        '\x1b[33m[DEMO]\x1b[0m node_modules enllaçat fora del worktree. Canviant a webpack per evitar el crash de Turbopack.'
      );
      return 'webpack';
    }
  } catch {
    // Si no podem inspeccionar l enllac, mantenim el bundler per defecte.
  }

  return 'turbopack';
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

console.log('\x1b[36m[DEMO]\x1b[0m Carregant entorn demo...');

const demoEnv = parseEnvFile(envDemoPath);
validateEnv(demoEnv);

// Netejar GOOGLE_APPLICATION_CREDENTIALS si fitxer no existeix
cleanupCredentialsEnv(demoEnv);

// Injectar a process.env
Object.assign(process.env, demoEnv);

console.log(`\x1b[36m[DEMO]\x1b[0m Projecte: ${demoEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID}`);
console.log('\x1b[36m[DEMO]\x1b[0m Arrencant Next.js...\n');

// Executar next dev amb env net (sense GOOGLE_APPLICATION_CREDENTIALS si no existeix)
const finalEnv = { ...process.env, ...demoEnv };
delete finalEnv.GOOGLE_APPLICATION_CREDENTIALS; // Forçar ús d'ADC
const bundler = chooseBundler();
const nextArgs = ['next', 'dev', '-p', '9002'];

if (bundler === 'turbopack') {
  nextArgs.splice(2, 0, '--turbopack');
}

console.log(`\x1b[36m[DEMO]\x1b[0m Bundler demo: ${bundler}`);

const nextDev = spawn('npx', nextArgs, {
  cwd: projectRoot,
  stdio: 'inherit',
  env: finalEnv,
  shell: process.platform === 'win32',
});

nextDev.on('error', (err) => {
  console.error('\x1b[31mError arrencant Next.js:\x1b[0m', err.message);
  process.exit(1);
});

nextDev.on('close', (code) => {
  process.exit(code ?? 0);
});
