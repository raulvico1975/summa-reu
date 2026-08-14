import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

test('Firestore manté lectura històrica i gateja totes les mutacions documentals', () => {
  const rules = readFileSync(join(process.cwd(), 'firestore.rules'), 'utf8');
  assert.match(rules, /match \/subscription\/\{subscriptionId\}[\s\S]*allow read:[\s\S]*allow write: if false;/);
  assert.match(rules, /request\.resource\.data\.get\('document', null\) == null \|\| canMutateTransactionDocuments\(orgId\)/);
  assert.match(rules, /diff\(resource\.data\)\.affectedKeys\(\)\.hasAny\(\['document'\]\)/);
  assert.match(rules, /resource\.data\.get\('document', null\) == null \|\| canMutateTransactionDocuments\(orgId\)/);
  assert.match(rules, /function subscriptionSnapshotMatchesCatalogV1\(orgId\)[\s\S]*plan == 'management'[\s\S]*pendingDocuments\.mutate', true\) == false[\s\S]*plan == 'complete'/);
  assert.match(rules, /match \/documents\/\{documentId\}[\s\S]*allow read:[\s\S]*allow create, update: if canMutateTransactionDocuments\(orgId\)[\s\S]*allow delete: if canMutateTransactionDocuments\(orgId\)/);
});

test('Storage permet lectura de membre però gateja create update i delete del document de moviment', () => {
  const rules = readFileSync(join(process.cwd(), 'storage.rules'), 'utf8');
  assert.match(rules, /match \/organizations\/\{orgId\}\/documents\/\{transactionId\}\/\{fileName\}[\s\S]*allow create, update: if canMutateTransactionDocuments\(orgId\)[\s\S]*allow delete: if canMutateTransactionDocuments\(orgId\)/);
  assert.match(rules, /function subscriptionSnapshotMatchesCatalogV1\(orgId\)[\s\S]*transactionDocuments\.readHistorical[\s\S]*pendingDocuments\.mutate/);
  assert.match(rules, /match \/organizations\/\{orgId\}\/documents\/\{transactionId\}\/\{fileName\}[\s\S]*allow read: if isSuperAdmin\(\) \|\| hasMovementReadCapability\(orgId\)/);
  assert.match(rules, /match \/organizations\/\{orgId\}\/\{allPaths=\*\*\}\s*\{\s*allow read, write: if false;\s*\}/);
  assert.doesNotMatch(rules, /allPaths\.matches\(/);
});

test('UI deixa lectura sempre visible i no assumeix edició per defecte', () => {
  const button = readFileSync(join(process.cwd(), 'src/components/transactions/TransactionDocumentsButton.tsx'), 'utf8');
  const desktop = readFileSync(join(process.cwd(), 'src/components/transactions/components/TransactionRow.tsx'), 'utf8');
  const mobile = readFileSync(join(process.cwd(), 'src/components/transactions/components/TransactionRowMobile.tsx'), 'utf8');
  assert.match(button, /canEdit = false/);
  assert.match(desktop, /canEdit=\{canMutateDocuments\}/);
  assert.match(mobile, /canEdit=\{canMutateDocuments\}/);
});
