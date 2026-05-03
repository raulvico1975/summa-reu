import { type NextRequest } from 'next/server';
import {
  getAdminDb,
  isSuperAdmin,
  validateUserMembership,
  verifyIdToken,
  type AuthResult,
  type MembershipValidation,
} from '@/lib/api/admin-sdk';

export type ApiGuardCode = 'UNAUTHORIZED' | 'FORBIDDEN' | 'INVALID_INPUT';

export type ApiGuardFailure = {
  ok: false;
  status: 400 | 401 | 403;
  code: ApiGuardCode;
  message: string;
};

export type ApiGuardSuccess<T extends Record<string, unknown>> = {
  ok: true;
} & T;

export type ApiGuardResult<T extends Record<string, unknown>> =
  | ApiGuardSuccess<T>
  | ApiGuardFailure;

export async function requireAuthenticatedRequest(
  request: NextRequest
): Promise<ApiGuardResult<{ auth: AuthResult }>> {
  const auth = await verifyIdToken(request);
  if (!auth) {
    return {
      ok: false,
      status: 401,
      code: 'UNAUTHORIZED',
      message: 'Sessió no vàlida. Torna a iniciar sessió.',
    };
  }

  return { ok: true, auth };
}

export async function requireOrgMembership(
  request: NextRequest,
  orgId: unknown
): Promise<ApiGuardResult<{ auth: AuthResult; membership: MembershipValidation; orgId: string }>> {
  const authGuard = await requireAuthenticatedRequest(request);
  if (!authGuard.ok) return authGuard;

  if (typeof orgId !== 'string' || !orgId.trim()) {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_INPUT',
      message: 'orgId és obligatori.',
    };
  }

  const db = getAdminDb();
  const membership = await validateUserMembership(db, authGuard.auth.uid, orgId);
  if (!membership.valid) {
    return {
      ok: false,
      status: 403,
      code: 'FORBIDDEN',
      message: 'No tens permisos per aquesta organització.',
    };
  }

  return { ok: true, auth: authGuard.auth, membership, orgId };
}

export async function requireSuperAdminRequest(
  request: NextRequest
): Promise<ApiGuardResult<{ auth: AuthResult }>> {
  const authGuard = await requireAuthenticatedRequest(request);
  if (!authGuard.ok) return authGuard;

  const superOk = await isSuperAdmin(authGuard.auth.uid);
  if (!superOk) {
    return {
      ok: false,
      status: 403,
      code: 'FORBIDDEN',
      message: 'Aquesta acció requereix permisos de SuperAdmin.',
    };
  }

  return { ok: true, auth: authGuard.auth };
}
