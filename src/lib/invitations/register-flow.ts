export interface RegisterInvitationUser {
  uid: string;
}

export interface RegisterInvitationFlowDeps<TUser extends RegisterInvitationUser> {
  createUser: (email: string, password: string) => Promise<TUser>;
  updateProfile: (user: TUser, displayName: string) => Promise<void>;
  getIdToken: (user: TUser, forceRefresh?: boolean) => Promise<string>;
  acceptInvitation: (idToken: string) => Promise<{ ok: boolean; error?: string }>;
  deleteUser: (user: TUser) => Promise<void>;
  signOut: () => Promise<void>;
}

export type RegisterInvitationFlowResult<TUser extends RegisterInvitationUser> =
  | { ok: true; user: TUser }
  | { ok: false; error: string; cleanup: 'deleted' | 'signed_out' | 'failed' };

function normalizeErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    return error.code;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'unknown_error';
}

export async function registerWithInvitationFlow<TUser extends RegisterInvitationUser>(
  deps: RegisterInvitationFlowDeps<TUser>,
  input: {
    email: string;
    password: string;
    displayName: string;
  }
): Promise<RegisterInvitationFlowResult<TUser>> {
  let createdUser: TUser | null = null;

  try {
    createdUser = await deps.createUser(input.email, input.password);
    await deps.updateProfile(createdUser, input.displayName);
    const idToken = await deps.getIdToken(createdUser, true);
    const acceptResult = await deps.acceptInvitation(idToken);

    if (!acceptResult.ok) {
      throw { code: acceptResult.error || 'accept_failed' };
    }

    return { ok: true, user: createdUser };
  } catch (error) {
    if (!createdUser) {
      throw error;
    }

    try {
      await deps.deleteUser(createdUser);
      return { ok: false, error: normalizeErrorCode(error), cleanup: 'deleted' };
    } catch {
      try {
        await deps.signOut();
        return { ok: false, error: normalizeErrorCode(error), cleanup: 'signed_out' };
      } catch {
        return { ok: false, error: normalizeErrorCode(error), cleanup: 'failed' };
      }
    }
  }
}
