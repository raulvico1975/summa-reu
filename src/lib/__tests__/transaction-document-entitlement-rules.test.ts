import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

test('Firestore manté lectura històrica i gateja totes les mutacions documentals', () => {
  const rules = readFileSync(join(process.cwd(), 'firestore.rules'), 'utf8');
  assert.match(rules, /match \/subscription\/\{subscriptionId\}[\s\S]*allow read:[\s\S]*allow write: if false;/);
  assert.match(rules, /request\.resource\.data\.get\('document', null\) == null/);
  assert.match(rules, /!request\.resource\.data\.diff\(resource\.data\)\.affectedKeys\(\)\.hasAny\(\['document'\]\)/);
  assert.match(rules, /resource\.data\.get\('document', null\) == null[\s\S]*!exists\(\/databases\/\$\(database\)\/documents\/organizations\/\$\(orgId\)\/transactionDocumentRegistry\/\$\(transactionId\)\)/);
  assert.match(rules, /function subscriptionSnapshotMatchesCatalogV3\(orgId\)[\s\S]*catalogVersion', 0\) == 3[\s\S]*summa-entitlements-v3-management[\s\S]*summa-entitlements-v3-complete/);
  assert.doesNotMatch(rules, /subscriptionSnapshotMatchesCatalogV3[\s\S]{0,1200}get\('entitlements'/);
  assert.match(rules, /match \/documents\/\{documentId\}[\s\S]*allow read:[\s\S]*allow create, update, delete: if false;/);
});

test('Storage permet lectura de membre però gateja create update i delete del document de moviment', () => {
  const rules = readFileSync(join(process.cwd(), 'storage.rules'), 'utf8');
  assert.match(rules, /match \/organizations\/\{orgId\}\/documents\/\{transactionId\}\/\{fileName\}[\s\S]*allow create: if canMutateTransactionDocuments\(orgId\)[\s\S]*allow update, delete: if false;/);
  assert.match(rules, /match \/organizations\/\{orgId\}\/transactions\/\{transactionId\}\/\{fileName\}[\s\S]*allow create: if canMutateTransactionDocuments\(orgId\)[\s\S]*allow update, delete: if false;/);
  assert.match(rules, /function subscriptionSnapshotMatchesCatalogV3\(orgId\)[\s\S]*catalogFingerprint[\s\S]*summa-entitlements-v3-complete/);
  assert.doesNotMatch(rules, /subscriptionSnapshotMatchesCatalogV3[\s\S]{0,1200}get\('entitlements'/);
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
