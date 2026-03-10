import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAdminDb, verifyIdToken } from '@/lib/api/admin-sdk';
import {
  ROLE_DEFAULT_CAPABILITIES,
  permissionsToCapabilities,
  resolveEffectivePermissions,
} from '@/lib/permissions';
import { validateAndCanonicalizeUserPermissionWrite } from '@/lib/permissions-write';
import type { OrganizationRole } from '@/lib/data';

interface AcceptRequest {
  invitationId: string;
  organizationId: string;
  displayName: string;
  email: string;
  role: string;
}

export interface AcceptResponse {
  success: boolean;
  error?: string;
}

export interface AcceptInvitationDeps {
  verifyIdTokenFn: typeof verifyIdToken;
  getAdminDbFn: typeof getAdminDb;
  nowIsoFn: () => string;
}

const DEFAULT_DEPS: AcceptInvitationDeps = {
  verifyIdTokenFn: verifyIdToken,
  getAdminDbFn: getAdminDb,
  nowIsoFn: () => new Date().toISOString(),
};

function isOrganizationRole(value: unknown): value is OrganizationRole {
  return value === 'admin' || value === 'user' || value === 'viewer';
}

function defaultCapabilitiesForRole(role: OrganizationRole): Record<string, boolean> {
  if (role === 'admin') return {};
  return ROLE_DEFAULT_CAPABILITIES[role] ?? { 'moviments.read': true };
}

function hasOwn(obj: unknown, key: string): boolean {
  return !!obj && typeof obj === 'object' && Object.prototype.hasOwnProperty.call(obj, key);
}

function toMillisIfValid(raw: unknown): number | null {
  if (raw instanceof Timestamp) return raw.toMillis();
  if (raw instanceof Date) {
    const millis = raw.getTime();
    return Number.isFinite(millis) ? millis : null;
  }
  if (typeof raw === 'string') {
    const millis = Date.parse(raw);
    return Number.isNaN(millis) ? null : millis;
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  return null;
}

export async function handleInvitationAccept(
  request: NextRequest,
  deps: AcceptInvitationDeps = DEFAULT_DEPS
): Promise<NextResponse<AcceptResponse>> {
  const authResult = await deps.verifyIdTokenFn(request);
  if (!authResult) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
  }

  let body: AcceptRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'invalid_body' }, { status: 400 });
  }

  const { invitationId, organizationId, displayName, email, role } = body;

  if (!invitationId || !organizationId || !displayName || !email || !role) {
    return NextResponse.json({ success: false, error: 'missing_fields' }, { status: 400 });
  }

  try {
    const db = deps.getAdminDbFn();
    const invitationRef = db.doc(`invitations/${invitationId}`);
    const invitationSnap = await invitationRef.get();

    if (!invitationSnap.exists) {
      return NextResponse.json({ success: false, error: 'invitation_not_found' }, { status: 404 });
    }

    const invData = invitationSnap.data()!;

    if (invData.usedAt) {
      return NextResponse.json({ success: false, error: 'already_used' }, { status: 410 });
    }

    if (invData.expiresAt !== undefined && invData.expiresAt !== null) {
      const nowMillis = Date.parse(deps.nowIsoFn());
      const expiresAtMillis = toMillisIfValid(invData.expiresAt);
      if (!Number.isNaN(nowMillis) && expiresAtMillis !== null && nowMillis > expiresAtMillis) {
        return NextResponse.json({ success: false, error: 'invitation_expired' }, { status: 410 });
      }
    }

    if (invData.organizationId !== organizationId) {
      return NextResponse.json({ success: false, error: 'org_mismatch' }, { status: 403 });
    }

    if (invData.email?.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json({ success: false, error: 'email_mismatch' }, { status: 403 });
    }

    const invitationRole: OrganizationRole = isOrganizationRole(invData.role) ? invData.role : 'user';
    const isUserGranularInvitation = invitationRole === 'user'
      && (hasOwn(invData, 'userOverrides') || hasOwn(invData, 'userGrants'));

    let canonicalDeny: string[] = [];
    let canonicalGrants: string[] = [];

    if (isUserGranularInvitation) {
      const rawUserOverrides = hasOwn(invData, 'userOverrides')
        ? invData.userOverrides as { deny?: unknown }
        : null;
      const rawUserGrants = hasOwn(invData, 'userGrants') ? invData.userGrants as unknown : null;

      const validation = validateAndCanonicalizeUserPermissionWrite({
        deny: (rawUserOverrides?.deny ?? []) as string[] | null | undefined,
        grants: (rawUserGrants ?? []) as string[] | null | undefined,
      });

      if (!validation.ok) {
        return NextResponse.json({ success: false, error: 'invalid_invitation_permissions' }, { status: 400 });
      }

      canonicalDeny = validation.value.deny;
      canonicalGrants = validation.value.grants;
    }

    if (!isOrganizationRole(role) || invitationRole !== role) {
      return NextResponse.json({ success: false, error: 'role_mismatch' }, { status: 403 });
    }

    const batch = db.batch();
    const memberRef = db.doc(`organizations/${organizationId}/members/${authResult.uid}`);
    const memberSnap = await memberRef.get();
    if (memberSnap.exists) {
      return NextResponse.json({ success: false, error: 'already_member' }, { status: 409 });
    }

    const memberPayload: Record<string, unknown> = {
      userId: authResult.uid,
      email,
      displayName,
      role: invitationRole,
      joinedAt: deps.nowIsoFn(),
      invitationId,
    };

    if (isUserGranularInvitation) {
      const effectivePermissions = resolveEffectivePermissions({
        role: invitationRole,
        userOverrides: canonicalDeny.length > 0 ? { deny: canonicalDeny } : null,
        userGrants: canonicalGrants.length > 0 ? canonicalGrants : null,
      });
      memberPayload.capabilities = permissionsToCapabilities(effectivePermissions);
      if (canonicalDeny.length > 0) {
        memberPayload.userOverrides = { deny: canonicalDeny };
      }
      if (canonicalGrants.length > 0) {
        memberPayload.userGrants = canonicalGrants;
      }
    } else {
      memberPayload.capabilities = defaultCapabilitiesForRole(invitationRole);
    }

    batch.set(memberRef, memberPayload);

    const userRef = db.doc(`users/${authResult.uid}`);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      batch.set(userRef, {
        organizationId,
        role: invitationRole,
        displayName,
        email,
      });
    }

    batch.update(invitationRef, {
      usedAt: FieldValue.serverTimestamp(),
      usedBy: authResult.uid,
    });

    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[invitations/accept] Error:', error);
    return NextResponse.json({ success: false, error: 'internal_error' }, { status: 500 });
  }
}
