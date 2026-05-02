import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const configPath = join(process.cwd(), 'next.config.ts');

function readConfig(): string {
  return readFileSync(configPath, 'utf8');
}

test('Next config applies low-risk security headers globally', () => {
  const config = readConfig();

  for (const header of [
    "key: 'X-Content-Type-Options'",
    "value: 'nosniff'",
    "key: 'Referrer-Policy'",
    "value: 'strict-origin-when-cross-origin'",
    "key: 'X-Frame-Options'",
    "value: 'DENY'",
    "key: 'Permissions-Policy'",
    "value: 'camera=(), microphone=(), geolocation=()'",
    "key: 'Strict-Transport-Security'",
    "value: 'max-age=31536000; includeSubDomains'",
  ]) {
    assert.ok(config.includes(header), `Missing header config: ${header}`);
  }

  assert.match(config, /source:\s*'\/:path\*'/);
});

test('Next config does not add CSP in the low-risk headers PR', () => {
  const config = readConfig();
  const cspHeader = 'Content-' + 'Security-Policy';

  assert.ok(!config.includes(cspHeader));
});
