export type StripeEnv = {
  secretKey: string;
  webhookSecret: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
};

export function getStripeEnv(): StripeEnv {
  const env = {
    secretKey: process.env.STRIPE_SECRET_KEY ?? "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
    priceId: process.env.STRIPE_PRICE_ID ?? "",
    successUrl: process.env.STRIPE_SUCCESS_URL ?? "https://summareu.app/dashboard",
    cancelUrl: process.env.STRIPE_CANCEL_URL ?? "https://summareu.app/signup",
  };

  if (
    process.env.NODE_ENV === "production" &&
    (!env.secretKey || !env.webhookSecret || !env.priceId)
  ) {
    throw new Error("Stripe not configured");
  }

  return env;
}
