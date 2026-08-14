import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';

import {
  getAdminDb,
  validateUserMembership,
  verifyIdToken,
} from '@/lib/api/admin-sdk';
import { requirePermission } from '@/lib/api/require-permission';
import { can } from '@/lib/permissions';
import { resolveServerEntitlement, type EntitlementDbLike } from '@/lib/api/require-entitlement';
import {
  resolveProjectDeletePolicy,
  type ProjectDeletePolicy,
  type ProjectDeleteUsage,
} from '@/lib/project-module/project-lifecycle-policy';

type ProjectLifecycleAction = 'inspectDelete' | 'close' | 'delete';

interface ProjectLifecycleRequest {
  action: ProjectLifecycleAction;
  orgId: string;
  projectId: string;
}

interface ProjectLifecycleResponse {
  success: boolean;
  error?: string;
  code?: string;
  usage?: ProjectDeleteUsage;
  policy?: ProjectDeletePolicy;
}

type ProjectLifecycleRouteDeps = {
  verifyIdTokenFn: typeof verifyIdToken;
  getAdminDbFn: typeof getAdminDb;
  validateUserMembershipFn: typeof validateUserMembership;
  resolveEntitlementFn?: typeof resolveServerEntitlement;
};

const defaultDeps: ProjectLifecycleRouteDeps = {
  verifyIdTokenFn: verifyIdToken,
  getAdminDbFn: getAdminDb,
  validateUserMembershipFn: validateUserMembership,
};

function jsonError(code: string, error: string, status: number) {
  return NextResponse.json<ProjectLifecycleResponse>(
    { success: false, code, error },
    { status }
  );
}

function isValidAction(value: unknown): value is ProjectLifecycleAction {
  return value === 'inspectDelete' || value === 'close' || value === 'delete';
}

async function inspectDeleteSafety(
  db: Firestore,
  orgId: string,
  projectId: string
): Promise<{ usage: ProjectDeleteUsage; policy: ProjectDeletePolicy }> {
  const linksRef = db.collection(`organizations/${orgId}/projectModule/_/expenseLinks`);
  const projectRef = db.doc(`organizations/${orgId}/projectModule/_/projects/${projectId}`);
  const transactionsRef = db.collection(`organizations/${orgId}/transactions`);

  const [assignmentSnap, budgetLineSnap, fxTransferSnap, transactionSnap] = await Promise.all([
    linksRef.where('projectIds', 'array-contains', projectId).limit(2).get(),
    projectRef.collection('budgetLines').limit(2).get(),
    projectRef.collection('fxTransfers').limit(2).get(),
    transactionsRef.where('projectId', '==', projectId).limit(2).get(),
  ]);

  const usage = {
    assignmentCount: assignmentSnap.size,
    budgetLineCount: budgetLineSnap.size,
    fxTransferCount: fxTransferSnap.size,
    transactionCount: transactionSnap.size,
  };

  return {
    usage,
    policy: resolveProjectDeletePolicy(usage),
  };
}

export async function handleProjectLifecyclePost(
  request: NextRequest,
  deps: ProjectLifecycleRouteDeps = defaultDeps
): Promise<NextResponse<ProjectLifecycleResponse>> {
  const authResult = await deps.verifyIdTokenFn(request);
  if (!authResult) {
    return jsonError('UNAUTHORIZED', 'No autenticat', 401);
  }

  let body: ProjectLifecycleRequest;
  try {
    body = await request.json();
  } catch {
    return jsonError('INVALID_BODY', 'Body invàlid', 400);
  }

  const action = body.action;
  const orgId = typeof body.orgId === 'string' ? body.orgId.trim() : '';
  const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';

  if (!isValidAction(action)) {
    return jsonError('INVALID_ACTION', 'Acció invàlida', 400);
  }
  if (!orgId) {
    return jsonError('MISSING_ORG_ID', 'orgId és obligatori', 400);
  }
  if (!projectId) {
    return jsonError('MISSING_PROJECT_ID', 'projectId és obligatori', 400);
  }

  const db = deps.getAdminDbFn();
  const membership = await deps.validateUserMembershipFn(db, authResult.uid, orgId);
  const denied = requirePermission(membership, {
    code: 'PROJECTES_MANAGE_REQUIRED',
    check: (permissions) => can('sections.projectes', permissions) && can('projectes.manage', permissions),
  });
  if (denied) return denied;

  const entitlement = await (deps.resolveEntitlementFn ?? resolveServerEntitlement)({
    db: db as unknown as EntitlementDbLike,
    orgId,
    capability: action === 'inspectDelete' ? 'projects.readHistorical' : 'projects.mutate',
    userAllowed: true,
  });
  if (!entitlement.allowed) {
    return jsonError('ENTITLEMENT_DENIED', 'El pla no permet aquesta operació de projectes.', 403);
  }

  const projectRef = db.doc(`organizations/${orgId}/projectModule/_/projects/${projectId}`);
  const projectSnap = await projectRef.get();
  if (!projectSnap.exists) {
    return jsonError('PROJECT_NOT_FOUND', 'Projecte no trobat', 404);
  }

  if (action === 'close') {
    await projectRef.update({
      status: 'closed',
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  }

  const inspection = await inspectDeleteSafety(db, orgId, projectId);

  if (action === 'inspectDelete') {
    return NextResponse.json({
      success: true,
      usage: inspection.usage,
      policy: inspection.policy,
    });
  }

  if (!inspection.policy.canDelete) {
    return NextResponse.json(
      {
        success: false,
        code: 'PROJECT_HAS_LINKED_DATA',
        error: 'Aquest projecte té dades vinculades i no es pot eliminar.',
        usage: inspection.usage,
        policy: inspection.policy,
      },
      { status: 400 }
    );
  }

  await projectRef.delete();

  return NextResponse.json({
    success: true,
    usage: inspection.usage,
    policy: inspection.policy,
  });
}
