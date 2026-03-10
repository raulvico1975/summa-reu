import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, validateUserMembership, verifyIdToken } from '@/lib/api/admin-sdk';
import { validateAndCanonicalizeUserPermissionWrite } from '@/lib/permissions-write';
import type { OrganizationRole } from '@/lib/data';
import {
  generateInvitationToken,
  isInvitationStillActive,
  normalizeInvitationEmail,
} from '@/lib/invitations/utils';

interface CreateInvitationRequest {
  organizationId: string;
  email: string;
  role: string;
  userOverrides?: {
    deny?: string[];
  };
  userGrants?: string[];
}

export interface CreateInvitationResponse {
  success: boolean;
  error?: string;
  token?: string;
  invitationId?: string;
  reused?: boolean;
}

export interface CreateInvitationDeps {
  verifyIdTokenFn: typeof verifyIdToken;
  validateUserMembershipFn: typeof validateUserMembership;
  getAdminDbFn: typeof getAdminDb;
  nowIsoFn: () => string;
}

const DEFAULT_DEPS: CreateInvitationDeps = {
  verifyIdTokenFn: verifyIdToken,
  validateUserMembershipFn: validateUserMembership,
  getAdminDbFn: getAdminDb,
  nowIsoFn: () => new Date().toISOString(),
};

function isOrganizationRole(value: unknown): value is OrganizationRole {
  return value === 'admin' || value === 'user' || value === 'viewer';
}

export async function handleInvitationCreate(
  request: NextRequest,
  deps: CreateInvitationDeps = DEFAULT_DEPS
): Promise<NextResponse<CreateInvitationResponse>> {
  const authResult = await deps.verifyIdTokenFn(request);
  if (!authResult) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
  }

  let body: CreateInvitationRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'invalid_body' }, { status: 400 });
  }

  const { organizationId, email, role } = body;
  if (!organizationId || !email || !role) {
    return NextResponse.json({ success: false, error: 'missing_fields' }, { status: 400 });
  }

  if (!isOrganizationRole(role)) {
    return NextResponse.json({ success: false, error: 'invalid_role' }, { status: 400 });
  }

  try {
    const db = deps.getAdminDbFn();
    const membership = await deps.validateUserMembershipFn(db, authResult.uid, organizationId);
    if (!membership.valid || membership.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 });
    }

    const normalizedEmail = normalizeInvitationEmail(email);
    const orgSnap = await db.doc(`organizations/${organizationId}`).get();
    if (!orgSnap.exists) {
      return NextResponse.json({ success: false, error: 'organization_not_found' }, { status: 404 });
    }

    const existingMemberSnap = await db
      .collection(`organizations/${organizationId}/members`)
      .where('email', '==', normalizedEmail)
      .limit(1)
      .get();

    if (!existingMemberSnap.empty) {
      return NextResponse.json({ success: false, error: 'member_already_exists' }, { status: 409 });
    }

    const existingInvitationsSnap = await db
      .collection('invitations')
      .where('email', '==', normalizedEmail)
      .limit(20)
      .get();

    const activeInvitation = existingInvitationsSnap.docs.find((doc) => {
      const data = doc.data();
      return data.organizationId === organizationId && isInvitationStillActive(data, deps.nowIsoFn());
    });

    if (activeInvitation) {
      const activeData = activeInvitation.data();
      return NextResponse.json({
        success: true,
        reused: true,
        invitationId: activeInvitation.id,
        token: typeof activeData.token === 'string' ? activeData.token : undefined,
      });
    }

    let canonicalDeny: string[] = [];
    let canonicalGrants: string[] = [];
    if (role === 'user') {
      const validation = validateAndCanonicalizeUserPermissionWrite({
        deny: body.userOverrides?.deny,
        grants: body.userGrants,
      });

      if (!validation.ok) {
        return NextResponse.json({ success: false, error: 'invalid_invitation_permissions' }, { status: 400 });
      }

      canonicalDeny = validation.value.deny;
      canonicalGrants = validation.value.grants;
    }

    const invitationRef = db.collection('invitations').doc();
    const expiresAt = new Date(deps.nowIsoFn());
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitationData: Record<string, unknown> = {
      id: invitationRef.id,
      token: generateInvitationToken(),
      organizationId,
      organizationName: orgSnap.data()?.name ?? '',
      role,
      email: normalizedEmail,
      createdAt: deps.nowIsoFn(),
      expiresAt: expiresAt.toISOString(),
      createdBy: authResult.uid,
    };

    if (role === 'user' && canonicalDeny.length > 0) {
      invitationData.userOverrides = { deny: canonicalDeny };
    }
    if (role === 'user' && canonicalGrants.length > 0) {
      invitationData.userGrants = canonicalGrants;
    }

    await invitationRef.set(invitationData);

    return NextResponse.json({
      success: true,
      invitationId: invitationRef.id,
      token: invitationData.token as string,
      reused: false,
    });
  } catch (error) {
    console.error('[invitations/create] Error:', error);
    return NextResponse.json({ success: false, error: 'internal_error' }, { status: 500 });
  }
}
