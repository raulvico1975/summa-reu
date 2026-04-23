import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from 'firebase-admin/storage';
import type { Bucket } from '@google-cloud/storage';

import { getAdminApp } from '@/lib/api/admin-sdk';
import {
  verifyAdminMembership,
  type AdminAuthResult,
  type AdminAuthError,
} from '@/lib/fiscal/remittances/admin-auth';
import { summarizeSepaCollectionRunRecord } from '@/lib/sepa/pain008/run-history';
import { validateSavedRemittanceSelection } from '@/lib/sepa/pain008/saved-remittance-candidates';

interface LoadSavedRemittanceRequest {
  orgId: string;
  parentTxId: string;
  savedRunId: string;
}

interface LoadSavedRemittanceResponse {
  success: boolean;
  xmlContent?: string;
  error?: string;
  code?: string;
}

interface SavedRemittanceLoadDeps {
  verifyAdminMembership?: (
    request: NextRequest,
    orgId: string
  ) => Promise<AdminAuthResult | AdminAuthError>;
  getStorageBucket?: () => Bucket;
}

function getStorageBucket(): Bucket {
  return getStorage(getAdminApp()).bucket();
}

function getOrganizationStoragePrefix(orgId: string): string {
  return `organizations/${orgId}/`;
}

function validateRequest(body: unknown):
  | { valid: true; data: LoadSavedRemittanceRequest }
  | { valid: false; error: string; code: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Body invàlid', code: 'INVALID_BODY' };
  }

  const value = body as Record<string, unknown>;
  const orgId = typeof value.orgId === 'string' ? value.orgId.trim() : '';
  const parentTxId = typeof value.parentTxId === 'string' ? value.parentTxId.trim() : '';
  const savedRunId = typeof value.savedRunId === 'string' ? value.savedRunId.trim() : '';

  if (!orgId) {
    return { valid: false, error: 'orgId obligatori', code: 'MISSING_ORG_ID' };
  }

  if (!parentTxId) {
    return { valid: false, error: 'parentTxId obligatori', code: 'MISSING_PARENT_TX_ID' };
  }

  if (!savedRunId) {
    return { valid: false, error: 'savedRunId obligatori', code: 'MISSING_SAVED_RUN_ID' };
  }

  return {
    valid: true,
    data: { orgId, parentTxId, savedRunId },
  };
}

export async function handleSavedRemittanceLoadPost(
  request: NextRequest,
  deps: SavedRemittanceLoadDeps = {}
): Promise<NextResponse<LoadSavedRemittanceResponse>> {
  const verifyAdminMembershipFn = deps.verifyAdminMembership ?? verifyAdminMembership;
  const getStorageBucketFn = deps.getStorageBucket ?? getStorageBucket;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'JSON invàlid', code: 'INVALID_JSON' },
        { status: 400 }
      );
    }

    const validation = validateRequest(body);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error, code: validation.code },
        { status: 400 }
      );
    }

    const { orgId, parentTxId, savedRunId } = validation.data;

    const authResult = await verifyAdminMembershipFn(request, orgId);
    if (!authResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: authResult.error,
          code: authResult.code,
        },
        { status: authResult.status }
      );
    }

    const { db } = authResult;

    const parentSnap = await db.doc(`organizations/${orgId}/transactions/${parentTxId}`).get();
    if (!parentSnap.exists) {
      return NextResponse.json(
        { success: false, error: 'Transacció pare no trobada', code: 'PARENT_NOT_FOUND' },
        { status: 404 }
      );
    }

    const parentData = (parentSnap.data() as Record<string, unknown> | undefined) ?? {};
    if (parentData.isRemittance === true) {
      return NextResponse.json(
        {
          success: false,
          error: 'Remesa ja processada. Cal desfer abans de tornar a processar.',
          code: 'REMITTANCE_ALREADY_PROCESSED',
        },
        { status: 409 }
      );
    }

    const savedRunSnap = await db.doc(`organizations/${orgId}/sepaCollectionRuns/${savedRunId}`).get();
    if (!savedRunSnap.exists) {
      return NextResponse.json(
        { success: false, error: 'Remesa guardada no trobada', code: 'SAVED_RUN_NOT_FOUND' },
        { status: 404 }
      );
    }

    const savedRunSummary = summarizeSepaCollectionRunRecord({
      ...((savedRunSnap.data() as Record<string, unknown> | undefined) ?? {}),
      id: savedRunId,
    });

    const selectionValidation = validateSavedRemittanceSelection({
      transactionBankAccountId:
        typeof parentData.bankAccountId === 'string' && parentData.bankAccountId.trim()
          ? parentData.bankAccountId
          : null,
      savedRunBankAccountId: savedRunSummary.bankAccountId,
      transactionAmount:
        typeof parentData.amount === 'number' && Number.isFinite(parentData.amount)
          ? parentData.amount
          : 0,
      savedRunTotalCents: savedRunSummary.totalCents,
    });

    if (!selectionValidation.valid) {
      const response =
        selectionValidation.reason === 'missing_transaction_bank_account'
          ? {
              success: false as const,
              error: 'No es pot verificar el compte bancari del moviment bancari.',
              code: 'BANK_ACCOUNT_NOT_VERIFIABLE',
            }
          : selectionValidation.reason === 'bank_account_mismatch'
            ? {
                success: false as const,
                error: 'El compte bancari de la remesa guardada no coincideix amb el moviment bancari.',
                code: 'BANK_ACCOUNT_MISMATCH',
              }
            : {
                success: false as const,
                error: 'L import de la remesa guardada no coincideix amb aquest moviment bancari.',
                code: 'AMOUNT_MISMATCH',
              };

      return NextResponse.json(response, { status: 400 });
    }

    if (!savedRunSummary.storagePath) {
      return NextResponse.json(
        {
          success: false,
          error: 'La remesa guardada no té cap fitxer disponible.',
          code: 'SAVED_RUN_FILE_UNAVAILABLE',
        },
        { status: 409 }
      );
    }

    const orgStoragePrefix = getOrganizationStoragePrefix(orgId);
    if (!savedRunSummary.storagePath.startsWith(orgStoragePrefix)) {
      return NextResponse.json(
        {
          success: false,
          error: 'El fitxer de la remesa guardada no pertany a aquesta organització.',
          code: 'SAVED_RUN_FILE_FORBIDDEN',
        },
        { status: 403 }
      );
    }

    const bucket = getStorageBucketFn();
    const file = bucket.file(savedRunSummary.storagePath);
    const [exists] = await file.exists();
    if (!exists) {
      return NextResponse.json(
        {
          success: false,
          error: 'El fitxer de la remesa guardada ja no està disponible.',
          code: 'SAVED_RUN_FILE_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    const [rawXml] = await file.download();

    return NextResponse.json({
      success: true,
      xmlContent: rawXml.toString('utf8'),
    });
  } catch (error) {
    console.error('[remittances/in/saved-run] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error intern del servidor',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
