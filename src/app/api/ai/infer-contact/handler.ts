import { NextRequest, NextResponse } from 'next/server';
import { z } from 'genkit';
import { getAdminDb } from '@/lib/api/admin-sdk';
import { checkRateLimit } from '@/lib/api/rate-limit';
import { requireOrgMembership } from '@/lib/api/request-guards';
import { getMembershipPermissions } from '@/lib/api/require-permission';
import { resolveServerEntitlement, type EntitlementDbLike } from '@/lib/api/require-entitlement';

const RequestSchema = z.object({
  orgId: z.string().min(1).max(160),
  description: z.string().max(1000),
  contacts: z.array(z.object({
    id: z.string().min(1).max(160),
    name: z.string().min(1).max(160),
  })).max(500),
});

type InferContactInput = Omit<z.infer<typeof RequestSchema>, 'orgId'>;
type InferContactOutput = { contactId: string | null; confidence: number };

export interface InferContactRouteDeps {
  requireOrgMembershipFn?: typeof requireOrgMembership;
  getAdminDbFn?: typeof getAdminDb;
  resolveEntitlementFn?: typeof resolveServerEntitlement;
  checkRateLimitFn?: typeof checkRateLimit;
  inferContactFn: (input: InferContactInput) => Promise<InferContactOutput>;
}

export async function handleInferContactPost(
  request: NextRequest,
  deps: InferContactRouteDeps
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: 'INVALID_INPUT' }, { status: 400 });
  }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: 'INVALID_INPUT' }, { status: 400 });
  }
  const { orgId, ...input } = parsed.data;
  const guard = await (deps.requireOrgMembershipFn ?? requireOrgMembership)(request, orgId);
  if (!guard.ok) {
    return NextResponse.json({ ok: false, code: guard.code }, { status: guard.status });
  }
  const permissions = getMembershipPermissions(guard.membership);
  const entitlement = await (deps.resolveEntitlementFn ?? resolveServerEntitlement)({
    db: (deps.getAdminDbFn ?? getAdminDb)() as unknown as EntitlementDbLike,
    orgId,
    capability: 'aiCategorization.execute',
    userAllowed: permissions['moviments.editar'] === true,
  });
  if (!entitlement.allowed) {
    return NextResponse.json({ ok: false, code: 'FORBIDDEN' }, { status: 403 });
  }
  const rateLimit = (deps.checkRateLimitFn ?? checkRateLimit)({
    key: `ai:infer-contact:${guard.auth.uid}:${orgId}`,
    limit: 60,
    windowMs: 60_000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json({ ok: false, code: 'RATE_LIMITED' }, { status: 429 });
  }
  const result = await deps.inferContactFn(input);
  return NextResponse.json({ ok: true, ...result });
}
