type DemoSessionOptions = {
  demoOwnerUid?: string | null;
  nodeEnv?: string | undefined;
};

export function getDemoSessionUid(
  sessionCookie: string | undefined,
  options: DemoSessionOptions = {}
): string | null {
  const ownerUid = options.demoOwnerUid ?? process.env.DEMO_OWNER_UID ?? null;
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV;

  if (nodeEnv === "production" || !ownerUid || !sessionCookie) {
    return null;
  }

  const expectedCookie = `demo:${ownerUid}`;
  return sessionCookie === expectedCookie ? ownerUid : null;
}
