import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

type ManualSyncPair = {
  source: string;
  target: string;
  label: string;
};

const pairs: ManualSyncPair[] = [
  {
    source: 'docs/manual-usuari-summa-social.md',
    target: 'public/docs/manual-usuari-summa-social.ca.md',
    label: 'manual CA',
  },
  {
    source: 'docs/manual-usuari-summa-social.es.md',
    target: 'public/docs/manual-usuari-summa-social.es.md',
    label: 'manual ES',
  },
];

for (const pair of pairs) {
  const sourcePath = resolve(process.cwd(), pair.source);
  const targetPath = resolve(process.cwd(), pair.target);

  if (!existsSync(sourcePath)) {
    console.error(`[help:sync-manual] Missing source for ${pair.label}: ${pair.source}`);
    process.exit(1);
  }

  copyFileSync(sourcePath, targetPath);
  console.log(`[help:sync-manual] Synced ${pair.label}: ${pair.source} -> ${pair.target}`);
}
