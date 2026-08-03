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
  prepareIndividualDonationCertificate,
  type PrepareEntityDataSource,
} from '@/lib/private-integrations/prepare-only';

const ROUTE_PATH = '/api/integrations/private/certificates/individual/prepare';
type RequestLike = Pick<NextRequest, 'headers' | 'json'>;

interface CertificatePrepareDeps {
  authRepository?: IntegrationAuthRepository;
  dataSource?: PrepareEntityDataSource;
}

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export async function handlePrivateIndividualCertificatePrepare(
  request: RequestLike,
  deps: CertificatePrepareDeps = {}
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const source = isObject(body) ? body : {};
  const orgId = cleanString(source.orgId);
  const transactionId = cleanString(source.transactionId);
  const donorId = cleanString(source.donorId);
  const useProposedClassification = source.useProposedClassification === true;
  const authRepository = deps.authRepository
    ?? createFirestoreIntegrationAuthRepository(getAdminDb());
  const auth = await authenticateIntegrationRequest({
    request,
    orgId,
    requiredScope: 'certificates.prepare',
    route: `POST ${ROUTE_PATH}`,
    repository: authRepository,
  });

  const record = async (
    result: 'allowed' | 'unauthorized' | 'org_denied' | 'scope_denied' | 'bad_request' | 'error',
    status: number,
    code: string
  ) => recordIntegrationAudit({
    ...auth.audit,
    ...(transactionId ? { resourceId: transactionId } : {}),
    ...(transactionId && donorId
      ? { requestKeyHash: hashOpaqueValue(`${orgId}|${transactionId}|${donorId}|${useProposedClassification}`) }
      : {}),
    result,
    status,
    code,
  }, authRepository);

  if (!auth.ok) {
    await record(
      auth.code === 'ORG_NOT_ALLOWED' ? 'org_denied'
        : auth.code === 'SCOPE_DENIED' ? 'scope_denied'
          : auth.code === 'MISSING_ORG_ID' ? 'bad_request'
            : 'unauthorized',
      auth.status,
      auth.code
    );
    return NextResponse.json({ success: false, code: auth.code }, { status: auth.status });
  }
  if (!transactionId || !donorId) {
    await record('bad_request', 400, 'INVALID_REQUEST');
    return NextResponse.json({ success: false, code: 'INVALID_REQUEST' }, { status: 400 });
  }

  try {
    const preparation = await prepareIndividualDonationCertificate(
      { orgId, transactionId, donorId, useProposedClassification },
      deps.dataSource ?? createFirestorePrepareDataSource(getAdminDb())
    );
    await record('allowed', 200, 'OK');
    return NextResponse.json({ success: true, preparation });
  } catch (error) {
    console.error('[private individual certificate prepare] error', error);
    await record('error', 500, 'INTERNAL_ERROR');
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
