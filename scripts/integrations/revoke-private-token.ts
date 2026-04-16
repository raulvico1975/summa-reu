import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { INTEGRATION_TOKENS_COLLECTION } from '../../src/lib/api/integration-auth';

function parseArgs(): { tokenId: string } {
  const args = process.argv.slice(2);
  let tokenId = '';

  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--token-id' && args[i + 1]) {
      tokenId = args[i + 1].trim();
      i += 1;
    }
  }

  if (!tokenId) {
    throw new Error('Cal --token-id <tokenId>');
  }

  return { tokenId };
}

async function main(): Promise<void> {
  const { tokenId } = parseArgs();

  if (getApps().length === 0) {
    initializeApp({
      credential: applicationDefault(),
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'summa-social',
    });
  }

  const db = getFirestore();
  const ref = db.doc(`${INTEGRATION_TOKENS_COLLECTION}/${tokenId}`);
  const snap = await ref.get();

  if (!snap.exists) {
    throw new Error(`Token no trobat: ${tokenId}`);
  }

  await ref.set(
    {
      status: 'revoked',
    },
    { merge: true }
  );

  console.log(JSON.stringify({
    tokenId,
    status: 'revoked',
  }, null, 2));
}

main().catch((error) => {
  console.error('[revoke-private-token] error', error);
  process.exitCode = 1;
});
