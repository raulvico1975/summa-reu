type DemoSessionOptions = {
  demoOwnerUid?: string | null;
  nodeEnv?: string | undefined;
};

export const DEFAULT_DEMO_OWNER_UID = "owner-demo";

export function getDemoSessionUid(
  sessionCookie: string | undefined,
  options: DemoSessionOptions = {}
): string | null {
  const ownerUid = options.demoOwnerUid ?? process.env.DEMO_OWNER_UID ?? DEFAULT_DEMO_OWNER_UID;
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV;

  if (nodeEnv === "production" || !ownerUid || !sessionCookie) {
    return null;
  }

  const expectedCookie = `demo:${ownerUid}`;
  return sessionCookie === expectedCookie ? ownerUid : null;
}
