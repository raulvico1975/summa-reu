export interface LoginInviteResolvedInvitation {
  invitationId: string;
  organizationId: string;
  organizationName: string | null;
  email: string;
  role: 'admin' | 'user' | 'viewer';
}

export interface LoginInviteUser {
  email: string | null;
  displayName: string | null;
}

export interface LoginInviteFlowDeps {
  resolveInvitation: () => Promise<
    | { ok: true; invitation: LoginInviteResolvedInvitation }
    | { ok: false; error: string }
  >;
  getIdToken: () => Promise<string>;
  acceptInvitation: (idToken: string, invitation: LoginInviteResolvedInvitation) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
}

export type LoginInviteFlowResult =
  | { ok: true; invitation: LoginInviteResolvedInvitation }
  | { ok: false; error: string };

export async function processLoginInviteFlow(
  deps: LoginInviteFlowDeps,
  input: {
    organizationId: string;
    loginEmail: string;
    user: LoginInviteUser;
  }
): Promise<LoginInviteFlowResult> {
  const resolved = await deps.resolveInvitation();
  if (!resolved.ok) {
    await deps.signOut();
    return { ok: false, error: resolved.error };
  }

  const invitation = resolved.invitation;
  const normalizedUserEmail = (input.user.email || input.loginEmail).toLowerCase();

  if (invitation.organizationId !== input.organizationId) {
    await deps.signOut();
    return { ok: false, error: 'org_mismatch' };
  }

  if (invitation.email.toLowerCase() !== normalizedUserEmail) {
    await deps.signOut();
    return { ok: false, error: 'email_mismatch' };
  }

  const idToken = await deps.getIdToken();
  const acceptResult = await deps.acceptInvitation(idToken, invitation);
  if (!acceptResult.ok) {
    await deps.signOut();
    return { ok: false, error: acceptResult.error || 'accept_failed' };
  }

  return { ok: true, invitation };
}
