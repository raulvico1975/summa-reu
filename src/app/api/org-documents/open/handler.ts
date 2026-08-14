import { NextResponse, type NextRequest } from 'next/server';
import { getStorage } from 'firebase-admin/storage';
import { getAdminApp, getAdminDb, validateUserMembership, verifyIdToken } from '@/lib/api/admin-sdk';
import { extractStoragePathFromDocumentUrl } from '@/app/api/transaction-documents/open/handler';
import { requirePermission } from '@/lib/api/require-permission';

const SIGNED_URL_TTL_MS = 15 * 60 * 1000;

const ALLOWED_ORG_DOCUMENT_PREFIXES = [
  'documents',
  'transactions',
  'pendingDocuments',
  'offBankExpenses',
  'expenseReports',
  'prebankRemittances',
  'sepaCollectionRuns',
] as const;

type RequestLike = Pick<NextRequest, 'headers' | 'nextUrl'>;

interface OpenOrgDocumentDeps {
  verifyIdTokenFn?: typeof verifyIdToken;
  db?: FirebaseFirestore.Firestore;
  storageBucket?: {
    file(path: string): {
      exists(): Promise<[boolean]>;
      getSignedUrl(options: { action: 'read'; expires: number }): Promise<[string]>;
    };
  };
  nowMs?: () => number;
}

function cleanParam(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}

function isAllowedOrgDocumentPath(path: string, orgId: string): boolean {
  if (!path.startsWith(`organizations/${orgId}/`)) return false;
  if (path.includes('..') || path.includes('\0')) return false;

  const [, , area] = path.split('/');
  return ALLOWED_ORG_DOCUMENT_PREFIXES.includes(area as typeof ALLOWED_ORG_DOCUMENT_PREFIXES[number]);
}

export async function handleOpenOrgDocument(
  request: RequestLike,
  deps: OpenOrgDocumentDeps = {}
) {
  const verifyIdTokenFn = deps.verifyIdTokenFn ?? verifyIdToken;
  const auth = await verifyIdTokenFn(request as NextRequest);
  if (!auth) {
    return NextResponse.json({ success: false, code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const orgId = cleanParam(request.nextUrl.searchParams.get('orgId'));
  const rawStoragePath = cleanParam(request.nextUrl.searchParams.get('storagePath'));
  const rawUrl = cleanParam(request.nextUrl.searchParams.get('url'));

  if (!orgId) return NextResponse.json({ success: false, code: 'MISSING_ORG_ID' }, { status: 400 });

  const storagePath = rawStoragePath ?? extractStoragePathFromDocumentUrl(rawUrl, orgId);
  if (!storagePath || !isAllowedOrgDocumentPath(storagePath, orgId)) {
    return NextResponse.json({ success: false, code: 'INVALID_STORAGE_PATH' }, { status: 400 });
  }

  const db = deps.db ?? getAdminDb();
  const membership = await validateUserMembership(db, auth.uid, orgId);
  if (!membership.valid) {
    return NextResponse.json({ success: false, code: 'NOT_MEMBER' }, { status: 403 });
  }
  const area = storagePath.split('/')[2];
  if (area === 'documents' || area === 'transactions') {
    const denied = requirePermission(membership, {
      code: 'MOVIMENTS_ROUTE_REQUIRED',
      check: (permissions) => permissions['sections.moviments'] && permissions['moviments.read'],
    });
    if (denied) return denied;
  }

  const bucket = deps.storageBucket ?? getStorage(getAdminApp()).bucket();
  const file = bucket.file(storagePath);
  const [exists] = await file.exists();
  if (!exists) {
    return NextResponse.json({ success: false, code: 'STORAGE_OBJECT_NOT_FOUND' }, { status: 404 });
  }

  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: (deps.nowMs ?? Date.now)() + SIGNED_URL_TTL_MS,
  });

  return NextResponse.json({ success: true, url, durable: true });
}
