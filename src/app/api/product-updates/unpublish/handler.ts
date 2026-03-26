import { revalidatePath } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/api/admin-sdk';
import { PUBLIC_LOCALES } from '@/lib/public-locale';

type RequestLike = Pick<NextRequest, 'headers' | 'json'>;

type ProductUpdatesUnpublishDocRef = {
  get: () => Promise<{
    exists: boolean;
    data: () => unknown;
  }>;
  set: (payload: Record<string, unknown>, options: { merge: boolean }) => Promise<void>;
};

type ProductUpdatesUnpublishDb = {
  doc: (path: string) => ProductUpdatesUnpublishDocRef;
};

type UnpublishProductUpdateSuccessResponse = {
  success: true;
  id: string;
  alreadyInactive?: boolean;
};

type UnpublishProductUpdateErrorResponse = {
  success: false;
  error: string;
  details?: string[];
};

export type UnpublishProductUpdateResponse =
  | UnpublishProductUpdateSuccessResponse
  | UnpublishProductUpdateErrorResponse;

export interface UnpublishProductUpdateDeps {
  getAdminDbFn: () => ProductUpdatesUnpublishDb;
  nowTimestampFn: () => unknown;
  getPublishSecretFn: () => string | null;
  getPublicLocalesFn: () => string[];
  revalidatePathsFn: (paths: string[]) => void | Promise<void>;
}

const DEFAULT_DEPS: UnpublishProductUpdateDeps = {
  getAdminDbFn: () => getAdminDb() as unknown as ProductUpdatesUnpublishDb,
  nowTimestampFn: () => Timestamp.now(),
  getPublishSecretFn: () => process.env.PRODUCT_UPDATES_PUBLISH_SECRET?.trim() || null,
  getPublicLocalesFn: () => [...PUBLIC_LOCALES],
  revalidatePathsFn: (paths) => {
    for (const path of paths) {
      revalidatePath(path);
    }
  },
};

function safeCompare(a: string, b: string) {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

function extractBearerToken(request: RequestLike): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  return token || null;
}

function hasValidAuthorization(request: RequestLike, secret: string | null): boolean {
  if (!secret) return false;
  const token = extractBearerToken(request);
  if (!token) return false;
  return safeCompare(token, secret);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function omitUndefinedDeep(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;

  if (Array.isArray(value)) {
    return value
      .map((entry) => omitUndefinedDeep(entry))
      .filter((entry) => entry !== undefined);
  }

  if (typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return value;
    }

    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      const cleaned = omitUndefinedDeep(nested);
      if (cleaned !== undefined) {
        out[key] = cleaned;
      }
    }
    return out;
  }

  return value;
}

function buildRevalidationPaths(locales: string[], slug: string | null): string[] {
  const paths = new Set<string>();

  for (const locale of locales) {
    const normalized = locale.trim();
    if (!normalized) continue;
    paths.add(`/${normalized}/novetats`);
    if (slug) {
      paths.add(`/${normalized}/novetats/${slug}`);
    }
  }

  return [...paths];
}

async function safeRevalidatePaths(
  paths: string[],
  deps: Pick<UnpublishProductUpdateDeps, 'revalidatePathsFn'>
): Promise<void> {
  try {
    await deps.revalidatePathsFn(paths);
  } catch (error) {
    console.warn('[product-updates/unpublish] revalidate warning:', error);
  }
}

export async function handleProductUpdatesUnpublish(
  request: RequestLike,
  deps: UnpublishProductUpdateDeps = DEFAULT_DEPS
): Promise<NextResponse<UnpublishProductUpdateResponse>> {
  try {
    const publishSecret = deps.getPublishSecretFn();
    if (!publishSecret || !hasValidAuthorization(request, publishSecret)) {
      return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'invalid_payload' }, { status: 400 });
    }

    const externalId = isRecord(rawBody) ? normalizeString(rawBody.externalId) : null;
    if (!externalId) {
      return NextResponse.json({ success: false, error: 'invalid_payload' }, { status: 400 });
    }

    const db = deps.getAdminDbFn();
    const docRef = db.doc(`productUpdates/${externalId}`);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      return NextResponse.json({ success: false, error: 'not_found' }, { status: 404 });
    }

    const data = snapshot.data();
    const web = isRecord(data) && isRecord(data.web) ? data.web : null;
    const slug = web?.enabled === true ? normalizeString(web.slug) : null;
    const alreadyInactive = isRecord(data) && data.isActive === false;

    if (!alreadyInactive) {
      await docRef.set(
        omitUndefinedDeep({
          isActive: false,
          unpublishedAt: deps.nowTimestampFn(),
        }) as Record<string, unknown>,
        { merge: true }
      );
    }

    const paths = buildRevalidationPaths(deps.getPublicLocalesFn(), slug);
    await safeRevalidatePaths(paths, deps);

    return NextResponse.json({
      success: true,
      id: externalId,
      alreadyInactive,
    });
  } catch (error) {
    console.error('[product-updates/unpublish] error:', error);
    return NextResponse.json({ success: false, error: 'internal_error' }, { status: 500 });
  }
}
