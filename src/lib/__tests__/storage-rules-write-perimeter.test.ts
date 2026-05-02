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
    assert.doesNotMatch(
      rules,
      new RegExp(`match \\/organizations\\/\\{orgId\\}\\/${prefix}\\/\\{allPaths=\\*\\*\\}`),
    );
    assert.match(
      rules,
      new RegExp(`match \\/organizations\\/\\{orgId\\}\\/${prefix}\\/\\{[A-Za-z]+Id\\}\\/\\{fileName\\}`),
    );
  }
});

test('storage rules keep logo and signature uploads admin-only', () => {
  const rules = readRules();

  assert.match(
    rules,
    /match \/organizations\/\{orgId\}\/logo\s*\{\s*allow create, update: if \(isSuperAdmin\(\) \|\| isOrgAdmin\(orgId\)\)\s*&& isAllowedImage\(\)\s*&& isAtMost\(2 \* 1024 \* 1024\);/m,
  );
  assert.match(
    rules,
    /match \/organizations\/\{orgId\}\/signature\s*\{\s*allow create, update: if \(isSuperAdmin\(\) \|\| isOrgAdmin\(orgId\)\)\s*&& isAllowedImage\(\)\s*&& isAtMost\(1 \* 1024 \* 1024\);/m,
  );
});

test('storage rules constrain client writes by MIME type and size', () => {
  const rules = readRules();

  assert.match(rules, /function isAllowedImage\(\)\s*\{[\s\S]*image\/\(jpeg\|png\|gif\|webp\)[\s\S]*\}/m);
  assert.match(rules, /function isPdf\(\)\s*\{[\s\S]*application\/pdf[\s\S]*\}/m);
  assert.match(rules, /function isXml\(\)\s*\{[\s\S]*application\/xml[\s\S]*text\/xml[\s\S]*\}/m);
  assert.match(rules, /function isOfficeDocument\(\)\s*\{[\s\S]*wordprocessingml\.document[\s\S]*spreadsheetml\.sheet[\s\S]*\}/m);
  assert.doesNotMatch(rules, /image\/svg\+xml/);
  assert.doesNotMatch(rules, /application\/octet-stream/);
  assert.doesNotMatch(rules, /text\/html/);
  assert.doesNotMatch(rules, /application\/javascript/);

  for (const maxBytes of [
    '15 * 1024 * 1024',
    '2 * 1024 * 1024',
    '1 * 1024 * 1024',
  ]) {
    assert.match(rules, new RegExp(`isAtMost\\(${maxBytes.replaceAll('*', '\\*')}\\)`));
  }
});

test('storage rules preserve only the explicit health-check text upload path', () => {
  const rules = readRules();

  assert.match(
    rules,
    /docId == '_healthcheck' && fileName\.matches\('\[0-9\]\+\\\\\.txt'\) && isPlainText\(\) && isAtMost\(1024\)/m,
  );
  assert.doesNotMatch(rules, /isPlainText\(\)\s*\|\|/);
});
