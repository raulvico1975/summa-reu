import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const nextBin = path.join(
  projectRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'next.cmd' : 'next'
);
const nextDistDir = path.join(projectRoot, '.next');

function isRecoverableNextCacheError(output) {
  return (
    output.includes('.next/server/webpack-runtime.js')
    && output.includes('MODULE_NOT_FOUND')
    && /Cannot find module '\.\/\d+\.js'/.test(output)
  );
}

function runNextBuild() {
  return new Promise((resolve) => {
    const child = spawn(nextBin, ['build'], {
      cwd: projectRoot,
      env: process.env,
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    let combinedOutput = '';

    child.stdout.on('data', (chunk) => {
      combinedOutput += chunk.toString();
      process.stdout.write(chunk);
    });

    child.stderr.on('data', (chunk) => {
      combinedOutput += chunk.toString();
      process.stderr.write(chunk);
    });

    child.on('close', (code) => {
      resolve({
        code: code ?? 1,
        combinedOutput,
      });
    });
  });
}

async function main() {
  const firstBuild = await runNextBuild();
  if (firstBuild.code === 0) {
    process.exit(0);
  }

  if (!isRecoverableNextCacheError(firstBuild.combinedOutput)) {
    process.exit(firstBuild.code);
  }

  console.warn(
    '\n[build-safe] Detectat un build inconsistent dins de .next. ' +
    'Esborro artefactes locals i reintento una sola vegada.'
  );
  await rm(nextDistDir, { recursive: true, force: true });

  const secondBuild = await runNextBuild();
  process.exit(secondBuild.code);
}

await main();
