import { NextResponse, type NextRequest } from 'next/server';
import { createHash } from 'node:crypto';
import { getAdminDb, isSuperAdmin, verifyIdToken } from '@/lib/api/admin-sdk';
import { ENTITLEMENTS_CATALOG_VERSION, catalogEntitlementsFor, catalogFingerprintFor } from '@/lib/entitlements/catalog';
import { normalizePlanId } from '@/lib/entitlements/normalize-plan';
import type { CanonicalPlanId, SubscriptionStatus } from '@/lib/entitlements/types';

type RequestLike = Pick<NextRequest, 'json' | 'headers'>;

interface SubscriptionUpdateInput {
  orgId: string;
  planId: string;
  status: SubscriptionStatus;
  reason: string;
  idempotencyKey: string;
  billingMonthlyAmount: number | null;
  billingImplantationAmount: number | null;
  billingContactEmail: string | null;
  billingStartedAt: string | null;
  billingNotes: string | null;
}

interface HandlerDeps {
  verifyIdTokenFn?: typeof verifyIdToken;
  isSuperAdminFn?: typeof isSuperAdmin;
  db?: FirebaseFirestore.Firestore;
  now?: () => Date;
}

const VALID_STATUSES = new Set<SubscriptionStatus>(['trial', 'active', 'past_due', 'cancelled']);
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const ORG_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

function legacyPlanFor(planId: CanonicalPlanId): 'initial' | 'management' | 'fiscal_documents' {
  if (planId === 'control') return 'initial';
  if (planId === 'complete') return 'fiscal_documents';
  return 'management';
}

function nullableString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') throw new Error('INVALID_STRING_FIELD');
  const normalized = value.trim();
  if (normalized.length > 4000) throw new Error('STRING_TOO_LONG');
  return normalized || null;
}

function nullableAmount(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error('INVALID_AMOUNT_FIELD');
  return value;
}

export function parseSubscriptionUpdateInput(raw: unknown): SubscriptionUpdateInput | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const data = raw as Record<string, unknown>;
  const planId = normalizePlanId(data.planId);
  if (!planId || typeof data.orgId !== 'string' || !ORG_ID_PATTERN.test(data.orgId.trim())) return null;
  if (typeof data.status !== 'string' || !VALID_STATUSES.has(data.status as SubscriptionStatus)) return null;
  if (typeof data.reason !== 'string' || data.reason.trim().length < 3 || data.reason.trim().length > 500) return null;
  if (typeof data.idempotencyKey !== 'string' || !IDEMPOTENCY_KEY_PATTERN.test(data.idempotencyKey)) return null;
  try {
    return {
      orgId: data.orgId.trim(),
      planId,
      status: data.status as SubscriptionStatus,
      reason: data.reason.trim(),
      idempotencyKey: data.idempotencyKey,
      billingMonthlyAmount: nullableAmount(data.billingMonthlyAmount),
      billingImplantationAmount: nullableAmount(data.billingImplantationAmount),
      billingContactEmail: nullableString(data.billingContactEmail),
      billingStartedAt: nullableString(data.billingStartedAt),
      billingNotes: nullableString(data.billingNotes),
    };
  } catch {
    return null;
  }
}

function fingerprint(input: SubscriptionUpdateInput): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(input)).digest('hex')}`;
}

class IdempotencyConflictError extends Error {}
class OrganizationNotFoundError extends Error {}

export async function handleOrganizationSubscriptionPost(request: RequestLike, deps: HandlerDeps = {}) {
  const auth = await (deps.verifyIdTokenFn ?? verifyIdToken)(request as NextRequest);
  if (!auth) return NextResponse.json({ success: false, code: 'UNAUTHORIZED' }, { status: 401 });
  if (!await (deps.isSuperAdminFn ?? isSuperAdmin)(auth.uid)) {
    return NextResponse.json({ success: false, code: 'FORBIDDEN' }, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ success: false, code: 'INVALID_JSON' }, { status: 400 });
  }
  const input = parseSubscriptionUpdateInput(raw);
  if (!input) return NextResponse.json({ success: false, code: 'INVALID_INPUT' }, { status: 400 });

  const db = deps.db ?? getAdminDb();
  const nowIso = (deps.now ?? (() => new Date()))().toISOString();
  const requestFingerprint = fingerprint(input);
  let idempotent = false;

  try {
    await db.runTransaction(async (transaction) => {
      const orgRef = db.doc(`organizations/${input.orgId}`);
      const subscriptionRef = db.doc(`organizations/${input.orgId}/subscription/current`);
      const auditRef = db.doc(`adminAuditLogs/plan-${input.idempotencyKey}`);
      const [orgSnap, subscriptionSnap, auditSnap] = await Promise.all([
        transaction.get(orgRef),
        transaction.get(subscriptionRef),
        transaction.get(auditRef),
      ]);
      if (!orgSnap.exists) throw new OrganizationNotFoundError();
      if (auditSnap.exists) {
        if (auditSnap.data()?.requestFingerprint !== requestFingerprint) throw new IdempotencyConflictError();
        idempotent = true;
        return;
      }

      const legacyPlan = legacyPlanFor(input.planId as CanonicalPlanId);
      const projection = {
        planId: input.planId,
        status: input.status,
        catalogVersion: ENTITLEMENTS_CATALOG_VERSION,
        catalogFingerprint: catalogFingerprintFor(input.planId as CanonicalPlanId),
        entitlements: catalogEntitlementsFor(input.planId as CanonicalPlanId),
        effectiveAt: nowIso,
        updatedAt: nowIso,
        origin: 'admin_control_tower',
        changeReason: input.reason,
      };
      const rootPatch = {
        billingPlan: legacyPlan,
        billingStatus: input.status,
        billingMonthlyAmount: input.billingMonthlyAmount,
        billingImplantationAmount: input.billingImplantationAmount,
        billingContactEmail: input.billingContactEmail,
        billingStartedAt: input.billingStartedAt,
        billingNotes: input.billingNotes,
        billingUpdatedAt: nowIso,
        updatedAt: nowIso,
      };
      transaction.update(orgRef, rootPatch);
      transaction.set(subscriptionRef, projection);
      transaction.create(auditRef, {
        action: 'organization.subscription.update',
        organizationId: input.orgId,
        actorUid: auth.uid,
        performedBy: auth.uid,
        target: input.orgId,
        reason: input.reason,
        idempotencyKey: input.idempotencyKey,
        requestFingerprint,
        before: {
          planId: normalizePlanId(subscriptionSnap.data()?.planId ?? orgSnap.data()?.billingPlan),
          status: subscriptionSnap.data()?.status ?? orgSnap.data()?.billingStatus ?? null,
        },
        after: {
          planId: projection.planId,
          status: projection.status,
          catalogVersion: projection.catalogVersion,
        },
        createdAt: nowIso,
        timestamp: new Date(nowIso),
      });
    });
  } catch (error) {
    if (error instanceof IdempotencyConflictError) {
      return NextResponse.json({ success: false, code: 'IDEMPOTENCY_CONFLICT' }, { status: 409 });
    }
    if (error instanceof OrganizationNotFoundError) {
      return NextResponse.json({ success: false, code: 'ORGANIZATION_NOT_FOUND' }, { status: 404 });
    }
    console.error('[organization-subscription] transaction failed', error);
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    idempotent,
    planId: input.planId,
    status: input.status,
    catalogVersion: ENTITLEMENTS_CATALOG_VERSION,
  });
}
