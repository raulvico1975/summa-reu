import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyOverrides,
  canAccessProjectsArea,
  canAccessMovimentsRoute,
  canReadBankInProjectes,
  canUseProjectModule,
  getRoleDefaults,
  getProjectCapability,
  isUserPermissionsCustomized,
  permissionsToCapabilities,
  resolveEffectivePermissions,
} from '@/lib/permissions';

test('criterion 1: user without moviments.read sees no bank anywhere', () => {
  const permissions = resolveEffectivePermissions({
    role: 'user',
    userOverrides: { deny: ['moviments.read'] },
  });

  assert.equal(canAccessMovimentsRoute(permissions), false);
  assert.equal(canReadBankInProjectes(permissions), false);
});

test('criterion 2: expenseInput never sees bank even if moviments.read is true', () => {
  const permissions = resolveEffectivePermissions({
    role: 'user',
    userOverrides: { deny: ['projectes.manage'] },
    userGrants: ['projectes.expenseInput'],
  });

  assert.equal(permissions['moviments.read'], true);
  assert.equal(permissions['projectes.expenseInput'], true);
  assert.equal(canReadBankInProjectes(permissions), false);
});

test('criterion 3: projectes.manage + moviments.read false can manage projects but no bank', () => {
  const permissions = resolveEffectivePermissions({
    role: 'user',
    userOverrides: { deny: ['moviments.read'] },
  });

  assert.equal(permissions['projectes.manage'], true);
  assert.equal(canReadBankInProjectes(permissions), false);
});

test('criterion 4: moviments route depends on section, projects bank does not', () => {
  const permissions = resolveEffectivePermissions({
    role: 'user',
    userOverrides: { deny: ['sections.moviments'] },
  });

  assert.equal(permissions['moviments.read'], true);
  assert.equal(permissions['projectes.manage'], true);
  assert.equal(canAccessMovimentsRoute(permissions), false);
  assert.equal(canReadBankInProjectes(permissions), true);
});

test('never grantable families are filtered from user grants', () => {
  const roleDefaults = getRoleDefaults('user');
  const effective = applyOverrides(roleDefaults, { deny: [] }, ['configuracio.manage', 'membres.manage', 'categories.manage']);

  assert.equal(effective['configuracio.manage'], false);
  assert.equal(effective['membres.manage'], false);
  assert.equal(effective['categories.manage'], false);
});

test('project capability remains mutually exclusive', () => {
  const roleDefaults = getRoleDefaults('admin');
  const effective = applyOverrides(roleDefaults, { deny: [] }, ['projectes.expenseInput']);

  assert.equal(effective['projectes.manage'], true);
  assert.equal(effective['projectes.expenseInput'], false);
});

test('isUserPermissionsCustomized returns false for empty/null inputs', () => {
  assert.equal(isUserPermissionsCustomized(undefined, undefined), false);
  assert.equal(isUserPermissionsCustomized(null, null), false);
  assert.equal(isUserPermissionsCustomized({}, undefined), false);
  assert.equal(isUserPermissionsCustomized({ deny: [] }, []), false);
});

test('isUserPermissionsCustomized returns true with one valid deny', () => {
  assert.equal(isUserPermissionsCustomized({ deny: ['moviments.read'] }, null), true);
});

test('isUserPermissionsCustomized returns true with one valid grant', () => {
  assert.equal(isUserPermissionsCustomized(null, ['moviments.read']), true);
});

test('isUserPermissionsCustomized returns false when deny/grants sanitize to empty', () => {
  assert.equal(isUserPermissionsCustomized({ deny: ['not.a.real.permission'] }, ['configuracio.manage']), false);
});

test('permissionsToCapabilities maps effective role user permissions (granular path)', () => {
  const effective = resolveEffectivePermissions({ role: 'user' });
  const capabilities = permissionsToCapabilities(effective);

  assert.equal(capabilities['moviments.read'], true);
  assert.equal(capabilities['projectes.manage'], true);
  assert.equal(capabilities['fiscal.model182.generar'], true);
});

test('permissionsToCapabilities removes denied permissions', () => {
  const effective = resolveEffectivePermissions({
    role: 'user',
    userOverrides: { deny: ['moviments.read'] },
  });
  const capabilities = permissionsToCapabilities(effective);

  assert.equal(capabilities['moviments.read'], undefined);
});

test('permissionsToCapabilities honors expenseInput mode', () => {
  const effective = resolveEffectivePermissions({
    role: 'user',
    userOverrides: { deny: ['projectes.manage'] },
    userGrants: ['projectes.expenseInput'],
  });
  const capabilities = permissionsToCapabilities(effective);

  assert.equal(capabilities['projectes.manage'], undefined);
  assert.equal(capabilities['projectes.expenseInput'], true);
});

test('none mode disables projects area access', () => {
  const effective = resolveEffectivePermissions({
    role: 'user',
    userOverrides: { deny: ['sections.projectes', 'projectes.manage', 'projectes.expenseInput'] },
  });

  assert.equal(getProjectCapability(effective), 'none');
  assert.equal(canUseProjectModule(effective), false);
  assert.equal(canAccessProjectsArea(effective), false);
  assert.equal(canReadBankInProjectes(effective), false);
});

test('permissionsToCapabilities never includes unknown keys', () => {
  const effective = resolveEffectivePermissions({
    role: 'user',
    userOverrides: { deny: ['not.a.real.permission'] },
    userGrants: ['also.not.real'],
  });
  const capabilities = permissionsToCapabilities(effective);

  assert.equal((capabilities as Record<string, boolean>)['not.a.real.permission'], undefined);
  assert.equal((capabilities as Record<string, boolean>)['also.not.real'], undefined);
});
