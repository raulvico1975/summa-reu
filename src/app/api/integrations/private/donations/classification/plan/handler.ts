import { NextResponse, type NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/api/admin-sdk';
import {
  authenticateIntegrationRequest,
  createFirestoreIntegrationAuthRepository,
  hashOpaqueValue,
  recordIntegrationAudit,
  type IntegrationAuthRepository,
} from '@/lib/api/integration-auth';
import { createFirestorePrepareDataSource } from '@/lib/private-integrations/firestore-prepare-data-source';
import {
  prepareDonationClassificationPlan,
  type DonationClassificationPlanStore,
} from '@/lib/private-integrations/donation-classification-plan';
import { createFirestoreDonationClassificationPlanStore } from '@/lib/private-integrations/firestore-donation-classification';
import type { PrepareEntityDataSource } from '@/lib/private-integrations/prepare-only';

const ROUTE = 'POST /api/integrations/private/donations/classification/plan';
type RequestLike = Pick<NextRequest, 'headers' | 'json'>;
interface Deps {
  authRepository?: IntegrationAuthRepository;
  dataSource?: PrepareEntityDataSource;
  planStore?: DonationClassificationPlanStore;
  now?: Date;
  planIdFactory?: () => string;
}
function clean(value: unknown) { return typeof value === 'string' ? value.trim() : ''; }
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export async function handlePrivateDonationClassificationPlan(request: RequestLike, deps: Deps = {}) {
  let raw: unknown = null;
  try { raw = await request.json(); } catch { /* invalid below */ }
  const body = object(raw);
  const orgId = clean(body.orgId);
  const transactionId = clean(body.transactionId);
  const donorId = clean(body.donorId);
  const repository = deps.authRepository ?? createFirestoreIntegrationAuthRepository(getAdminDb());
  const auth = await authenticateIntegrationRequest({
    request, orgId, requiredScope: 'donation_classification.prepare', route: ROUTE, repository,
  });
  const record = (result: 'allowed' | 'unauthorized' | 'org_denied' | 'scope_denied' | 'bad_request' | 'conflict' | 'error', status: number, code: string, planId?: string) =>
    recordIntegrationAudit({
      ...auth.audit,
      resourceId: planId ?? transactionId ?? null,
      requestKeyHash: transactionId && donorId ? hashOpaqueValue(`${orgId}|${transactionId}|${donorId}`) : null,
      result, status, code,
    }, repository);
  if (!auth.ok) {
    await record(auth.code === 'ORG_NOT_ALLOWED' ? 'org_denied' : auth.code === 'SCOPE_DENIED' ? 'scope_denied' : auth.code === 'MISSING_ORG_ID' ? 'bad_request' : 'unauthorized', auth.status, auth.code);
    return NextResponse.json({ success: false, code: auth.code }, { status: auth.status });
  }
  if (!transactionId || !donorId) {
    await record('bad_request', 400, 'INVALID_REQUEST');
    return NextResponse.json({ success: false, code: 'INVALID_REQUEST' }, { status: 400 });
  }
  try {
    const db = deps.dataSource && deps.planStore ? null : getAdminDb();
    const result = await prepareDonationClassificationPlan({
      orgId, tokenId: auth.context.tokenId, transactionId, donorId,
      now: deps.now, planIdFactory: deps.planIdFactory,
    }, deps.dataSource ?? createFirestorePrepareDataSource(db!), deps.planStore ?? createFirestoreDonationClassificationPlanStore(db!));
    if (!result.prepared) {
      await record('conflict', 409, result.code);
      return NextResponse.json({ success: false, code: result.code, blockers: result.blockers }, { status: 409 });
    }
    const plan = result.plan;
    await record('allowed', 201, 'PLAN_PREPARED', plan.planId);
    return NextResponse.json({
      success: true,
      plan: {
        planId: plan.planId,
        transactionId: plan.transactionId,
        donor: { id: plan.donorId, name: plan.donorName },
        amount: plan.amount,
        proposedPatch: plan.proposedPatch,
        preconditionToken: plan.preconditionToken,
        expiresAt: plan.expiresAt,
        confirmationText: plan.confirmationText,
      },
      effects: { businessDataMutated: false, planPersisted: true, classified: false },
    }, { status: 201 });
  } catch (error) {
    console.error('[donation classification plan] error', error);
    await record('error', 500, 'INTERNAL_ERROR');
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
