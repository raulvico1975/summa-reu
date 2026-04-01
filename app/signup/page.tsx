import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/src/components/ui/card";
import { EntitySignupForm } from "@/src/components/entity-signup-form";
import { getOwnerFromServerCookies } from "@/src/lib/firebase/auth";
import { getRequestI18n } from "@/src/i18n/server";
import { withLocalePath } from "@/src/i18n/routing";
import { localizedPublicMetadata } from "@/src/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getRequestI18n();
  const title =
    locale === "es" ? "Activar espacio de entidad | Summa Reu" : "Activar espai d'entitat | Summa Reu";
  const description =
    locale === "es"
      ? "Crea el espacio privado de Summa Reu para convocatorias, reuniones y actas con IA."
      : "Crea l'espai privat de Summa Reu per a convocatòries, reunions i actes amb IA.";

  return localizedPublicMetadata({
    locale,
    path: "/signup",
    title,
    description,
    robots: {
      index: false,
      follow: false,
    },
  });
}

export default async function SignupPage() {
  const { locale, i18n } = await getRequestI18n();
  const owner = await getOwnerFromServerCookies();
  if (owner) {
    redirect(withLocalePath(locale, "/dashboard"));
  }

  return (
    <div className="mx-auto grid max-w-[1160px] gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)] lg:px-8">
      <section className="rounded-[32px] bg-[#07111d] p-8 text-white shadow-[0_28px_100px_rgba(2,8,23,0.22)] lg:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-200">{i18n.signup.planTitle}</p>
        <h1 className="mt-4 max-w-xl text-3xl font-semibold tracking-[-0.04em] text-white sm:text-[3rem] sm:leading-[1.02]">
          {i18n.signup.title}
        </h1>
        <p className="mt-5 max-w-xl text-base leading-8 text-slate-300 sm:text-lg">{i18n.signup.subtitle}</p>
        <ul className="mt-8 space-y-4 text-sm leading-7 text-slate-200 sm:text-base">
          <li className="flex gap-4">
            <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-sky-400" />
            <span>{i18n.signup.benefitOne}</span>
          </li>
          <li className="flex gap-4">
            <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-sky-400" />
            <span>{i18n.signup.benefitTwo}</span>
          </li>
          <li className="flex gap-4">
            <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-sky-400" />
            <span>{i18n.signup.benefitThree}</span>
          </li>
        </ul>
      </section>

      <Card className="border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
        <CardHeader className="space-y-1 border-b border-slate-100">
          <h1 className="text-2xl font-semibold tracking-[-0.03em] text-slate-950">{i18n.signup.title}</h1>
          <p className="max-w-xl break-words text-sm leading-7 text-slate-600">{i18n.signup.subtitle}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-[24px] border border-slate-200 bg-[#f8fafc] p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">
              {i18n.signup.planTitle}
            </p>
            <p className="mt-3 break-words text-sm leading-7 text-slate-600">{i18n.signup.planBody}</p>
          </div>
          <ul className="grid gap-3 text-sm text-slate-700 sm:grid-cols-3">
            <li className="rounded-[20px] border border-slate-200 bg-white px-4 py-4">{i18n.signup.benefitOne}</li>
            <li className="rounded-[20px] border border-slate-200 bg-white px-4 py-4">{i18n.signup.benefitTwo}</li>
            <li className="rounded-[20px] border border-slate-200 bg-white px-4 py-4">{i18n.signup.benefitThree}</li>
          </ul>
          <EntitySignupForm />
        </CardContent>
      </Card>
    </div>
  );
}
