import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const rulesPath = join(process.cwd(), 'firestore.rules');

test('firestore rules no longer authorize org access via editable profile fields', () => {
  const rules = readFileSync(rulesPath, 'utf8');

  assert.doesNotMatch(rules, /hasOrgInProfile\s*\(/m);
});

test('firestore rules keep user profile organization routing fields immutable on update', () => {
  const rules = readFileSync(rulesPath, 'utf8');

  assert.match(
    rules,
    /match \/users\/\{userId\}\s*\{[\s\S]*allow update: if isSignedIn\(\)[\s\S]*request\.auth\.uid == userId[\s\S]*request\.resource\.data\.organizationId == resource\.data\.organizationId[\s\S]*request\.resource\.data\.get\('defaultOrganizationId', null\) == resource\.data\.get\('defaultOrganizationId', null\);/m,
  );
});

test('firestore rules do not allow arbitrary self-created profiles to set org routing', () => {
  const rules = readFileSync(rulesPath, 'utf8');

  assert.match(
    rules,
    /match \/users\/\{userId\}\s*\{[\s\S]*allow create: if isSignedIn\(\) && request\.auth\.uid == userId && isSuperAdmin\(\);/m,
  );
});

test('firestore rules require canonical membership for organization and members reads', () => {
  const rules = readFileSync(rulesPath, 'utf8');

  assert.match(
    rules,
    /match \/organizations\/\{orgId\}\s*\{[\s\S]*allow read: if isMemberOf\(orgId\) \|\| isSuperAdmin\(\);[\s\S]*match \/members\/\{memberId\}\s*\{[\s\S]*allow read: if isMemberOf\(orgId\) \|\| isSuperAdmin\(\);/m,
  );
});

test('firestore rules reserve backup integrations reads to superadmin only', () => {
  const rules = readFileSync(rulesPath, 'utf8');

  assert.match(
    rules,
    /match \/integrations\/\{integrationId\}\s*\{[\s\S]*allow read: if isSuperAdmin\(\);[\s\S]*match \/backupOAuthRequests\/\{requestId\}\s*\{[\s\S]*allow read: if isSuperAdmin\(\);/m,
  );
});
