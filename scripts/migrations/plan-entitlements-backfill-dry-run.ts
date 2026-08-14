import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildEntitlementBackfillDryRun, type LegacyOrganizationBillingRecord } from '../../src/lib/entitlements/backfill';

const inputPath = process.argv[2];
if (!inputPath) {
  throw new Error('Ús: node --import tsx scripts/migrations/plan-entitlements-backfill-dry-run.ts <organizations.json>');
}

const payload = JSON.parse(await readFile(resolve(inputPath), 'utf8')) as unknown;
if (!Array.isArray(payload)) {
  throw new Error('El fitxer ha de contenir un array d’organitzacions.');
}

const records = payload as LegacyOrganizationBillingRecord[];
const report = buildEntitlementBackfillDryRun(records);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
