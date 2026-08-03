import { NextResponse, type NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/api/admin-sdk';
import {
  authenticateIntegrationRequest,
  createFirestoreIntegrationAuthRepository,
  hashOpaqueValue,
  recordIntegrationAudit,
  type IntegrationAuthRepository,
} from '@/lib/api/integration-auth';
import {
  applyDonationClassificationPlan,
  type DonationClassificationAtomicExecutor,
  type DonationClassificationPlanStore,
} from '@/lib/private-integrations/donation-classification-plan';
import {
  createFirestoreDonationClassificationExecutor,
  createFirestoreDonationClassificationPlanStore,
} from '@/lib/private-integrations/firestore-donation-classification';

const ROUTE = 'POST /api/integrations/private/donations/classification/apply';
type RequestLike = Pick<NextRequest, 'headers' | 'json'>;
interface Deps {
  authRepository?: IntegrationAuthRepository;
  planStore?: DonationClassificationPlanStore;
  executor?: DonationClassificationAtomicExecutor;
  now?: Date;
}
function clean(value: unknown) { return typeof value === 'string' ? value.trim() : ''; }
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export async function handlePrivateDonationClassificationApply(request: RequestLike, deps: Deps = {}) {
  let raw: unknown = null;
  try { raw = await request.json(); } catch { /* invalid below */ }
  const body = object(raw);
  const orgId = clean(body.orgId);
  const repository = deps.authRepository ?? createFirestoreIntegrationAuthRepository(getAdminDb());
  const auth = await authenticateIntegrationRequest({
    request, orgId, requiredScope: 'donation_classification.apply', route: ROUTE, repository,
  });
  if (!auth.ok) {
    await recordIntegrationAudit({
      ...auth.audit,
      result: auth.code === 'ORG_NOT_ALLOWED' ? 'org_denied' : auth.code === 'SCOPE_DENIED' ? 'scope_denied' : auth.code === 'MISSING_ORG_ID' ? 'bad_request' : 'unauthorized',
      status: auth.status, code: auth.code,
    }, repository);
    return NextResponse.json({ success: false, code: auth.code }, { status: auth.status });
  }
  const input = {
    planId: clean(body.planId), orgId, tokenId: auth.context.tokenId,
    transactionId: clean(body.transactionId), donorId: clean(body.donorId),
    preconditionToken: clean(body.preconditionToken),
    confirmationText: typeof body.confirmationText === 'string' ? body.confirmationText : '',
    humanConfirmed: body.humanConfirmed === true,
    now: (deps.now ?? new Date()).toISOString(),
  };
  if (!input.planId || !input.transactionId || !input.donorId || !input.preconditionToken) {
    await recordIntegrationAudit({ ...auth.audit, result: 'bad_request', status: 400, code: 'INVALID_REQUEST' }, repository);
    return NextResponse.json({ success: false, code: 'INVALID_REQUEST' }, { status: 400 });
  }
  const requestKeyHash = hashOpaqueValue(`${input.planId}|${input.transactionId}|${input.donorId}|${input.preconditionToken}`);
  const db = deps.planStore && deps.executor ? null : getAdminDb();
  const store = deps.planStore ?? createFirestoreDonationClassificationPlanStore(db!);
  try {
    const result = await applyDonationClassificationPlan(
      input,
      store,
      deps.executor ?? createFirestoreDonationClassificationExecutor(db!)
    );
    if (!result.applied) {
      const status = result.code === 'PLAN_NOT_FOUND' ? 404 : result.code === 'HUMAN_CONFIRMATION_REQUIRED' ? 400 : 409;
      await recordIntegrationAudit({ ...auth.audit, resourceId: input.planId, requestKeyHash, result: 'conflict', status, code: result.code }, repository);
      return NextResponse.json({ success: false, code: result.code }, { status });
    }
    await recordIntegrationAudit({ ...auth.audit, resourceId: input.planId, requestKeyHash, result: 'allowed', status: 200, code: 'CLASSIFICATION_APPLIED' }, repository);
    return NextResponse.json({
      success: true, applied: true, planId: input.planId,
      transactionId: input.transactionId, donorId: input.donorId,
      before: result.before, after: result.after,
      effects: { businessDataMutated: true, classified: true, fieldsWritten: ['contactId', 'contactType', 'transactionType', 'fiscalKind'] },
    });
  } catch (error) {
    console.error('[donation classification apply] error', error);
    await store.block({ planId: input.planId, now: input.now, reason: 'INTERNAL_ERROR' }).catch(() => undefined);
    await recordIntegrationAudit({ ...auth.audit, resourceId: input.planId, requestKeyHash, result: 'error', status: 500, code: 'INTERNAL_ERROR' }, repository);
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
