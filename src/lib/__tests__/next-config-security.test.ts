import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const configPath = join(process.cwd(), 'next.config.ts');

function readConfig(): string {
  return readFileSync(configPath, 'utf8');
}

test('Next production build does not publish browser source maps', () => {
  const config = readConfig();

  assert.doesNotMatch(config, /productionBrowserSourceMaps:\s*true/);
  assert.match(config, /productionBrowserSourceMaps:\s*false/);
});

test('Next production build fails on TypeScript and ESLint errors', () => {
  const config = readConfig();

  assert.doesNotMatch(config, /ignoreBuildErrors:\s*true/);
  assert.doesNotMatch(config, /ignoreDuringBuilds:\s*true/);
});
