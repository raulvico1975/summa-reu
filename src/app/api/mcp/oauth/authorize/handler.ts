import { NextRequest, NextResponse } from 'next/server';
import type { Firestore } from 'firebase-admin/firestore';
import { getAdminDb, verifyIdToken } from '@/lib/api/admin-sdk';
import {
  createStytchConnectedAppsClient,
  parsePublicMcpAuthorizationRequest,
  type PublicMcpConsentManifest,
  type StytchPublicMcpIdentity,
} from '@/lib/public-mcp/stytch-connected-apps';
import {
  readPublicMcpPilotConfig,
  type PublicMcpPilotConfig,
} from '@/lib/public-mcp/pilot-config';

interface PublicMcpAuthorizationBody {
  query: string;
  consentGranted?: boolean;
}

interface PublicMcpAuthorizationDeps {
  verifyIdTokenFn?: typeof verifyIdToken;
  getAdminDbFn?: () => Firestore;
  readConfigFn?: () => PublicMcpPilotConfig;
  startAuthorizationFn?: (
    config: PublicMcpPilotConfig,
    query: URLSearchParams,
    identity: StytchPublicMcpIdentity
  ) => Promise<PublicMcpConsentManifest>;
  submitAuthorizationFn?: (
    config: PublicMcpPilotConfig,
    query: URLSearchParams,
    identity: StytchPublicMcpIdentity,
    consentGranted: boolean
  ) => Promise<string>;
}

async function parseBody(request: NextRequest): Promise<PublicMcpAuthorizationBody | null> {
  try {
    const body = await request.json() as Record<string, unknown>;
    if (typeof body.query !== 'string' || body.query.length === 0 || body.query.length > 8_192) {
      return null;
    }
    if (body.consentGranted !== undefined && typeof body.consentGranted !== 'boolean') {
      return null;
    }
    return {
      query: body.query,
      ...(typeof body.consentGranted === 'boolean'
        ? { consentGranted: body.consentGranted }
        : {}),
    };
  } catch {
    return null;
  }
}

async function resolvePilotContext(request: NextRequest, deps: PublicMcpAuthorizationDeps) {
  const auth = await (deps.verifyIdTokenFn ?? verifyIdToken)(request);
  if (!auth) return {
    ok: false as const,
    response: NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 }),
  };

  let config: PublicMcpPilotConfig;
  try {
    config = (deps.readConfigFn ?? readPublicMcpPilotConfig)();
  } catch {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'MCP_OAUTH_NOT_CONFIGURED' }, { status: 503 }),
    };
  }
  if (auth.uid !== config.summaUserId) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'MCP_PILOT_NOT_ENABLED' }, { status: 403 }),
    };
  }

  const db = (deps.getAdminDbFn ?? getAdminDb)();
  const memberSnap = await db
    .doc(`organizations/${config.summaOrganizationId}/members/${auth.uid}`)
    .get();
  if (!memberSnap.exists) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'ORGANIZATION_ACCESS_DENIED' }, { status: 403 }),
    };
  }

  return {
    ok: true as const,
    config,
    identity: {
      memberId: config.stytchMemberId,
      organizationId: config.stytchOrganizationId,
    },
  };
}

function createClient(config: PublicMcpPilotConfig) {
  return createStytchConnectedAppsClient({
    projectDomain: config.stytchProjectDomain,
    projectId: config.stytchProjectId,
    projectSecret: config.stytchProjectSecret,
    allowedClientIds: config.allowedClientIds,
    resource: config.resource,
  });
}

function invalidRequestResponse(error: unknown) {
  const code = error instanceof Error ? error.message : 'MCP_OAUTH_REQUEST_INVALID';
  const isProviderFailure = code === 'STYTCH_CONNECTED_APPS_UNAVAILABLE';
  return NextResponse.json(
    { error: isProviderFailure ? 'MCP_OAUTH_PROVIDER_UNAVAILABLE' : 'MCP_OAUTH_REQUEST_INVALID' },
    { status: isProviderFailure ? 502 : 400 }
  );
}

export async function handlePublicMcpAuthorizationStart(
  request: NextRequest,
  deps: PublicMcpAuthorizationDeps = {}
) {
  const body = await parseBody(request);
  if (!body) return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
  const context = await resolvePilotContext(request, deps);
  if (!context.ok) return context.response;

  try {
    const query = new URLSearchParams(body.query);
    const manifest = deps.startAuthorizationFn
      ? await deps.startAuthorizationFn(context.config, query, context.identity)
      : await createClient(context.config).startAuthorization(
          parsePublicMcpAuthorizationRequest(query, context.config),
          context.identity
        );
    return NextResponse.json({ manifest }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return invalidRequestResponse(error);
  }
}

export async function handlePublicMcpAuthorizationSubmit(
  request: NextRequest,
  deps: PublicMcpAuthorizationDeps = {}
) {
  const body = await parseBody(request);
  if (!body || typeof body.consentGranted !== 'boolean') {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
  }
  const context = await resolvePilotContext(request, deps);
  if (!context.ok) return context.response;

  try {
    const query = new URLSearchParams(body.query);
    const redirectUri = deps.submitAuthorizationFn
      ? await deps.submitAuthorizationFn(
          context.config,
          query,
          context.identity,
          body.consentGranted
        )
      : await createClient(context.config).submitAuthorization(
          parsePublicMcpAuthorizationRequest(query, context.config),
          context.identity,
          body.consentGranted
        );
    return NextResponse.json(
      { redirectUri },
      { headers: { 'cache-control': 'no-store' } }
    );
  } catch (error) {
    return invalidRequestResponse(error);
  }
}
