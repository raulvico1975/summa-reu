import test from 'node:test';
import assert from 'node:assert/strict';
import { requirePermission } from '@/lib/api/require-permission';
import type { MembershipValidation } from '@/lib/api/admin-sdk';
import {
  canAccessMovimentsRoute,
  canReadBankInProjectes,
  resolveEffectivePermissions,
} from '@/lib/permissions';
import {
  memberPermissionsDocPath,
  validateAndCanonicalizeUserPermissionWrite,
} from '@/lib/permissions-write';

function buildMembership(
  overrides: MembershipValidation['userOverrides'],
  grants: MembershipValidation['userGrants']
): MembershipValidation {
  return {
    valid: true,
    role: 'user',
    userOverrides: overrides,
    userGrants: grants,
  };
}

test('persistència: write overrides + reload mantenen effectivePermissions', () => {
  const validated = validateAndCanonicalizeUserPermissionWrite({
    deny: ['moviments.read', 'projectes.manage'],
    grants: ['projectes.expenseInput'],
  });
  assert.equal(validated.ok, true);
  if (!validated.ok) return;

  const storedDoc = JSON.parse(JSON.stringify({
    userOverrides: validated.value.deny.length > 0 ? { deny: validated.value.deny } : null,
    userGrants: validated.value.grants.length > 0 ? validated.value.grants : null,
  })) as {
    userOverrides: { deny: string[] } | null;
    userGrants: string[] | null;
  };

  const reloaded = resolveEffectivePermissions({
    role: 'user',
    userOverrides: storedDoc.userOverrides,
    userGrants: storedDoc.userGrants,
  });

  assert.equal(reloaded['moviments.read'], false);
  assert.equal(reloaded['projectes.manage'], false);
  assert.equal(reloaded['projectes.expenseInput'], true);
  assert.equal(canReadBankInProjectes(reloaded), false);
});

test('validació d escriptura: mode none canònic força denies de projectes i secció', () => {
  const result = validateAndCanonicalizeUserPermissionWrite({
    deny: ['projectes.manage', 'projectes.expenseInput'],
    grants: ['projectes.expenseInput'],
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.projectCapability, 'none');
  assert.deepEqual(result.value.deny, ['projectes.expenseInput', 'projectes.manage', 'sections.projectes']);
  assert.deepEqual(result.value.grants, []);
});

test('validació d escriptura: combinació legacy expenseInput es manté', () => {
  const result = validateAndCanonicalizeUserPermissionWrite({
    deny: ['projectes.manage'],
    grants: ['projectes.expenseInput'],
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.projectCapability, 'expenseInput');
  assert.equal(result.value.deny.includes('projectes.manage'), true);
  assert.equal(result.value.deny.includes('projectes.expenseInput'), false);
  assert.equal(result.value.grants.includes('projectes.expenseInput'), true);
});

test('validació d escriptura: mode manage per defecte es manté', () => {
  const result = validateAndCanonicalizeUserPermissionWrite({
    deny: [],
    grants: [],
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.projectCapability, 'manage');
});

test('multi-org: mateix uid té overrides independents per organització', () => {
  const uid = 'uid-shared';
  const store = new Map<string, { userOverrides: { deny: string[] } | null; userGrants: string[] | null }>();

  const orgAPath = memberPermissionsDocPath('org-a', uid);
  const orgBPath = memberPermissionsDocPath('org-b', uid);

  store.set(orgAPath, {
    userOverrides: { deny: ['moviments.read'] },
    userGrants: null,
  });
  store.set(orgBPath, {
    userOverrides: { deny: ['sections.moviments'] },
    userGrants: null,
  });

  const permsOrgA = resolveEffectivePermissions({
    role: 'user',
    userOverrides: store.get(orgAPath)?.userOverrides ?? null,
    userGrants: store.get(orgAPath)?.userGrants ?? null,
  });
  const permsOrgB = resolveEffectivePermissions({
    role: 'user',
    userOverrides: store.get(orgBPath)?.userOverrides ?? null,
    userGrants: store.get(orgBPath)?.userGrants ?? null,
  });

  assert.equal(permsOrgA['moviments.read'], false);
  assert.equal(permsOrgB['moviments.read'], true);
  assert.equal(canAccessMovimentsRoute(permsOrgA), false);
  assert.equal(canAccessMovimentsRoute(permsOrgB), false);
  assert.equal(canReadBankInProjectes(permsOrgA), false);
  assert.equal(canReadBankInProjectes(permsOrgB), true);
});

test('endpoint guard /api/moviments: 403 si sections.moviments=false i moviments.read=true', async () => {
  const membership = buildMembership({ deny: ['sections.moviments'] }, null);
  const denied = requirePermission(membership, {
    code: 'MOVIMENTS_ROUTE_REQUIRED',
    check: canAccessMovimentsRoute,
  });

  assert.ok(denied);
  if (!denied) return;
  assert.equal(denied.status, 403);
  const payload = await denied.json() as { code: string };
  assert.equal(payload.code, 'MOVIMENTS_ROUTE_REQUIRED');
});

test('endpoint guard /api/moviments: 403 si sections.moviments=true i moviments.read=false', async () => {
  const membership = buildMembership({ deny: ['moviments.read'] }, null);
  const denied = requirePermission(membership, {
    code: 'MOVIMENTS_ROUTE_REQUIRED',
    check: canAccessMovimentsRoute,
  });

  assert.ok(denied);
  if (!denied) return;
  assert.equal(denied.status, 403);
  const payload = await denied.json() as { code: string };
  assert.equal(payload.code, 'MOVIMENTS_ROUTE_REQUIRED');
});

test('endpoint guard /api/moviments: permet només si sections.moviments=true i moviments.read=true', () => {
  const membership = buildMembership(null, null);
  const denied = requirePermission(membership, {
    code: 'MOVIMENTS_ROUTE_REQUIRED',
    check: canAccessMovimentsRoute,
  });

  assert.equal(denied, null);
});

test('endpoint guard /api/projectes/:id/moviments: passa amb manage+read encara que sections.moviments=false', () => {
  const membership = buildMembership({ deny: ['sections.moviments'] }, null);
  const denied = requirePermission(membership, {
    code: 'PROJECTES_BANK_READ_REQUIRED',
    check: canReadBankInProjectes,
  });

  assert.equal(denied, null);
});

test('endpoint guard /api/projectes/:id/moviments: 403 si expenseInput=true encara que moviments.read=true', async () => {
  const membership = buildMembership(
    { deny: ['projectes.manage'] },
    ['projectes.expenseInput']
  );
  const denied = requirePermission(membership, {
    code: 'PROJECTES_BANK_READ_REQUIRED',
    check: canReadBankInProjectes,
  });

  assert.ok(denied);
  if (!denied) return;
  assert.equal(denied.status, 403);
  const payload = await denied.json() as { code: string };
  assert.equal(payload.code, 'PROJECTES_BANK_READ_REQUIRED');
});

test('validació d escriptura: rebutja grants de famílies no grantables', () => {
  const result = validateAndCanonicalizeUserPermissionWrite({
    deny: [],
    grants: ['membres.manage'],
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, 'NON_GRANTABLE_PERMISSION');
});

test('validació d escriptura: rebutja claus fora del catàleg tancat', () => {
  const result = validateAndCanonicalizeUserPermissionWrite({
    deny: ['foo.bar'],
    grants: [],
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, 'INVALID_PERMISSION_KEY');
});
