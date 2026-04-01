import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/src/lib/firebase/admin";
import {
  deleteMeetingById,
  listPollsByOrg,
} from "@/src/lib/db/repo";
import { getOwnerFromRequest } from "@/src/lib/firebase/auth";
import { getRequestI18nFromNextRequest } from "@/src/i18n/request";
import { reportApiUnexpectedError } from "@/src/lib/monitoring/report";
import { isTrustedSameOrigin } from "@/src/lib/security/request";

export const runtime = "nodejs";

async function cancelStripeSubscription(subscriptionId: string): Promise<void> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return;

  const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${secretKey}` },
  });

  if (!res.ok) {
    console.error("stripe_cancel_failed", { subscriptionId, status: res.status });
  }
}

export async function POST(request: NextRequest) {
  const { i18n } = getRequestI18nFromNextRequest(request);

  try {
    if (!isTrustedSameOrigin(request)) {
      return NextResponse.json({ error: i18n.errors.unauthorized }, { status: 403 });
    }

    const owner = await getOwnerFromRequest(request);
    if (!owner) {
      return NextResponse.json({ error: i18n.errors.unauthorized }, { status: 401 });
    }

    const orgId = owner.orgId;
    const orgRef = adminDb.collection("orgs").doc(orgId);
    const orgSnap = await orgRef.get();
    const orgData = orgSnap.data() as { stripeSubscriptionId?: string | null } | undefined;

    // 1. Cancel Stripe subscription
    if (orgData?.stripeSubscriptionId) {
      await cancelStripeSubscription(orgData.stripeSubscriptionId).catch(() => {});
    }

    // 2. Delete all polls (recursive: options, voters, votes)
    const polls = await listPollsByOrg(orgId);
    await Promise.all(
      polls.map((poll) => adminDb.recursiveDelete(adminDb.collection("polls").doc(poll.id)))
    );

    // 3. Delete all meetings regardless of status (storage + ingest jobs + subcollections)
    const allMeetingsSnap = await adminDb.collection("meetings").where("orgId", "==", orgId).get();
    await Promise.all(
      allMeetingsSnap.docs.map((doc) => deleteMeetingById(doc.id))
    );

    // 4. Delete stripe_events for this org
    const stripeEventsSnap = await adminDb
      .collection("stripe_events")
      .where("orgId", "==", orgId)
      .get();
    if (stripeEventsSnap.size > 0) {
      const batch = adminDb.batch();
      stripeEventsSnap.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }

    // 5. Delete org document
    await orgRef.delete();

    // 6. Revoke refresh tokens and delete Firebase Auth user
    await adminAuth.revokeRefreshTokens(owner.uid).catch(() => {});
    await adminAuth.deleteUser(owner.uid);

    // Clear session cookie
    const response = NextResponse.json({ ok: true });
    response.cookies.set("session", "", { maxAge: 0, path: "/" });
    return response;
  } catch (error) {
    await reportApiUnexpectedError({
      route: "/api/owner/account/delete",
      action: "intentàvem eliminar un compte complet",
      error,
    });

    return NextResponse.json({ error: i18n.settings.deleteError }, { status: 400 });
  }
}
