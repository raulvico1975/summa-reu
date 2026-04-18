import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OwnerLoginForm } from "@/src/components/owner-login-form";
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
    <section className="relative left-1/2 -my-2 w-screen -translate-x-1/2 overflow-hidden px-4 py-2 sm:-my-4 sm:px-6 sm:py-3 lg:px-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-4rem] top-6 h-36 w-36 rounded-full bg-sky-100/70 blur-3xl" />
        <div className="absolute right-[8%] top-[6%] h-48 w-48 rounded-full bg-amber-100/60 blur-3xl" />
        <div className="absolute bottom-[-3rem] left-[18%] h-32 w-32 rounded-full bg-cyan-100/60 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-[1360px]">
        <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,0.98fr)_minmax(360px,0.68fr)] xl:gap-6">
          <section className="order-2 overflow-hidden rounded-[1.85rem] border border-slate-200/80 bg-gradient-to-br from-white via-sky-50/75 to-amber-50/60 p-5 shadow-[0_24px_70px_-50px_rgba(15,23,42,0.45)] sm:p-6 lg:order-1 lg:p-7">
            <div className="space-y-6">
              <div className="max-w-2xl space-y-3">
                <p className="inline-flex items-center rounded-full border border-white/80 bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-sky-700 shadow-sm">
                  {i18n.login.title}
                </p>
                <h1 className="max-w-[18ch] text-[2.1rem] font-black leading-[0.98] tracking-[-0.045em] text-slate-900 sm:text-[2.55rem] lg:text-[3.15rem] xl:text-[3.35rem]">
                  {i18n.login.subtitle}
                </h1>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <article className="rounded-[1.25rem] border border-white/80 bg-white/90 p-4 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.45)] backdrop-blur-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-700">01</p>
                  <p className="mt-2.5 text-sm leading-5 text-slate-600">{i18n.home.workflowStepOneBody}</p>
                </article>

                <article className="rounded-[1.25rem] border border-white/80 bg-white/90 p-4 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.45)] backdrop-blur-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">02</p>
                  <p className="mt-2.5 text-sm leading-5 text-slate-600">{i18n.home.workflowStepTwoBody}</p>
                </article>

                <article className="rounded-[1.25rem] border border-white/80 bg-white/90 p-4 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.45)] backdrop-blur-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700">03</p>
                  <p className="mt-2.5 text-sm leading-5 text-slate-600">{i18n.home.workflowStepThreeBody}</p>
                </article>
              </div>
            </div>
          </section>

          <section className="order-1 overflow-hidden rounded-[1.85rem] border border-slate-200/80 bg-white/96 shadow-[0_26px_80px_-42px_rgba(15,23,42,0.22)] lg:order-2">
            <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">{i18n.login.title}</p>
              <h2 className="mt-2.5 text-[1.35rem] font-semibold tracking-tight text-slate-900">{i18n.login.title}</h2>
              <p className="mt-1.5 max-w-md text-sm leading-5 text-slate-600">{i18n.login.subtitle}</p>
            </div>

            <div className="px-5 py-5 sm:px-6 sm:py-6">
              <OwnerLoginForm locale={locale} i18n={i18n} errorMessage={errorMessage} />
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
