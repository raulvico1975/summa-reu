import crypto from "node:crypto";
import { getStripeEnv } from "@/src/lib/env";

type StripeCustomer = {
  id: string;
};

export type StripeCheckoutSession = {
  id: string;
  url: string | null;
  customer?: string | null;
  subscription?: string | null;
  client_reference_id?: string | null;
  metadata?: Record<string, string> | null;
};

export type StripeWebhookEvent = {
  id: string;
  type: string;
  created: number;
  data: {
    object: Record<string, unknown>;
  };
};

async function stripeFormRequest<T>(path: string, params: URLSearchParams): Promise<T> {
  const env = getStripeEnv();
  const response = await fetch(`https://api.stripe.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`STRIPE_API_ERROR:${response.status}:${body}`);
  }

  return (await response.json()) as T;
}

export async function createStripeCustomer(input: {
  orgId: string;
  orgName: string;
  email?: string | null;
}): Promise<StripeCustomer> {
  const params = new URLSearchParams();
  params.set("name", input.orgName);
  params.set("metadata[orgId]", input.orgId);
  if (input.email) {
    params.set("email", input.email);
  }

  return stripeFormRequest<StripeCustomer>("/v1/customers", params);
}

export async function createStripeCheckoutSession(input: {
  customerId: string;
  orgId: string;
}): Promise<StripeCheckoutSession> {
  const env = getStripeEnv();
  const params = new URLSearchParams();
  params.set("mode", "subscription");
  params.set("customer", input.customerId);
  params.set("success_url", env.successUrl);
  params.set("cancel_url", env.cancelUrl);
  params.set("client_reference_id", input.orgId);
  params.set("metadata[orgId]", input.orgId);
  params.set("line_items[0][price]", env.priceId);
  params.set("line_items[0][quantity]", "1");
  params.set("subscription_data[metadata][orgId]", input.orgId);

  return stripeFormRequest<StripeCheckoutSession>("/v1/checkout/sessions", params);
}

function safeCompare(input: string, expected: string): boolean {
  const inputBuffer = Buffer.from(input);
  const expectedBuffer = Buffer.from(expected);
  if (inputBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(inputBuffer, expectedBuffer);
}

export function verifyStripeWebhookSignature(
  payload: string,
  stripeSignature: string | null
): StripeWebhookEvent {
  const env = getStripeEnv();
  if (!stripeSignature) {
    throw new Error("STRIPE_SIGNATURE_MISSING");
  }

  const parts = stripeSignature.split(",").map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2) ?? "";
  const signatures = parts
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3))
    .filter(Boolean);

  if (!timestamp || signatures.length === 0) {
    throw new Error("STRIPE_SIGNATURE_INVALID");
  }

  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber) || Math.abs(Date.now() / 1000 - timestampNumber) > 300) {
    throw new Error("STRIPE_SIGNATURE_EXPIRED");
  }

  const expected = crypto
    .createHmac("sha256", env.webhookSecret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");

  const isValid = signatures.some((signature) => safeCompare(signature, expected));
  if (!isValid) {
    throw new Error("STRIPE_SIGNATURE_INVALID");
  }

  return JSON.parse(payload) as StripeWebhookEvent;
}
