import test from 'node:test';
import assert from 'node:assert/strict';
import { registerWithInvitationFlow } from '@/lib/invitations/register-flow';

test('registerWithInvitationFlow deletes newly created user when invitation accept fails', async () => {
  const calls: string[] = [];
  const user = { uid: 'uid-new' };

  const result = await registerWithInvitationFlow(
    {
      createUser: async () => {
        calls.push('createUser');
        return user;
      },
      updateProfile: async () => {
        calls.push('updateProfile');
      },
      getIdToken: async () => {
        calls.push('getIdToken');
        return 'token-1';
      },
      acceptInvitation: async () => {
        calls.push('acceptInvitation');
        return { ok: false, error: 'already_member' };
      },
      deleteUser: async () => {
        calls.push('deleteUser');
      },
      signOut: async () => {
        calls.push('signOut');
      },
    },
    {
      email: 'user@test.com',
      password: 'secret123',
      displayName: 'User Test',
    }
  );

  assert.deepEqual(calls, ['createUser', 'updateProfile', 'getIdToken', 'acceptInvitation', 'deleteUser']);
  assert.deepEqual(result, {
    ok: false,
    error: 'already_member',
    cleanup: 'deleted',
  });
});

test('registerWithInvitationFlow signs out when cleanup delete fails', async () => {
  const calls: string[] = [];
  const user = { uid: 'uid-new' };

  const result = await registerWithInvitationFlow(
    {
      createUser: async () => user,
      updateProfile: async () => undefined,
      getIdToken: async () => 'token-1',
      acceptInvitation: async () => ({ ok: false, error: 'accept_failed' }),
      deleteUser: async () => {
        calls.push('deleteUser');
        throw new Error('delete failed');
      },
      signOut: async () => {
        calls.push('signOut');
      },
    },
    {
      email: 'user@test.com',
      password: 'secret123',
      displayName: 'User Test',
    }
  );

  assert.deepEqual(calls, ['deleteUser', 'signOut']);
  assert.deepEqual(result, {
    ok: false,
    error: 'accept_failed',
    cleanup: 'signed_out',
  });
});
