import { NextResponse, type NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/api/admin-sdk';
import { authenticateIntegrationRequest, createFirestoreIntegrationAuthRepository, hashOpaqueValue, recordIntegrationAudit, type IntegrationAuthRepository } from '@/lib/api/integration-auth';
import { generateIndividualCertificatePlan, type IndividualCertificateGenerator, type IndividualCertificatePlanStore } from '@/lib/private-integrations/individual-certificate-plan';
import { createFirestoreIndividualCertificateGenerator, createFirestoreIndividualCertificatePlanStore } from '@/lib/private-integrations/firestore-individual-certificate';

const ROUTE = 'POST /api/integrations/private/certificates/individual/generate';
type RequestLike = Pick<NextRequest, 'headers' | 'json'>;
interface Deps { authRepository?: IntegrationAuthRepository; planStore?: IndividualCertificatePlanStore; generator?: IndividualCertificateGenerator; now?: Date }
const clean = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

export async function handlePrivateIndividualCertificateGenerate(request: RequestLike, deps: Deps = {}) {
  let raw: unknown = null; try { raw = await request.json(); } catch { /* invalid below */ }
  const body = object(raw); const orgId = clean(body.orgId);
  const repository = deps.authRepository ?? createFirestoreIntegrationAuthRepository(getAdminDb());
  const auth = await authenticateIntegrationRequest({ request, orgId, requiredScope: 'certificates.generate', route: ROUTE, repository });
  if (!auth.ok) {
    await recordIntegrationAudit({ ...auth.audit, result: auth.code === 'ORG_NOT_ALLOWED' ? 'org_denied' : auth.code === 'SCOPE_DENIED' ? 'scope_denied' : auth.code === 'MISSING_ORG_ID' ? 'bad_request' : 'unauthorized', status: auth.status, code: auth.code }, repository);
    return NextResponse.json({ success: false, code: auth.code }, { status: auth.status });
  }
  const input = {
    planId: clean(body.planId), orgId, tokenId: auth.context.tokenId, transactionId: clean(body.transactionId), donorId: clean(body.donorId),
    preconditionToken: clean(body.preconditionToken), confirmationText: typeof body.confirmationText === 'string' ? body.confirmationText : '',
    humanConfirmed: body.humanConfirmed === true, now: (deps.now ?? new Date()).toISOString(),
  };
  if (!input.planId || !input.transactionId || !input.donorId || !input.preconditionToken) {
    await recordIntegrationAudit({ ...auth.audit, result: 'bad_request', status: 400, code: 'INVALID_REQUEST' }, repository);
    return NextResponse.json({ success: false, code: 'INVALID_REQUEST' }, { status: 400 });
  }
  const requestKeyHash = hashOpaqueValue(`${input.planId}|${input.transactionId}|${input.donorId}|${input.preconditionToken}`);
  const db = deps.planStore && deps.generator ? null : getAdminDb();
  const store = deps.planStore ?? createFirestoreIndividualCertificatePlanStore(db!);
  try {
    const result = await generateIndividualCertificatePlan(input, store, deps.generator ?? createFirestoreIndividualCertificateGenerator(db!));
    if (!result.generated) {
      const status = result.code === 'PLAN_NOT_FOUND' ? 404 : result.code === 'HUMAN_CONFIRMATION_REQUIRED' ? 400 : 409;
      await recordIntegrationAudit({ ...auth.audit, resourceId: input.planId, requestKeyHash, result: 'conflict', status, code: result.code }, repository);
      return NextResponse.json({ success: false, code: result.code }, { status });
    }
    await recordIntegrationAudit({ ...auth.audit, resourceId: input.planId, requestKeyHash, result: 'allowed', status: 200, code: `CERTIFICATE_GENERATED_${result.pdfSha256.slice(0, 12)}` }, repository);
    return NextResponse.json({ success: true, generated: true, planId: input.planId, transactionId: input.transactionId, donorId: input.donorId,
      filename: result.filename, pdfBase64: result.pdfBase64, pdfSha256: result.pdfSha256, pdfSizeBytes: result.pdfSizeBytes, warnings: result.warnings,
      effects: { businessDataMutated: false, pdfGenerated: true, certificateStored: false, emailSent: false } });
  } catch (error) {
    console.error('[individual certificate generate] error', error);
    await store.block({ planId: input.planId, now: input.now, reason: 'INTERNAL_ERROR' }).catch(() => undefined);
    await recordIntegrationAudit({ ...auth.audit, resourceId: input.planId, requestKeyHash, result: 'error', status: 500, code: 'INTERNAL_ERROR' }, repository);
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
