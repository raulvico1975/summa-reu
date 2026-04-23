import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const rulesPath = join(process.cwd(), 'firestore.rules');

test('firestore rules expose donations read behind moviments.read capability', () => {
  const rules = readFileSync(rulesPath, 'utf8');

  assert.match(
    rules,
    /match \/donations\/\{donationId\}\s*\{[\s\S]*allow read: if isSuperAdmin\(\) \|\| hasCapability\(orgId, 'moviments\.read'\);/m,
  );
});

test('firestore rules gate transactions update behind moviments.editar capability', () => {
  const rules = readFileSync(rulesPath, 'utf8');

  assert.match(
    rules,
    /match \/transactions\/\{transactionId\}\s*\{[\s\S]*allow update: if isSuperAdmin\(\)\s*\|\|\s*\(hasCapability\(orgId, 'moviments\.editar'\)[\s\S]*request\.resource\.data\.amount is number[\s\S]*\);/m,
  );
});
