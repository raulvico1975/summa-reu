import { ENTITLEMENTS_CATALOG_VERSION } from '../../src/lib/entitlements/catalog';
import { resolveEntitlementSystemConfig } from '../../src/lib/entitlements/system-config';

const applyRequested = process.argv.includes('--apply');
if (applyRequested) {
  throw new Error('WRITE_DISABLED: aquest paquet només prepara el seed; no escriu Firebase real.');
}

const proposedDocument = {
  enforcementMode: 'off' as const,
  catalogVersion: ENTITLEMENTS_CATALOG_VERSION,
};
const postValidation = resolveEntitlementSystemConfig(proposedDocument);

process.stdout.write(`${JSON.stringify({
  dryRun: true,
  targetPath: 'system/entitlements',
  proposedDocument,
  postValidation,
  writesExecuted: 0,
}, null, 2)}\n`);
