import { redirect } from "next/navigation";
import { getOwnerFromServerCookies } from "@/src/lib/firebase/auth";
import type { OwnerContext } from "@/src/lib/firebase/auth";
import { getRequestI18n } from "@/src/i18n/server";
import { withLocalePath } from "@/src/i18n/routing";
import { ActivateSubscriptionButton } from "@/src/components/billing/activate-subscription-button";
import {
  getBillingGraceDaysRemaining,
  isBillingGraceActive,
} from "@/src/lib/billing/subscription";
import type { OrgSubscriptionStatus } from "@/src/lib/db/types";

const statusKeys = {
  none: "subscriptionNone",
  pending: "subscriptionPending",
  active: "subscriptionActive",
  past_due: "subscriptionPastDue",
  canceled: "subscriptionCanceled",
} as const;

type BillingPageProps = {
  searchParams?: Promise<{ preview?: string; status?: OrgSubscriptionStatus }>;
};

function getPreviewOwner(status: OrgSubscriptionStatus = "none"): OwnerContext {
  return {
    uid: "preview-owner",
    orgId: "preview-org",
    orgName: "Associacio Exemple",
    subscriptionStatus: status,
    subscriptionPastDueAt: status === "past_due" ? Date.now() - 2 * 24 * 60 * 60 * 1000 : null,
    plan: "basic",
    recordingLimitMinutes: 90,
  };
}

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const { locale, i18n } = await getRequestI18n();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const previewRequested =
    process.env.NODE_ENV !== "production" && resolvedSearchParams?.preview === "1";
  const previewStatus = resolvedSearchParams?.status;
  const owner =
    (previewRequested ? getPreviewOwner(previewStatus) : null) ?? (await getOwnerFromServerCookies());
  if (!owner) {
    redirect(withLocalePath(locale, "/login"));
  }
  if (owner.subscriptionStatus === "active" && !previewRequested) {
    redirect(withLocalePath(locale, "/dashboard"));
  }

  const { billing } = i18n;
  const statusLabel =
    billing[statusKeys[owner.subscriptionStatus as keyof typeof statusKeys] ?? "subscriptionNone"];
  const graceActive = isBillingGraceActive(owner);
  const graceDaysRemaining = getBillingGraceDaysRemaining(owner.subscriptionPastDueAt);
  const billingHint =
    owner.subscriptionStatus === "past_due"
      ? graceActive
        ? billing.pastDueGrace.replaceAll("{days}", String(graceDaysRemaining || 3))
        : billing.pastDueExpired
      : billing.hint;
  const isPastDue = owner.subscriptionStatus === "past_due";

  return (
    <section className="relative left-1/2 -my-2 w-screen -translate-x-1/2 overflow-hidden px-4 py-2 sm:-my-4 sm:px-6 sm:py-3 lg:px-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-4rem] top-6 h-36 w-36 rounded-full bg-sky-100/70 blur-3xl" />
        <div className="absolute right-[8%] top-[6%] h-48 w-48 rounded-full bg-amber-100/60 blur-3xl" />
        <div className="absolute bottom-[-3rem] left-[18%] h-32 w-32 rounded-full bg-cyan-100/60 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-[1320px]">
        <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,0.98fr)_minmax(360px,0.68fr)] xl:gap-6">
          <section
            className={`order-2 overflow-hidden rounded-[1.85rem] border p-5 shadow-[0_24px_70px_-50px_rgba(15,23,42,0.45)] sm:p-6 lg:order-1 lg:p-7 ${
              isPastDue
                ? "border-amber-200/90 bg-gradient-to-br from-white via-amber-50/80 to-orange-50/65"
                : "border-slate-200/80 bg-gradient-to-br from-white via-sky-50/75 to-amber-50/60"
            }`}
          >
            <div className="space-y-6">
              <div className="max-w-2xl space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="inline-flex items-center rounded-full border border-white/80 bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-sky-700 shadow-sm">
                    {billing.title}
                  </p>
                  <p className="inline-flex items-center rounded-full border border-white/80 bg-white/75 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
                    {owner.orgName}
                  </p>
                </div>
                <h1 className="max-w-[16ch] text-[2.1rem] font-black leading-[0.98] tracking-[-0.045em] text-slate-900 sm:text-[2.55rem] lg:text-[3.05rem] xl:text-[3.25rem]">
                  {billing.title}
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-slate-600 sm:text-[0.95rem]">
                  {billing.subtitle}
                </p>
              </div>

              <div
                className={`inline-flex max-w-full rounded-full border px-4 py-2 text-sm font-medium shadow-sm ${
                  isPastDue
                    ? "border-amber-200 bg-white/85 text-amber-900"
                    : "border-white/80 bg-white/85 text-slate-700"
                }`}
              >
                {billing.hint}
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <article className="rounded-[1.25rem] border border-white/80 bg-white/90 p-4 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.45)] backdrop-blur-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-700">01</p>
                  <p className="mt-2.5 text-sm leading-5 text-slate-600">{i18n.signup.benefitOne}</p>
                </article>
                <article className="rounded-[1.25rem] border border-white/80 bg-white/90 p-4 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.45)] backdrop-blur-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">02</p>
                  <p className="mt-2.5 text-sm leading-5 text-slate-600">{i18n.signup.benefitTwo}</p>
                </article>
                <article className="rounded-[1.25rem] border border-white/80 bg-white/90 p-4 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.45)] backdrop-blur-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700">03</p>
                  <p className="mt-2.5 text-sm leading-5 text-slate-600">{i18n.signup.benefitThree}</p>
                </article>
              </div>
            </div>
          </section>

          <section className="order-1 overflow-hidden rounded-[1.85rem] border border-slate-200/80 bg-white/96 shadow-[0_26px_80px_-42px_rgba(15,23,42,0.22)] lg:order-2">
            <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
              <div className="flex flex-wrap items-center gap-2">
                <p
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] ${
                    isPastDue
                      ? "border-amber-200 bg-amber-100 text-amber-800"
                      : "border-slate-200 bg-slate-100 text-slate-700"
                  }`}
                >
                  {billing.status}
                </p>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{owner.orgName}</p>
              </div>
              <h2 className="mt-2.5 text-[1.35rem] font-semibold tracking-tight text-slate-900">{billing.title}</h2>
              <p className="mt-1.5 max-w-md text-sm leading-5 text-slate-600">{billing.subtitle}</p>
            </div>

            <div className="space-y-4 px-5 py-5 sm:px-6 sm:py-6">
              <div
                className={`rounded-[1.2rem] border p-4 ${
                  isPastDue
                    ? "border-amber-200 bg-amber-50/70 text-amber-950"
                    : "border-slate-200 bg-slate-50/80 text-slate-700"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-medium text-slate-900">{billing.status}</p>
                  <p className="text-sm font-semibold text-slate-900">{statusLabel}</p>
                </div>
                <p className="mt-2 text-sm leading-6">{billingHint}</p>
              </div>

              <ActivateSubscriptionButton
                label={billing.cta}
                loadingLabel={billing.loading}
                fallbackError={billing.fallbackError}
              />
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
