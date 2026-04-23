import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const rulesPath = join(process.cwd(), 'storage.rules');

function readRules(): string {
  return readFileSync(rulesPath, 'utf8');
}

test('storage rules deny blanket writes on arbitrary organization paths', () => {
  const rules = readRules();

  assert.match(
    rules,
    /match \/organizations\/\{orgId\}\/\{allPaths=\*\*\}\s*\{\s*allow read: if isSuperAdmin\(\) \|\| isOrgMember\(orgId\);\s*allow write: if false;\s*\}/m,
  );
});

test('storage rules reopen only confirmed operational upload prefixes', () => {
  const rules = readRules();

  assert.match(
    rules,
    /function hasOperationalOrgAccess\(orgId\)\s*\{[\s\S]*getMemberRole\(orgId\) == 'admin' \|\| getMemberRole\(orgId\) == 'user'[\s\S]*\}/m,
  );

  for (const prefix of [
    'pendingDocuments',
    'documents',
    'transactions',
    'offBankExpenses',
    'expenseReports',
    'prebankRemittances',
    'sepaCollectionRuns',
  ]) {
    const pattern = new RegExp(
      `match \\/organizations\\/\\{orgId\\}\\/${prefix}\\/\\{allPaths=\\*\\*\\}\\s*\\{\\s*allow write: if isSuperAdmin\\(\\) \\|\\| hasOperationalOrgAccess\\(orgId\\);\\s*\\}`,
      'm',
    );
    assert.match(rules, pattern);
  }
});

test('storage rules keep logo and signature uploads admin-only', () => {
  const rules = readRules();

  assert.match(
    rules,
    /match \/organizations\/\{orgId\}\/logo\s*\{\s*allow write: if isSuperAdmin\(\) \|\| isOrgAdmin\(orgId\);\s*\}/m,
  );
  assert.match(
    rules,
    /match \/organizations\/\{orgId\}\/signature\s*\{\s*allow write: if isSuperAdmin\(\) \|\| isOrgAdmin\(orgId\);\s*\}/m,
  );
});
