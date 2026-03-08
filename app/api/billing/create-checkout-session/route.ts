import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/src/lib/firebase/admin";
import { getOwnerFromRequest } from "@/src/lib/firebase/auth";
import { getOrgById, updateOrgSubscription } from "@/src/lib/db/repo";
import {
  createStripeCheckoutSession,
  createStripeCustomer,
} from "@/src/lib/billing/stripe";
import { getRequestI18nFromNextRequest } from "@/src/i18n/request";
import { reportApiUnexpectedError } from "@/src/lib/monitoring/report";
import { isTrustedSameOrigin } from "@/src/lib/security/request";

export const runtime = "nodejs";

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

    const org = await getOrgById(owner.orgId);
    if (!org) {
      return NextResponse.json({ error: i18n.errors.unauthorized }, { status: 403 });
    }

    if (org.subscriptionStatus === "active") {
      return NextResponse.json({ error: "already_active" }, { status: 409 });
    }

    let stripeCustomerId = org.stripeCustomerId ?? null;
    if (!stripeCustomerId) {
      const user = await adminAuth.getUser(owner.uid);
      const customer = await createStripeCustomer({
        orgId: owner.orgId,
        orgName: owner.orgName,
        email: user.email ?? null,
      });
      stripeCustomerId = customer.id;
    }

    const session = await createStripeCheckoutSession({
      customerId: stripeCustomerId,
      orgId: owner.orgId,
    });

    await updateOrgSubscription({
      orgId: owner.orgId,
      subscriptionStatus: "pending",
      stripeCustomerId,
    });

    return NextResponse.json({ checkoutUrl: session.url });
  } catch (error) {
    await reportApiUnexpectedError({
      route: "/api/billing/create-checkout-session",
      action: "intentàvem crear una sessió de checkout de Stripe",
      error,
    });

    return NextResponse.json({ error: "stripe_checkout_failed" }, { status: 400 });
  }
}
