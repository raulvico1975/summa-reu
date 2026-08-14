import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildEntitlementCutoverPreflight } from '../../src/lib/entitlements/cutover-preflight';
import type { EntitlementCutoverPreflightInput } from '../../src/lib/entitlements/cutover-preflight';

const inputIndex = process.argv.indexOf('--input');
const inputPath = inputIndex >= 0 ? process.argv[inputIndex + 1] : null;
if (!inputPath) throw new Error('Cal --input <snapshot-local.json>. No es consulta Firebase.');
const input = JSON.parse(await readFile(resolve(inputPath), 'utf8')) as EntitlementCutoverPreflightInput;
const report = buildEntitlementCutoverPreflight(input);
process.stdout.write(`${JSON.stringify({
  ...report,
  source: resolve(inputPath),
  readOnly: true,
}, null, 2)}\n`);
if (!report.canActivate) process.exitCode = 1;
