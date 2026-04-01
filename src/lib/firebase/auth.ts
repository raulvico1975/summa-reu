import { cookies, headers } from "next/headers";
import type { NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/src/lib/firebase/admin";
import type { OrgDoc, OrgPlan, OrgSubscriptionStatus } from "@/src/lib/db/types";
import { getDemoSessionUid } from "@/src/lib/firebase/demo-session";

export const SESSION_COOKIE_NAME = "__session";
export const DEMO_SESSION_COOKIE_NAME = "summareu_demo_session";

function getSessionCookieValue(
  cookieStore: {
    get(name: string): { value: string } | undefined;
  }
): string | undefined {
  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? cookieStore.get(DEMO_SESSION_COOKIE_NAME)?.value;
}

function isLocalHost(host: string): boolean {
  return host.startsWith("127.0.0.1") || host.startsWith("localhost");
}

export type OwnerContext = {
  uid: string;
  orgId: string;
  orgName: string;
  subscriptionStatus: OrgSubscriptionStatus;
  subscriptionPastDueAt: number | null;
  plan: OrgPlan;
  recordingLimitMinutes: number;
};

async function resolveOwnerContext(uid: string): Promise<OwnerContext | null> {
  const canonicalDoc = await adminDb.collection("orgs").doc(uid).get();
  if (canonicalDoc.exists) {
    const data = canonicalDoc.data() as OrgDoc;
    return {
      uid,
      orgId: canonicalDoc.id,
      orgName: data.name ?? "Organització",
      subscriptionStatus: data.subscriptionStatus ?? "none",
      subscriptionPastDueAt: data.subscriptionPastDueAt ?? null,
      plan: data.plan ?? "basic",
      recordingLimitMinutes: data.recordingLimitMinutes ?? 90,
    };
  }

  // Backward compatibility for older org ids that were not owner uid.
  const legacySnap = await adminDb
    .collection("orgs")
    .where("ownerUid", "==", uid)
    .limit(1)
    .get();

  const orgDoc = legacySnap.docs[0];
  if (!orgDoc) {
    return null;
  }

  const data = orgDoc.data() as OrgDoc;
  return {
    uid,
    orgId: orgDoc.id,
    orgName: data.name ?? "Organització",
    subscriptionStatus: data.subscriptionStatus ?? "none",
    subscriptionPastDueAt: data.subscriptionPastDueAt ?? null,
    plan: data.plan ?? "basic",
    recordingLimitMinutes: data.recordingLimitMinutes ?? 90,
  };
}

export async function getSessionUidFromRequest(request: NextRequest): Promise<string | null> {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value ?? request.cookies.get(DEMO_SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) {
    return null;
  }

  const host =
    request.headers.get("x-forwarded-host")?.toLowerCase() ??
    request.headers.get("host")?.toLowerCase() ??
    "";
  const demoUid = getDemoSessionUid(sessionCookie, {
    allowProductionDemo: isLocalHost(host) || process.env.DEMO_SESSION_ALLOW_PRODUCTION === "true",
  });
  if (demoUid) {
    return demoUid;
  }

  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    return decoded.uid;
  } catch {
    return null;
  }
}

export async function getOwnerFromRequest(request: NextRequest): Promise<OwnerContext | null> {
  const uid = await getSessionUidFromRequest(request);
  if (!uid) {
    return null;
  }

  return resolveOwnerContext(uid);
}

export async function getOwnerFromServerCookies(): Promise<OwnerContext | null> {
  const cookieStore = await cookies();
  const sessionCookie = getSessionCookieValue(cookieStore);
  if (!sessionCookie) {
    return null;
  }

  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host")?.toLowerCase() ??
    requestHeaders.get("host")?.toLowerCase() ??
    "";
  const demoUid = getDemoSessionUid(sessionCookie, {
    allowProductionDemo: isLocalHost(host) || process.env.DEMO_SESSION_ALLOW_PRODUCTION === "true",
  });
  if (demoUid) {
    return resolveOwnerContext(demoUid);
  }

  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    return resolveOwnerContext(decoded.uid);
  } catch {
    return null;
  }
}
