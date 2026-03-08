import { NextRequest, NextResponse } from "next/server";
import {
  findOrgByStripeCustomerId,
  findOrgByStripeSubscriptionId,
  getOrgById,
  recordStripeEvent,
  updateOrgSubscription,
} from "@/src/lib/db/repo";
import {
  verifyStripeWebhookSignature,
} from "@/src/lib/billing/stripe";
import { notifyTelegramIncident } from "@/src/lib/monitoring/telegram";

export const runtime = "nodejs";

type StripeMetadataCarrier = {
  metadata?: Record<string, string> | null;
  client_reference_id?: string | null;
  customer?: string | null;
  subscription?: string | null;
  id?: string | null;
  parent?: {
    subscription_details?: {
      metadata?: Record<string, string> | null;
    };
  } | null;
};

function getObjectString(object: Record<string, unknown>, key: string): string | null {
  const value = object[key];
  return typeof value === "string" && value ? value : null;
}

async function resolveOrgForEvent(object: StripeMetadataCarrier): Promise<string | null> {
  const metadataOrgId = object.metadata?.orgId ?? object.parent?.subscription_details?.metadata?.orgId;
  if (metadataOrgId) {
    const org = await getOrgById(metadataOrgId);
    if (org) {
      return org.id;
    }
  }

  if (object.client_reference_id) {
    const org = await getOrgById(object.client_reference_id);
    if (org) {
      return org.id;
    }
  }

  if (object.subscription) {
    const org = await findOrgByStripeSubscriptionId(object.subscription);
    if (org) {
      return org.id;
    }
  }

  if (object.customer) {
    const org = await findOrgByStripeCustomerId(object.customer);
    if (org) {
      return org.id;
    }
  }

  return null;
}

async function notifySubscriptionIncident(
  kind: "past_due" | "canceled",
  orgId: string | null,
  subscriptionId: string | null
) {
  await notifyTelegramIncident({
    source: "server",
    summary:
      kind === "past_due"
        ? "Una subscripció ha entrat en estat de cobrament pendent."
        : "Una subscripció ha estat cancel·lada.",
    where: "/api/webhooks/stripe",
    impact: "Una entitat pot quedar bloquejada fins regularitzar el pagament.",
    userAction: "Revisa Stripe i l'estat de l'entitat afectada.",
    dedupeKey: `stripe:${kind}:${orgId ?? "unknown"}:${subscriptionId ?? "unknown"}`,
  });
}

export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  const payload = await request.text();

  try {
    const event = verifyStripeWebhookSignature(payload, request.headers.get("stripe-signature"));
    const object = event.data.object as StripeMetadataCarrier & Record<string, unknown>;
    const orgId = await resolveOrgForEvent(object);
    const subscriptionId = object.subscription ?? getObjectString(object, "id");
    const customerId = object.customer ?? null;

    try {
      await recordStripeEvent({
        eventId: event.id,
        type: event.type,
        created: event.created,
        orgId,
        subscriptionId,
        raw: event.data?.object ?? null,
      });
    } catch {
      console.error("stripe_event_log_failed", event.id);
    }

    console.info("stripe_event_received", {
      event_type: event.type,
      orgId,
      subscriptionId,
    });

    if (event.type === "checkout.session.completed" && orgId) {
      await updateOrgSubscription({
        orgId,
        subscriptionStatus: "active",
        stripeCustomerId: customerId,
        stripeSubscriptionId: object.subscription ?? null,
      });
    }

    if (event.type === "invoice.payment_failed" && orgId) {
      await updateOrgSubscription({
        orgId,
        subscriptionStatus: "past_due",
        stripeCustomerId: customerId,
        stripeSubscriptionId: object.subscription ?? null,
      });
      await notifySubscriptionIncident("past_due", orgId, object.subscription ?? null);
    }

    if (event.type === "customer.subscription.deleted" && orgId) {
      await updateOrgSubscription({
        orgId,
        subscriptionStatus: "canceled",
        stripeCustomerId: customerId,
        stripeSubscriptionId: getObjectString(event.data.object, "id"),
      });
      await notifySubscriptionIncident("canceled", orgId, getObjectString(event.data.object, "id"));
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "STRIPE_WEBHOOK_ERROR";
    const status = message.startsWith("STRIPE_SIGNATURE") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
