import { randomBytes } from 'node:crypto';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import {
  INTEGRATION_TOKENS_COLLECTION,
  PRIVATE_INTEGRATION_TOKEN_TYPE,
  hashIntegrationToken,
  type IntegrationScope,
} from '../../src/lib/api/integration-auth';

const VALID_SCOPES: IntegrationScope[] = [
  'contacts.read',
  'transactions.read',
  'pending_documents.write',
];

interface ParsedArgs {
  orgId: string;
  label: string;
  createdBy: string;
  sourceRepo: string | null;
  scopes: IntegrationScope[];
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  let orgId = '';
  let label = '';
  let createdBy = '';
  let sourceRepo: string | null = null;
  const scopes: IntegrationScope[] = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const next = args[i + 1];

    if (arg === '--org' && next) {
      orgId = next.trim();
      i += 1;
      continue;
    }
    if (arg === '--label' && next) {
      label = next.trim();
      i += 1;
      continue;
    }
    if (arg === '--created-by' && next) {
      createdBy = next.trim();
      i += 1;
      continue;
    }
    if (arg === '--source-repo' && next) {
      sourceRepo = next.trim() || null;
      i += 1;
      continue;
    }
    if (arg === '--scope' && next) {
      if (!VALID_SCOPES.includes(next as IntegrationScope)) {
        throw new Error(`Scope invàlid: ${next}`);
      }
      scopes.push(next as IntegrationScope);
      i += 1;
    }
  }

  if (!orgId) {
    throw new Error('Cal --org <orgId>');
  }
  if (!label) {
    throw new Error('Cal --label <label>');
  }
  if (!createdBy) {
    throw new Error('Cal --created-by <identificador>');
  }
  if (scopes.length === 0) {
    throw new Error('Cal almenys un --scope <scope>');
  }

  return {
    orgId,
    label,
    createdBy,
    sourceRepo,
    scopes: [...new Set(scopes)],
  };
}

function generateClearToken(): string {
  return `summa_it_${randomBytes(32).toString('base64url')}`;
}

async function main(): Promise<void> {
  const args = parseArgs();

  if (getApps().length === 0) {
    initializeApp({
      credential: applicationDefault(),
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'summa-social',
    });
  }

  const db = getFirestore();
  const clearToken = generateClearToken();
  const tokenHash = hashIntegrationToken(clearToken);
  const existing = await db
    .collection(INTEGRATION_TOKENS_COLLECTION)
    .where('tokenHash', '==', tokenHash)
    .limit(1)
    .get();

  if (!existing.empty) {
    throw new Error('Token hash duplicat inesperat; torna-ho a intentar');
  }

  const docRef = db.collection(INTEGRATION_TOKENS_COLLECTION).doc();

  await docRef.create({
    tokenType: PRIVATE_INTEGRATION_TOKEN_TYPE,
    orgId: args.orgId,
    tokenHash,
    scopes: args.scopes,
    status: 'active',
    createdAt: FieldValue.serverTimestamp(),
    createdBy: args.createdBy,
    lastUsedAt: null,
    label: args.label,
    sourceRepo: args.sourceRepo,
  });

  console.log(JSON.stringify({
    tokenId: docRef.id,
    orgId: args.orgId,
    label: args.label,
    sourceRepo: args.sourceRepo,
    scopes: args.scopes,
    clearToken,
  }, null, 2));
}

main().catch((error) => {
  console.error('[create-private-token] error', error);
  process.exitCode = 1;
});
