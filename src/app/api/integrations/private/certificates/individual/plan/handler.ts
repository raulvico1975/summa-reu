import { NextResponse, type NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/api/admin-sdk';
import { authenticateIntegrationRequest, createFirestoreIntegrationAuthRepository, hashOpaqueValue, recordIntegrationAudit, type IntegrationAuthRepository } from '@/lib/api/integration-auth';
import { createFirestorePrepareDataSource } from '@/lib/private-integrations/firestore-prepare-data-source';
import { prepareIndividualCertificatePlan, type IndividualCertificatePlanStore } from '@/lib/private-integrations/individual-certificate-plan';
import { createFirestoreIndividualCertificatePlanStore } from '@/lib/private-integrations/firestore-individual-certificate';
import type { PrepareEntityDataSource } from '@/lib/private-integrations/prepare-only';

const ROUTE = 'POST /api/integrations/private/certificates/individual/plan';
type RequestLike = Pick<NextRequest, 'headers' | 'json'>;
interface Deps { authRepository?: IntegrationAuthRepository; dataSource?: PrepareEntityDataSource; planStore?: IndividualCertificatePlanStore; now?: Date; planIdFactory?: () => string }
const clean = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

export async function handlePrivateIndividualCertificatePlan(request: RequestLike, deps: Deps = {}) {
  let raw: unknown = null; try { raw = await request.json(); } catch { /* invalid below */ }
  const body = object(raw); const orgId = clean(body.orgId); const transactionId = clean(body.transactionId); const donorId = clean(body.donorId);
  const repository = deps.authRepository ?? createFirestoreIntegrationAuthRepository(getAdminDb());
  const auth = await authenticateIntegrationRequest({ request, orgId, requiredScope: 'certificates.prepare', route: ROUTE, repository });
  const record = (result: 'allowed' | 'unauthorized' | 'org_denied' | 'scope_denied' | 'bad_request' | 'conflict' | 'error', status: number, code: string, planId?: string) => recordIntegrationAudit({
    ...auth.audit, resourceId: planId ?? transactionId ?? null,
    requestKeyHash: transactionId && donorId ? hashOpaqueValue(`${orgId}|${transactionId}|${donorId}|individual`) : null,
    result, status, code,
  }, repository);
  if (!auth.ok) {
    await record(auth.code === 'ORG_NOT_ALLOWED' ? 'org_denied' : auth.code === 'SCOPE_DENIED' ? 'scope_denied' : auth.code === 'MISSING_ORG_ID' ? 'bad_request' : 'unauthorized', auth.status, auth.code);
    return NextResponse.json({ success: false, code: auth.code }, { status: auth.status });
  }
  if (!transactionId || !donorId) { await record('bad_request', 400, 'INVALID_REQUEST'); return NextResponse.json({ success: false, code: 'INVALID_REQUEST' }, { status: 400 }); }
  try {
    const db = deps.dataSource && deps.planStore ? null : getAdminDb();
    const result = await prepareIndividualCertificatePlan({ orgId, tokenId: auth.context.tokenId, transactionId, donorId, now: deps.now, planIdFactory: deps.planIdFactory }, deps.dataSource ?? createFirestorePrepareDataSource(db!), deps.planStore ?? createFirestoreIndividualCertificatePlanStore(db!));
    if (!result.prepared) { await record('conflict', 409, result.code); return NextResponse.json({ success: false, code: result.code, blockers: result.blockers, preparation: result.preparation }, { status: 409 }); }
    const { plan } = result; await record('allowed', 201, 'CERTIFICATE_PLAN_PREPARED', plan.planId);
    return NextResponse.json({ success: true, preparation: result.preparation, plan: {
      planId: plan.planId, kind: 'individual', transactionId, donorId, donorName: plan.donorName,
      amount: plan.amount, movementDate: plan.movementDate, preconditionToken: plan.preconditionToken,
      expiresAt: plan.expiresAt, confirmationText: plan.confirmationText,
    }, effects: { businessDataMutated: false, planPersisted: true, pdfGenerated: false, emailSent: false } }, { status: 201 });
  } catch (error) {
    console.error('[individual certificate plan] error', error); await record('error', 500, 'INTERNAL_ERROR');
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
