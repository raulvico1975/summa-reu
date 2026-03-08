import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/src/components/ui/card";
import { getOwnerFromServerCookies } from "@/src/lib/firebase/auth";
import { getRequestI18n } from "@/src/i18n/server";
import { withLocalePath } from "@/src/i18n/routing";
import { ActivateSubscriptionButton } from "@/src/components/billing/activate-subscription-button";

const copy = {
  ca: {
    title: "Activa la subscripció",
    subtitle: "Sense subscripció activa no pots fer servir Summa Reu.",
    status: "Estat actual",
    cta: "Activar subscripció",
    loading: "Redirigint a Stripe...",
    fallbackError: "No s'ha pogut obrir el checkout.",
    hint: "Pla basic · 39 €/mes · límit tècnic de 90 minuts de gravació.",
  },
  es: {
    title: "Activa la suscripción",
    subtitle: "Sin suscripción activa no puedes usar Summa Reu.",
    status: "Estado actual",
    cta: "Activar suscripción",
    loading: "Redirigiendo a Stripe...",
    fallbackError: "No se ha podido abrir el checkout.",
    hint: "Plan basic · 39 €/mes · límite técnico de 90 minutos de grabación.",
  },
} as const;

function formatStatus(locale: "ca" | "es", status: string): string {
  const labels = {
    ca: {
      none: "sense subscripció",
      pending: "pendent",
      active: "activa",
      past_due: "pagament pendent",
      canceled: "cancel·lada",
    },
    es: {
      none: "sin suscripción",
      pending: "pendiente",
      active: "activa",
      past_due: "pago pendiente",
      canceled: "cancelada",
    },
  } as const;

  return labels[locale][status as keyof (typeof labels)["ca"]] ?? status;
}

export default async function BillingPage() {
  const { locale } = await getRequestI18n();
  const owner = await getOwnerFromServerCookies();
  if (!owner) {
    redirect(withLocalePath(locale, "/login"));
  }
  if (owner.subscriptionStatus === "active") {
    redirect(withLocalePath(locale, "/dashboard"));
  }

  const text = copy[locale];

  return (
    <div className="mx-auto max-w-md">
      <Card className="border-slate-200">
        <CardHeader className="space-y-1">
          <h1 className="text-xl font-semibold">{text.title}</h1>
          <p className="break-words text-sm text-slate-600">{text.subtitle}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-900">{owner.orgName}</p>
            <p className="mt-1 text-sm text-slate-600">
              {text.status}: {formatStatus(locale, owner.subscriptionStatus)}
            </p>
            <p className="mt-2 text-xs text-slate-500">{text.hint}</p>
          </div>
          <ActivateSubscriptionButton
            label={text.cta}
            loadingLabel={text.loading}
            fallbackError={text.fallbackError}
          />
        </CardContent>
      </Card>
    </div>
  );
}
