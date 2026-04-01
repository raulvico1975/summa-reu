type DemoSessionOptions = {
  demoOwnerUid?: string | null;
  nodeEnv?: string | undefined;
  allowProductionDemo?: boolean;
};

export const DEFAULT_DEMO_OWNER_UID = "owner-demo";

function normalizeSessionCookieValue(sessionCookie: string): string {
  try {
    return decodeURIComponent(sessionCookie);
  } catch {
    return sessionCookie;
  }
}

export function getDemoSessionUid(
  sessionCookie: string | undefined,
  options: DemoSessionOptions = {}
): string | null {
  const ownerUid = options.demoOwnerUid ?? process.env.DEMO_OWNER_UID ?? DEFAULT_DEMO_OWNER_UID;
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV;
  const allowProductionDemo = options.allowProductionDemo ?? process.env.DEMO_SESSION_ALLOW_PRODUCTION === "true";

  if ((nodeEnv === "production" && !allowProductionDemo) || !ownerUid || !sessionCookie) {
    return null;
  }

  const expectedCookie = `demo:${ownerUid}`;
  return normalizeSessionCookieValue(sessionCookie) === expectedCookie ? ownerUid : null;
}
