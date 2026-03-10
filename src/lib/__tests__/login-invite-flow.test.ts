import test from 'node:test';
import assert from 'node:assert/strict';
import { processLoginInviteFlow } from '@/lib/invitations/login-invite-flow';

test('processLoginInviteFlow signs out and fails when invitation accept fails', async () => {
  const calls: string[] = [];

  const result = await processLoginInviteFlow(
    {
      resolveInvitation: async () => ({
        ok: true,
        invitation: {
          invitationId: 'inv-1',
          organizationId: 'org-1',
          organizationName: 'Org 1',
          email: 'user@test.com',
          role: 'user' as const,
        },
      }),
      getIdToken: async () => {
        calls.push('getIdToken');
        return 'token';
      },
      acceptInvitation: async () => {
        calls.push('acceptInvitation');
        return { ok: false, error: 'already_member' };
      },
      signOut: async () => {
        calls.push('signOut');
      },
    },
    {
      organizationId: 'org-1',
      loginEmail: 'user@test.com',
      user: {
        email: 'user@test.com',
        displayName: 'User',
      },
    }
  );

  assert.deepEqual(calls, ['getIdToken', 'acceptInvitation', 'signOut']);
  assert.deepEqual(result, { ok: false, error: 'already_member' });
});

test('processLoginInviteFlow succeeds for valid invitation', async () => {
  const result = await processLoginInviteFlow(
    {
      resolveInvitation: async () => ({
        ok: true,
        invitation: {
          invitationId: 'inv-2',
          organizationId: 'org-2',
          organizationName: 'Org 2',
          email: 'valid@test.com',
          role: 'admin' as const,
        },
      }),
      getIdToken: async () => 'token',
      acceptInvitation: async () => ({ ok: true }),
      signOut: async () => undefined,
    },
    {
      organizationId: 'org-2',
      loginEmail: 'valid@test.com',
      user: {
        email: 'valid@test.com',
        displayName: 'Valid User',
      },
    }
  );

  assert.equal(result.ok, true);
});
