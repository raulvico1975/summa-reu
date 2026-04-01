import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OwnerLoginForm } from "@/src/components/owner-login-form";
import { Card, CardContent, CardHeader } from "@/src/components/ui/card";
import { getOwnerFromServerCookies } from "@/src/lib/firebase/auth";
import { getRequestI18n } from "@/src/i18n/server";
import { withLocalePath } from "@/src/i18n/routing";
import { localizedPublicMetadata } from "@/src/lib/seo";

type LoginPageProps = {
  searchParams?: Promise<{ error?: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getRequestI18n();
  const title = locale === "es" ? "Acceso entidad | Summa Reu" : "Accés entitat | Summa Reu";
  const description =
    locale === "es"
      ? "Entrada al espacio privado de Summa Reu para gestionar convocatorias, reuniones y actas."
      : "Entrada a l'espai privat de Summa Reu per gestionar convocatòries, reunions i actes.";

  return localizedPublicMetadata({
    locale,
    path: "/login",
    title,
    description,
    robots: {
      index: false,
      follow: false,
    },
  });
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { locale, i18n } = await getRequestI18n();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const errorMessage =
    resolvedSearchParams?.error === "unauthorized" ? i18n.login.error : undefined;
  const owner = await getOwnerFromServerCookies();
  if (owner) {
    redirect(withLocalePath(locale, "/dashboard"));
  }

  return (
    <div className="mx-auto grid max-w-[1120px] gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,0.78fr)] lg:px-8">
      <section className="rounded-[32px] bg-[#07111d] p-8 text-white shadow-[0_28px_100px_rgba(2,8,23,0.22)] lg:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-200">{i18n.login.title}</p>
        <h1 className="mt-4 max-w-xl text-3xl font-semibold tracking-[-0.04em] text-white sm:text-[3rem] sm:leading-[1.02]">
          {i18n.login.subtitle}
        </h1>
        <ul className="mt-8 space-y-4 text-sm leading-7 text-slate-200 sm:text-base">
          <li className="flex gap-4">
            <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-sky-400" />
            <span>{i18n.home.workflowStepOneBody}</span>
          </li>
          <li className="flex gap-4">
            <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-sky-400" />
            <span>{i18n.home.workflowStepTwoBody}</span>
          </li>
          <li className="flex gap-4">
            <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-sky-400" />
            <span>{i18n.home.workflowStepThreeBody}</span>
          </li>
        </ul>
      </section>

      <Card className="border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
        <CardHeader className="space-y-1 border-b border-slate-100">
          <h1 className="text-xl font-semibold">{i18n.login.title}</h1>
          <p className="break-words text-sm text-slate-600">{i18n.login.subtitle}</p>
        </CardHeader>
        <CardContent>
          <OwnerLoginForm locale={locale} i18n={i18n} errorMessage={errorMessage} />
        </CardContent>
      </Card>
    </div>
  );
}
