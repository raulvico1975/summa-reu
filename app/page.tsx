import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardHeader } from "@/src/components/ui/card";
import { getRequestI18n } from "@/src/i18n/server";
import { withLocalePath } from "@/src/i18n/routing";
import { localizedPublicMetadata } from "@/src/lib/seo";

function CalendarIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 3v3M16 3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
    </svg>
  );
}

function MeetingIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM17 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM3.5 18a3.5 3.5 0 0 1 7 0M13.5 18a3.5 3.5 0 0 1 7 0M10.5 18a4.5 4.5 0 0 1 3-4.24" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3ZM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15ZM6 14l1 2.5L9.5 17 7 18l-1 2.5L5 18l-2.5-1 2.5-.5L6 14Z" />
    </svg>
  );
}

function ArchiveIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7.5h16M6 4h12a1 1 0 0 1 1 1v3H5V5a1 1 0 0 1 1-1ZM6 9h12v9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9Zm4 4h4" />
    </svg>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const { locale, i18n } = await getRequestI18n();
  return localizedPublicMetadata({
    locale,
    path: "/",
    title: i18n.home.title,
    description: i18n.home.subtitle,
  });
}

export default async function HomePage() {
  const { locale, i18n } = await getRequestI18n();
  const heroPreview =
    locale === "ca"
      ? {
          eyebrow: "Summa Reu  Com funciona",
          imageAlt: "Captura de pantalla de Summa Reu",
        }
      : {
          eyebrow: "Summa Reu  Cómo funciona",
          imageAlt: "Captura de pantalla de Summa Reu",
        };
  const heroPreviewImage = "/media/hero/summareu-hero-poster.png";
  const workflowIntro =
    locale === "ca"
      ? {
          badge: "Procés complet",
          title: "De la convocatòria a l'arxiu, tot queda connectat",
          description:
            "Cada pas prepara el següent perquè la reunió avanci amb continuïtat, sense salts manuals ni eines disperses.",
        }
      : {
          badge: "Proceso completo",
          title: "De la convocatoria al archivo, todo queda conectado",
          description:
            "Cada paso prepara el siguiente para que la reunión avance con continuidad, sin saltos manuales ni herramientas dispersas.",
        };
  const steps = [
    {
      step: "01",
      title: i18n.home.workflowStepOneTitle,
      body: i18n.home.workflowStepOneBody,
      icon: <CalendarIcon />,
      accent: "from-sky-500 via-cyan-400 to-sky-300",
      surface: "from-sky-50 via-white to-white",
      iconTone: "border-sky-200 bg-sky-100 text-sky-700",
      ringTone: "bg-sky-500/14 text-sky-700",
    },
    {
      step: "02",
      title: i18n.home.workflowStepTwoTitle,
      body: i18n.home.workflowStepTwoBody,
      icon: <MeetingIcon />,
      accent: "from-emerald-500 via-teal-400 to-emerald-300",
      surface: "from-emerald-50 via-white to-white",
      iconTone: "border-emerald-200 bg-emerald-100 text-emerald-700",
      ringTone: "bg-emerald-500/14 text-emerald-700",
    },
    {
      step: "03",
      title: i18n.home.workflowStepThreeTitle,
      body: i18n.home.workflowStepThreeBody,
      icon: <SparkIcon />,
      accent: "from-amber-500 via-orange-400 to-amber-300",
      surface: "from-amber-50 via-white to-white",
      iconTone: "border-amber-200 bg-amber-100 text-amber-700",
      ringTone: "bg-amber-500/14 text-amber-700",
    },
    {
      step: "04",
      title: i18n.home.workflowStepFourTitle,
      body: i18n.home.workflowStepFourBody,
      icon: <ArchiveIcon />,
      accent: "from-rose-500 via-orange-400 to-amber-300",
      surface: "from-rose-50 via-white to-white",
      iconTone: "border-rose-200 bg-rose-100 text-rose-700",
      ringTone: "bg-rose-500/14 text-rose-700",
    },
  ];

  return (
    <div className="space-y-6">
      <section className="relative left-1/2 w-screen -translate-x-1/2 overflow-hidden bg-white px-4 py-2 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[-5rem] top-[-3rem] h-48 w-48 rounded-full bg-sky-100/80 blur-3xl" />
          <div className="absolute right-[10%] top-[8%] h-64 w-64 rounded-full bg-amber-100/70 blur-3xl" />
          <div className="absolute bottom-[-5rem] right-[-2rem] h-56 w-56 rounded-full bg-cyan-100/70 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-[1380px]">
          <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-12 xl:gap-16">
            <div className="min-w-0 px-2 py-6 text-center lg:px-0 lg:py-10 lg:text-left">
              <CardHeader className="space-y-3 border-b-0 px-0 pt-0 sm:px-0 sm:pt-0">
                <p className="inline-flex w-fit rounded-full border border-slate-200 bg-white/92 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm">
                {i18n.home.badge}
                </p>
                <h1 className="max-w-[18ch] break-words text-[2.65rem] font-black leading-[0.98] tracking-[-0.04em] text-slate-900 sm:text-[3.25rem] lg:text-[4.1rem] 2xl:text-[4.85rem]">
                  {i18n.home.title}
                </h1>
              </CardHeader>
              <CardContent className="max-w-xl space-y-6 px-0 pt-0 sm:px-0">
                <p className="text-lg leading-8 text-slate-700 sm:text-xl">{i18n.home.subtitle}</p>
                <p className="text-sm leading-7 text-slate-600 sm:text-base">{i18n.home.description}</p>
                <div className="grid gap-2 sm:flex sm:flex-wrap sm:justify-center lg:justify-start">
                  <Link href={withLocalePath(locale, "/login")}>
                    <Button className="w-full sm:w-auto">{i18n.home.ctaAccess}</Button>
                  </Link>
                  <Link href={withLocalePath(locale, "/signup")}>
                    <Button variant="secondary" className="w-full sm:w-auto">
                      {i18n.home.ctaSignup}
                    </Button>
                  </Link>
                </div>
                <p className="text-xs text-slate-500">{i18n.home.paymentHint}</p>
              </CardContent>
            </div>

            <div className="min-w-0 lg:translate-y-3">
              <p className="text-center text-xs font-semibold uppercase tracking-[0.24em] text-sky-700 lg:px-6 lg:text-left">
                {heroPreview.eyebrow}
              </p>
              <div className="mt-4 rounded-[32px] border border-slate-200/80 bg-white/96 p-4 shadow-[0_34px_90px_-42px_rgba(15,23,42,0.34)] sm:p-5 lg:ml-auto lg:max-w-[740px]">
                <div className="flex items-center gap-2 border-b border-slate-200 px-2 pb-4">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
                </div>
                <div className="pt-4">
                  <Image
                    src={heroPreviewImage}
                    alt={heroPreview.imageAlt}
                    width={1440}
                    height={960}
                    priority
                    className="h-auto w-full rounded-[24px] border border-slate-200 object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative left-1/2 w-screen -translate-x-1/2 overflow-hidden px-4 py-4 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-10 top-10 h-40 w-40 rounded-full bg-sky-200/30 blur-3xl" />
          <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-amber-200/30 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-[1380px] overflow-hidden rounded-[2rem] border border-slate-200/80 bg-gradient-to-br from-white via-sky-50/80 to-amber-50/80 p-5 shadow-[0_24px_70px_-50px_rgba(15,23,42,0.45)] sm:p-7 lg:p-10">
          <div className="pointer-events-none absolute -left-14 top-8 h-36 w-36 rounded-full bg-sky-200/40 blur-3xl" />
          <div className="pointer-events-none absolute -right-10 bottom-0 h-40 w-40 rounded-full bg-amber-200/35 blur-3xl" />
          <div className="relative space-y-8">
            <div className="max-w-3xl space-y-3">
              <p className="inline-flex w-fit items-center rounded-full border border-white/80 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700 shadow-sm">
                {workflowIntro.badge}
              </p>
              <div className="space-y-2">
                <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-[2.35rem]">
                  {workflowIntro.title}
                </h2>
                <p className="max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                  {workflowIntro.description}
                </p>
              </div>
            </div>

            <div className="relative">
              <div className="pointer-events-none absolute left-[10%] right-[10%] top-10 hidden h-px bg-gradient-to-r from-sky-200 via-slate-300 to-amber-200 xl:block" />
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                {steps.map((step) => (
                  <Card
                    key={step.step}
                    className="relative flex h-full flex-col overflow-hidden rounded-[1.4rem] border border-white/80 bg-white/90 shadow-[0_16px_40px_-32px_rgba(15,23,42,0.6)] backdrop-blur-sm"
                  >
                    <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${step.accent}`} />
                    <CardHeader className={`grid gap-4 border-b border-slate-200/80 bg-gradient-to-b ${step.surface} md:h-[11rem] md:grid-rows-[auto_1fr] xl:h-[12rem]`}>
                      <div className="flex items-center justify-between gap-3">
                        <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl border shadow-sm ${step.iconTone}`}>
                          {step.icon}
                        </span>
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.2em] shadow-sm ${step.ringTone}`}>
                          {step.step}
                        </span>
                      </div>
                      <h2 className="break-words text-lg font-semibold leading-snug text-slate-900">
                        {step.title}
                      </h2>
                    </CardHeader>
                    <CardContent className="flex-1 bg-white/75 pt-5">
                      <p className="break-words text-sm leading-6 text-slate-600">{step.body}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
