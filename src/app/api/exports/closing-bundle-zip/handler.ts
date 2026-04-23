import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, validateUserMembership, verifyIdToken } from '@/lib/api/admin-sdk';
import { requirePermission } from '@/lib/api/require-permission';

const REGION = 'europe-west1';

type FetchLike = typeof fetch;

export interface ClosingBundleZipDeps {
  fetchFn?: FetchLike;
  getAdminDbFn?: typeof getAdminDb;
  requirePermissionFn?: typeof requirePermission;
  validateUserMembershipFn?: typeof validateUserMembership;
  verifyIdTokenFn?: typeof verifyIdToken;
}

export function buildClosingBundleUpstreamPayload(
  body: Record<string, unknown>
): Record<string, unknown> {
  // Guardrail: el client no pot forçar el mode full/debug.
  return {
    ...body,
    mode: 'user',
  };
}

export async function handleClosingBundleZipPost(
  request: NextRequest,
  deps: ClosingBundleZipDeps = {}
) {
  const fetchFn = deps.fetchFn ?? fetch;
  const getAdminDbFn = deps.getAdminDbFn ?? getAdminDb;
  const requirePermissionFn = deps.requirePermissionFn ?? requirePermission;
  const validateUserMembershipFn =
    deps.validateUserMembershipFn ?? validateUserMembership;
  const verifyIdTokenFn = deps.verifyIdTokenFn ?? verifyIdToken;

  try {
    const authHeader = request.headers.get('Authorization');
    const authResult = await verifyIdTokenFn(request);
    if (!authHeader?.startsWith('Bearer ') || !authResult) {
      return NextResponse.json(
        { code: 'UNAUTHENTICATED', message: 'Token no proporcionat' },
        { status: 401 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { code: 'INVALID_REQUEST', message: 'Body invàlid' },
        { status: 400 }
      );
    }

    const payload = body as Record<string, unknown>;
    const orgId = typeof payload.orgId === 'string' ? payload.orgId.trim() : '';
    if (!orgId) {
      return NextResponse.json(
        { code: 'INVALID_REQUEST', message: 'orgId obligatori' },
        { status: 400 }
      );
    }

    const db = getAdminDbFn();
    const membership = await validateUserMembershipFn(db, authResult.uid, orgId);
    const denied = requirePermissionFn(membership, {
      code: 'INFORMES_EXPORTAR_REQUIRED',
      check: (permissions) => permissions['informes.exportar'],
    });
    if (denied) return denied;

    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (!projectId) {
      return NextResponse.json(
        { code: 'INTERNAL_ERROR', message: 'Configuració del servidor incompleta' },
        { status: 500 }
      );
    }

    const functionUrl = `https://${REGION}-${projectId}.cloudfunctions.net/exportClosingBundleZip`;
    const upstreamPayload = buildClosingBundleUpstreamPayload(payload);
    const upstream = await fetchFn(functionUrl, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(upstreamPayload),
    });

    const contentType =
      upstream.headers.get('Content-Type') || 'application/octet-stream';
    const contentDisposition = upstream.headers.get('Content-Disposition') || '';

    if (contentType.includes('application/json')) {
      const errorData = await upstream.json();
      return NextResponse.json(errorData, { status: upstream.status });
    }

    if (!upstream.body) {
      return NextResponse.json(
        { code: 'INTERNAL_ERROR', message: 'Resposta buida del servidor' },
        { status: 500 }
      );
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': contentDisposition,
      },
    });
  } catch (error) {
    console.error('[closing-bundle-zip] Error proxy:', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Error intern del servidor' },
      { status: 500 }
    );
  }
}

export async function handleClosingBundleZipOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    },
  });
}
