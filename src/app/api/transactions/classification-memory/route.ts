import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

import { getAdminDb, verifyIdToken, validateUserMembership } from '@/lib/api/admin-sdk';
import { requirePermission } from '@/lib/api/require-permission';
import { normalizeDecisionDescription } from '@/lib/transaction-classification/normalize';

type RequestBody = {
  orgId?: string;
  description?: string;
  contactId?: string | null;
  categoryId?: string | null;
};

type ResponseBody =
  | { success: true; normalizedDescription: string; usageCount: number }
  | { success: false; error: string; code: string };

type ValidatedBody = {
  orgId: string;
  description: string;
  contactId: string | null;
  categoryId: string | null;
};

function getMemoryDocId(normalizedDescription: string): string {
  return createHash('sha256').update(normalizedDescription).digest('hex').slice(0, 40);
}

function validateBody(body: unknown):
  | { ok: true; value: ValidatedBody }
  | { ok: false; error: string; code: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Body invàlid', code: 'INVALID_BODY' };
  }

  const data = body as RequestBody;
  if (!data.orgId || typeof data.orgId !== 'string') {
    return { ok: false, error: 'orgId obligatori', code: 'MISSING_ORG_ID' };
  }
  if (!data.description || typeof data.description !== 'string') {
    return { ok: false, error: 'description obligatòria', code: 'MISSING_DESCRIPTION' };
  }
  if (!data.contactId && !data.categoryId) {
    return { ok: false, error: 'Cal contactId o categoryId', code: 'MISSING_CONFIRMATION' };
  }
  if (data.contactId !== undefined && data.contactId !== null && typeof data.contactId !== 'string') {
    return { ok: false, error: 'contactId invàlid', code: 'INVALID_CONTACT_ID' };
  }
  if (data.categoryId !== undefined && data.categoryId !== null && typeof data.categoryId !== 'string') {
    return { ok: false, error: 'categoryId invàlid', code: 'INVALID_CATEGORY_ID' };
  }

  return {
    ok: true,
    value: {
      orgId: data.orgId,
      description: data.description,
      contactId: data.contactId ?? null,
      categoryId: data.categoryId ?? null,
    },
  };
}

export async function POST(request: NextRequest): Promise<NextResponse<ResponseBody>> {
  const authResult = await verifyIdToken(request);
  if (!authResult) {
    return NextResponse.json(
      { success: false, error: 'No autenticat', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  let parsedBody: ValidatedBody;
  try {
    const rawBody = await request.json();
    const validation = validateBody(rawBody);
    if (!validation.ok) {
      return NextResponse.json(
        { success: false, error: validation.error, code: validation.code },
        { status: 400 }
      );
    }
    parsedBody = validation.value;
  } catch {
    return NextResponse.json(
      { success: false, error: 'Body invàlid', code: 'INVALID_BODY' },
      { status: 400 }
    );
  }

  const normalizedDescription = normalizeDecisionDescription(parsedBody.description);
  if (!normalizedDescription) {
    return NextResponse.json(
      { success: false, error: 'Descripció massa feble per memoritzar', code: 'EMPTY_NORMALIZED_DESCRIPTION' },
      { status: 400 }
    );
  }

  const db = getAdminDb();
  const membership = await validateUserMembership(db, authResult.uid, parsedBody.orgId);
  const accessError = requirePermission(membership, {
    code: 'MOVIMENTS_EDITAR_REQUIRED',
    check: (permissions) => permissions['moviments.editar'],
  });
  if (accessError) {
    return accessError as NextResponse<ResponseBody>;
  }

  const memoryDocRef = db.doc(
    `organizations/${parsedBody.orgId}/classificationMemory/${getMemoryDocId(normalizedDescription)}`
  );

  const result = await db.runTransaction(async (tx) => {
    const existingSnap = await tx.get(memoryDocRef);
    const existing = existingSnap.data() as {
      contactId?: string | null;
      categoryId?: string | null;
      usageCount?: number;
    } | undefined;

    const nextContactId = parsedBody.contactId ?? existing?.contactId ?? null;
    const nextCategoryId = parsedBody.categoryId ?? existing?.categoryId ?? null;

    const replacesExisting =
      (parsedBody.contactId && existing?.contactId && existing.contactId !== parsedBody.contactId)
      || (parsedBody.categoryId && existing?.categoryId && existing.categoryId !== parsedBody.categoryId);

    const usageCount = replacesExisting
      ? 1
      : Math.max(1, (existing?.usageCount ?? 0) + 1);

    tx.set(memoryDocRef, {
      normalizedDescription,
      usageCount,
      lastUsedAt: new Date().toISOString(),
      ...(nextContactId ? { contactId: nextContactId } : {}),
      ...(nextCategoryId ? { categoryId: nextCategoryId } : {}),
    }, { merge: true });

    return usageCount;
  });

  return NextResponse.json({
    success: true,
    normalizedDescription,
    usageCount: result,
  });
}
