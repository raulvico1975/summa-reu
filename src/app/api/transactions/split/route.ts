import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import {
  getAdminDb,
  validateUserMembership,
  verifyIdToken,
} from '@/lib/api/admin-sdk';
import { requirePermission } from '@/lib/api/require-permission';
import { getLockFailureMessage, type LockOperation } from '@/lib/fiscal/processLocks';
import {
  calculateSplitAmountDeltaCents,
  isSplitAmountBalanced,
} from '@/lib/fiscal/split-amount-balance';
import {
  commitAtomicSplit,
  SplitTooLargeError,
} from '@/lib/transactions/commit-atomic-split';
import {
  MAX_SPLIT_CHILDREN,
  SPLIT_TOO_LARGE_CODE,
  getSplitTooLargeMessage,
} from '@/lib/transactions/split-contract';

type SplitLineKind = 'donation' | 'nonDonation';

interface SplitLineInput {
  amountCents: number;
  kind: SplitLineKind;
  categoryId?: string | null;
  contactId?: string | null;
  note?: string | null;
}

interface SplitRequestBody {
  orgId: string;
  parentTxId: string;
  lines: SplitLineInput[];
}

interface SplitLineValidated {
  amountCents: number;
  kind: SplitLineKind;
  categoryId: string | null;
  contactId: string | null;
  note: string | null;
}

interface SplitResponseBody {
  success: boolean;
  parentTxId?: string;
  childTransactionIds?: string[];
  createdCount?: number;
  error?: string;
  code?: string;
}

interface ContactDoc {
  id: string;
  name?: string | null;
  type?: string | null;
}

interface CategoryDoc {
  id: string;
  name?: string | null;
}

interface LockAcquireResult {
  ok: boolean;
  reason?: 'locked_by_other' | 'error';
  lockedByUid?: string;
  operation?: LockOperation;
}

const LOCK_TTL_SECONDS = 90;

function validateBody(body: unknown): {
  ok: true;
  data: { orgId: string; parentTxId: string; lines: SplitLineValidated[] };
} | {
  ok: false;
  error: string;
  code: string;
} {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Body invàlid', code: 'INVALID_BODY' };
  }

  const payload = body as Record<string, unknown>;

  if (typeof payload.orgId !== 'string' || !payload.orgId.trim()) {
    return { ok: false, error: 'orgId obligatori', code: 'MISSING_ORG_ID' };
  }

  if (typeof payload.parentTxId !== 'string' || !payload.parentTxId.trim()) {
    return { ok: false, error: 'parentTxId obligatori', code: 'MISSING_PARENT_TX_ID' };
  }

  if (!Array.isArray(payload.lines) || payload.lines.length < 2) {
    return { ok: false, error: 'Calen almenys 2 línies', code: 'INVALID_LINES_COUNT' };
  }

  if (payload.lines.length > MAX_SPLIT_CHILDREN) {
    return {
      ok: false,
      error: getSplitTooLargeMessage(),
      code: SPLIT_TOO_LARGE_CODE,
    };
  }

  const lines: SplitLineValidated[] = [];

  for (let i = 0; i < payload.lines.length; i++) {
    const rawLine = payload.lines[i];
    if (!rawLine || typeof rawLine !== 'object') {
      return {
        ok: false,
        error: `lines[${i}] invàlida`,
        code: 'INVALID_LINE',
      };
    }

    const line = rawLine as Record<string, unknown>;
    const amountCents = line.amountCents;
    const kind = line.kind;

    if (!Number.isInteger(amountCents) || (amountCents as number) <= 0) {
      return {
        ok: false,
        error: `lines[${i}].amountCents ha de ser enter > 0`,
        code: 'INVALID_LINE_AMOUNT',
      };
    }

    if (kind !== 'donation' && kind !== 'nonDonation') {
      return {
        ok: false,
        error: `lines[${i}].kind invàlid`,
        code: 'INVALID_LINE_KIND',
      };
    }

    const categoryId =
      typeof line.categoryId === 'string' && line.categoryId.trim()
        ? line.categoryId.trim()
        : null;
    const contactId =
      typeof line.contactId === 'string' && line.contactId.trim()
        ? line.contactId.trim()
        : null;

    if (kind === 'donation' && !contactId) {
      return {
        ok: false,
        error: `lines[${i}] requereix contacte de donant`,
        code: 'DONATION_CONTACT_REQUIRED',
      };
    }

    if (kind === 'nonDonation' && !categoryId) {
      return {
        ok: false,
        error: `lines[${i}] requereix categoria`,
        code: 'NON_DONATION_CATEGORY_REQUIRED',
      };
    }

    if (line.note !== undefined && line.note !== null && typeof line.note !== 'string') {
      return {
        ok: false,
        error: `lines[${i}].note invàlida`,
        code: 'INVALID_LINE_NOTE',
      };
    }

    lines.push({
      amountCents: amountCents as number,
      kind,
      categoryId,
      contactId,
      note: typeof line.note === 'string' ? line.note.trim() || null : null,
    });
  }

  return {
    ok: true,
    data: {
      orgId: payload.orgId.trim(),
      parentTxId: payload.parentTxId.trim(),
      lines,
    },
  };
}

async function acquireProcessLockAdmin(input: {
  orgId: string;
  parentTxId: string;
  uid: string;
  operation: LockOperation;
}): Promise<LockAcquireResult> {
  const db = getAdminDb();
  const lockRef = db.doc(`organizations/${input.orgId}/processLocks/${input.parentTxId}`);

  try {
    const result = await db.runTransaction(async (transaction) => {
      const lockSnap = await transaction.get(lockRef);
      const now = Timestamp.now();

      if (lockSnap.exists) {
        const lockData = lockSnap.data();
        if (lockData?.expiresAt && lockData.expiresAt.toMillis() > now.toMillis()) {
          return {
            ok: false as const,
            reason: 'locked_by_other' as const,
            lockedByUid: typeof lockData.lockedByUid === 'string' ? lockData.lockedByUid : undefined,
            operation: lockData.operation as LockOperation | undefined,
          };
        }
      }

      const expiresAt = Timestamp.fromMillis(now.toMillis() + LOCK_TTL_SECONDS * 1000);
      transaction.set(lockRef, {
        lockedAt: now,
        expiresAt,
        lockedByUid: input.uid,
        operation: input.operation,
      });

      return { ok: true as const };
    });

    return result;
  } catch (error) {
    console.error('[transactions/split] Error adquirint lock:', error);
    return { ok: false, reason: 'error' };
  }
}

async function releaseProcessLockAdmin(input: {
  orgId: string;
  parentTxId: string;
}): Promise<void> {
  const db = getAdminDb();
  const lockRef = db.doc(`organizations/${input.orgId}/processLocks/${input.parentTxId}`);

  try {
    await lockRef.delete();
  } catch (error) {
    console.warn('[transactions/split] Error alliberant lock:', error);
  }
}

async function loadContactsMap(orgId: string, contactIds: string[]): Promise<Map<string, ContactDoc>> {
  const db = getAdminDb();
  const map = new Map<string, ContactDoc>();

  if (contactIds.length === 0) return map;

  const refs = contactIds.map((contactId) => db.doc(`organizations/${orgId}/contacts/${contactId}`));
  const snaps = await db.getAll(...refs);

  snaps.forEach((snap) => {
    if (!snap.exists) return;
    const data = snap.data() ?? {};
    map.set(snap.id, {
      id: snap.id,
      name: typeof data.name === 'string' ? data.name : null,
      type: typeof data.type === 'string' ? data.type : null,
    });
  });

  return map;
}

async function loadCategoriesMap(orgId: string, categoryIds: string[]): Promise<Map<string, CategoryDoc>> {
  const db = getAdminDb();
  const map = new Map<string, CategoryDoc>();

  if (categoryIds.length === 0) return map;

  const refs = categoryIds.map((categoryId) => db.doc(`organizations/${orgId}/categories/${categoryId}`));
  const snaps = await db.getAll(...refs);

  snaps.forEach((snap) => {
    if (!snap.exists) return;
    const data = snap.data() ?? {};
    map.set(snap.id, {
      id: snap.id,
      name: typeof data.name === 'string' ? data.name : null,
    });
  });

  return map;
}

export async function POST(request: NextRequest): Promise<NextResponse<SplitResponseBody>> {
  const authResult = await verifyIdToken(request);
  if (!authResult) {
    return NextResponse.json(
      { success: false, error: 'No autenticat', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  let parsedBody: { orgId: string; parentTxId: string; lines: SplitLineValidated[] };
  try {
    const rawBody = await request.json();
    const validation = validateBody(rawBody);
    if (!validation.ok) {
      return NextResponse.json(
        { success: false, error: validation.error, code: validation.code },
        { status: 400 }
      );
    }
    parsedBody = validation.data;
  } catch {
    return NextResponse.json(
      { success: false, error: 'Body invàlid', code: 'INVALID_BODY' },
      { status: 400 }
    );
  }

  const db = getAdminDb();
  const membership = await validateUserMembership(db, authResult.uid, parsedBody.orgId);
  const accessError = requirePermission(membership, {
    code: 'MOVIMENTS_EDITAR_REQUIRED',
    check: (permissions) => permissions['moviments.editar'],
  });
  if (accessError) return accessError as NextResponse<SplitResponseBody>;

  const parentRef = db.doc(`organizations/${parsedBody.orgId}/transactions/${parsedBody.parentTxId}`);
  const parentSnap = await parentRef.get();

  if (!parentSnap.exists) {
    return NextResponse.json(
      { success: false, error: 'Transacció pare no trobada', code: 'PARENT_NOT_FOUND' },
      { status: 404 }
    );
  }

  const parentData = parentSnap.data() as Record<string, unknown>;
  const parentAmount = typeof parentData.amount === 'number' ? parentData.amount : null;
  const parentBankAccountId =
    typeof parentData.bankAccountId === 'string' && parentData.bankAccountId.trim()
      ? parentData.bankAccountId.trim()
      : null;
  const parentDate = typeof parentData.date === 'string' ? parentData.date : null;
  const parentDescription =
    typeof parentData.description === 'string' ? parentData.description : null;

  if (parentAmount == null || parentAmount <= 0) {
    return NextResponse.json(
      {
        success: false,
        error: 'La transacció pare ha de ser un ingrés',
        code: 'PARENT_NOT_INCOME',
      },
      { status: 400 }
    );
  }

  if (!parentBankAccountId) {
    return NextResponse.json(
      {
        success: false,
        error: 'La transacció pare no té compte bancari associat',
        code: 'PARENT_BANK_ACCOUNT_REQUIRED',
      },
      { status: 400 }
    );
  }

  if (!parentDate || !parentDescription) {
    return NextResponse.json(
      {
        success: false,
        error: 'La transacció pare no té dades mínimes vàlides',
        code: 'PARENT_INVALID_SHAPE',
      },
      { status: 400 }
    );
  }

  if (
    parentData.isRemittance === true ||
    parentData.isRemittanceItem === true ||
    parentData.isSplit === true ||
    !!parentData.parentTransactionId ||
    !!parentData.stripeTransferId
  ) {
    return NextResponse.json(
      {
        success: false,
        error: 'Aquest moviment no es pot desglossar',
        code: 'PARENT_NOT_ELIGIBLE',
      },
      { status: 400 }
    );
  }

  if (parentData.source === 'stripe') {
    return NextResponse.json(
      {
        success: false,
        error: 'Els moviments Stripe no es poden desglossar aquí',
        code: 'PARENT_SOURCE_NOT_ALLOWED',
      },
      { status: 400 }
    );
  }

  if (parentData.transactionType === 'donation' || parentData.transactionType === 'fee') {
    return NextResponse.json(
      {
        success: false,
        error: 'Aquest tipus de moviment no es pot desglossar',
        code: 'PARENT_TYPE_NOT_ALLOWED',
      },
      { status: 400 }
    );
  }

  const parentAmountCents = Math.round(parentAmount * 100);
  const lineAmounts = parsedBody.lines.map((line) => line.amountCents);
  const deltaCents = calculateSplitAmountDeltaCents(parentAmountCents, lineAmounts);

  if (!isSplitAmountBalanced(parentAmountCents, lineAmounts)) {
    return NextResponse.json(
      {
        success: false,
        error: `La suma de línies no quadra amb el banc (delta ${deltaCents} cèntims)`,
        code: 'SPLIT_SUM_MISMATCH',
      },
      { status: 400 }
    );
  }

  const uniqueContactIds = Array.from(
    new Set(
      parsedBody.lines
        .map((line) => line.contactId)
        .filter((contactId): contactId is string => !!contactId)
    )
  );

  const uniqueCategoryIds = Array.from(
    new Set(
      parsedBody.lines
        .map((line) => line.categoryId)
        .filter((categoryId): categoryId is string => !!categoryId)
    )
  );

  const [contactsMap, categoriesMap] = await Promise.all([
    loadContactsMap(parsedBody.orgId, uniqueContactIds),
    loadCategoriesMap(parsedBody.orgId, uniqueCategoryIds),
  ]);

  for (let i = 0; i < parsedBody.lines.length; i++) {
    const line = parsedBody.lines[i];
    const contact = line.contactId ? contactsMap.get(line.contactId) : null;
    const category = line.categoryId ? categoriesMap.get(line.categoryId) : null;

    if (line.kind === 'donation') {
      if (!line.contactId || !contact) {
        return NextResponse.json(
          {
            success: false,
            error: `lines[${i}] requereix un donant existent`,
            code: 'DONATION_CONTACT_NOT_FOUND',
          },
          { status: 400 }
        );
      }

      if (contact.type !== 'donor') {
        return NextResponse.json(
          {
            success: false,
            error: `lines[${i}] requereix contacte tipus donor`,
            code: 'DONATION_CONTACT_NOT_DONOR',
          },
          { status: 400 }
        );
      }
    }

    if (line.kind === 'nonDonation' && (!line.categoryId || !category)) {
      return NextResponse.json(
        {
          success: false,
          error: `lines[${i}] requereix categoria existent`,
          code: 'NON_DONATION_CATEGORY_NOT_FOUND',
        },
        { status: 400 }
      );
    }

    if (line.contactId && !contact) {
      return NextResponse.json(
        {
          success: false,
          error: `lines[${i}] té contacte inexistent`,
          code: 'CONTACT_NOT_FOUND',
        },
        { status: 400 }
      );
    }

    if (line.categoryId && !category) {
      return NextResponse.json(
        {
          success: false,
          error: `lines[${i}] té categoria inexistent`,
          code: 'CATEGORY_NOT_FOUND',
        },
        { status: 400 }
      );
    }
  }

  const operation: LockOperation = 'remittanceSplit';
  const lockResult = await acquireProcessLockAdmin({
    orgId: parsedBody.orgId,
    parentTxId: parsedBody.parentTxId,
    uid: authResult.uid,
    operation,
  });

  if (!lockResult.ok) {
    return NextResponse.json(
      {
        success: false,
        error: getLockFailureMessage(lockResult),
        code: 'LOCKED',
      },
      { status: 409 }
    );
  }

  const nowIso = new Date().toISOString();

  try {
    const result = await commitAtomicSplit({
      db,
      orgId: parsedBody.orgId,
      parentTxId: parsedBody.parentTxId,
      parentDate,
      parentDescription,
      parentBankAccountId,
      lines: parsedBody.lines,
      contactsMap,
      categoriesMap,
      uid: authResult.uid,
      nowIso,
    });

    return NextResponse.json({
      success: true,
      parentTxId: parsedBody.parentTxId,
      childTransactionIds: result.childTransactionIds,
      createdCount: result.createdCount,
    });
  } catch (error) {
    console.error('[transactions/split] Error processant desglossament:', error);

    if (error instanceof SplitTooLargeError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: SPLIT_TOO_LARGE_CODE,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Error intern del servidor',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  } finally {
    await releaseProcessLockAdmin({
      orgId: parsedBody.orgId,
      parentTxId: parsedBody.parentTxId,
    });
  }
}
