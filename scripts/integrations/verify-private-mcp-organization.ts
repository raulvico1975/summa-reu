import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main(): Promise<void> {
  const orgId = requiredEnv('SUMMA_ORG_ID');
  const expectedName = requiredEnv('SUMMA_MCP_EXPECTED_ORG_NAME');

  if (getApps().length === 0) {
    initializeApp({
      credential: applicationDefault(),
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'summa-social',
    });
  }

  const snapshot = await getFirestore().doc(`organizations/${orgId}`).get();
  const data = snapshot.data();
  if (!snapshot.exists || data?.name !== expectedName || data?.status !== 'active') {
    throw new Error('SUMMA_MCP_ORGANIZATION_MISMATCH');
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
  process.stderr.write(`[verify-private-mcp-organization] ${message}\n`);
  process.exitCode = 1;
});
