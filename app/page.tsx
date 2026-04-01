import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/src/components/ui/button";
import { getRequestI18n } from "@/src/i18n/server";
import { withLocalePath } from "@/src/i18n/routing";
import { getMarketingContent } from "@/src/lib/marketing";
import { absoluteBaseUrl, localizedPublicMetadata } from "@/src/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { locale, i18n } = await getRequestI18n();
  return localizedPublicMetadata({
    locale,
    path: "/",
    title: `${i18n.home.title} | Summa Reu`,
    description: i18n.home.description,
  });
}

export default async function HomePage() {
  const { locale, i18n } = await getRequestI18n();
  const marketing = getMarketingContent(locale);
  const workflow = [
    {
      step: "01",
      title: i18n.home.workflowStepOneTitle,
      body: i18n.home.workflowStepOneBody,
    },
    {
      step: "02",
      title: i18n.home.workflowStepTwoTitle,
      body: i18n.home.workflowStepTwoBody,
    },
    {
      step: "03",
      title: i18n.home.workflowStepThreeTitle,
      body: i18n.home.workflowStepThreeBody,
    },
    {
      step: "04",
      title: i18n.home.workflowStepFourTitle,
      body: i18n.home.workflowStepFourBody,
    },
  ];
  const softwareApplicationSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: marketing.softwareSchemaName,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: `${absoluteBaseUrl()}${withLocalePath(locale, "/")}`,
    description: marketing.softwareSchemaDescription,
    audience: {
      "@type": "Audience",
      audienceType: locale === "ca" ? "Entitats, juntes directives i patronats" : "Entidades, juntas directivas y patronatos",
    },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "EUR",
    },
    provider: {
      "@type": "Organization",
      name: "Summa Reu",
      url: absoluteBaseUrl(),
    },
  };
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Summa Reu",
    url: absoluteBaseUrl(),
    logo: `${absoluteBaseUrl()}/icon.svg`,
  };

  return (
    <div className="space-y-0 bg-[#f4f6f8]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />

      <section className="relative overflow-hidden bg-[#07111d] text-white">
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 12% 18%, rgba(56,189,248,0.18), transparent 24%), radial-gradient(circle at 82% 12%, rgba(255,255,255,0.08), transparent 18%), radial-gradient(circle at 72% 72%, rgba(14,165,233,0.14), transparent 24%)",
          }}
        />
        <div className="relative mx-auto grid max-w-[1280px] gap-10 px-4 pb-18 pt-10 sm:px-6 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] lg:items-center lg:gap-14 lg:px-8 lg:pb-24 lg:pt-16">
          <div className="space-y-7">
            <div className="space-y-5">
              <p className="inline-flex rounded-full border border-white/12 bg-white/6 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-sky-100">
                {i18n.home.badge}
              </p>
              <div className="space-y-4">
                <h1 className="max-w-2xl text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl lg:text-[4.35rem] lg:leading-[0.94]">
                  {i18n.home.title}
                </h1>
                <p className="max-w-2xl text-lg leading-8 text-slate-200 sm:text-xl">{i18n.home.subtitle}</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href={withLocalePath(locale, "/signup")}>
                <Button className="w-full rounded-full bg-sky-400 px-6 py-6 text-sm font-semibold text-slate-950 shadow-[0_24px_70px_rgba(56,189,248,0.28)] hover:bg-sky-300 sm:w-auto">
                  {i18n.home.ctaSignup}
                </Button>
              </Link>
              <Link href={withLocalePath(locale, `/${marketing.landings[0].slug}`)}>
                <Button
                  variant="outline"
                  className="w-full rounded-full border-white/16 bg-white/5 px-6 py-6 text-sm font-medium text-white hover:bg-white/10 hover:text-white sm:w-auto"
                >
                  {marketing.landings[0].navLabel}
                </Button>
              </Link>
            </div>

            <p className="text-sm leading-6 text-slate-400">{i18n.home.heroNote}</p>
          </div>

          <div className="overflow-hidden rounded-[32px] border border-white/10 bg-slate-950/65 p-2 shadow-[0_40px_140px_rgba(2,8,23,0.5)]">
            <video
              className="block h-auto w-full rounded-[24px]"
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              poster="/media/hero/summareu-hero-poster.png"
            >
              <source src="/media/hero/summareu-hero-loop.mp4" type="video/mp4" />
            </video>
          </div>
        </div>
      </section>

      <section className="relative border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-[1280px] px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-wrap gap-x-8 gap-y-4 text-sm text-slate-600">
            {marketing.trustBand.map((item) => (
              <div key={item} className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
                <span>{item}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4">
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              {i18n.home.socialProofLabel}
            </span>
            {i18n.home.socialProofItems.map((item) => (
              <span
                key={item}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="relative bg-[#f4f6f8]">
        <div className="mx-auto max-w-[1280px] px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">{marketing.sectorsIntro}</p>
              <h2 className="max-w-4xl text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-[3rem] sm:leading-[1.02]">
                {marketing.sectorsTitle}
              </h2>
              <p className="max-w-3xl text-base leading-8 text-slate-600 sm:text-lg">{marketing.sectorsBody}</p>
            </div>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {marketing.landings.slice(0, 3).map((item) => (
              <Link
                key={item.slug}
                href={withLocalePath(locale, `/${item.slug}`)}
                className="group rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_20px_70px_rgba(15,23,42,0.05)] transition-transform hover:-translate-y-0.5"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">{item.eyebrow}</p>
                <h3 className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-slate-950">{item.heroTitle}</h3>
                <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">{item.metaDescription}</p>
                <div className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-slate-950">
                  <span>{item.navLabel}</span>
                  <span className="transition-transform group-hover:translate-x-1">→</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="relative bg-white">
        <div className="mx-auto grid max-w-[1280px] gap-6 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:px-8 lg:py-18">
          <div className="rounded-[34px] border border-slate-200 bg-white p-7 shadow-[0_26px_80px_rgba(15,23,42,0.08)] lg:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">{marketing.editorialEyebrow}</p>
            <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-[3rem] sm:leading-[1.02]">
              {marketing.editorialTitle}
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">{marketing.editorialBody}</p>
            <ul className="mt-8 space-y-4">
              {marketing.editorialBullets.map((item) => (
                <li key={item} className="flex gap-4 text-sm leading-7 text-slate-700 sm:text-base">
                  <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-sky-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[34px] bg-[#07111d] p-7 text-white shadow-[0_30px_110px_rgba(2,8,23,0.22)] lg:p-10">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-200">{i18n.home.pillarsEyebrow}</p>
              <h3 className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-white sm:text-[2.2rem] sm:leading-[1.04]">
                {i18n.home.pillarsTitle}
              </h3>
              <p className="mt-5 text-base leading-8 text-slate-300">{i18n.home.pillarsSubtitle}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <article className="rounded-[28px] border border-slate-200 bg-[#f8fafc] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">{i18n.home.featurePollsTitle}</p>
                <h3 className="mt-4 text-xl font-semibold tracking-[-0.03em] text-slate-950">{i18n.home.workflowStepOneTitle}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{i18n.home.featurePollsBody}</p>
              </article>
              <article className="rounded-[28px] border border-slate-200 bg-[#f8fafc] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">{i18n.home.featureMinutesTitle}</p>
                <h3 className="mt-4 text-xl font-semibold tracking-[-0.03em] text-slate-950">{i18n.home.workflowStepThreeTitle}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{i18n.home.featureMinutesBody}</p>
              </article>
              <article className="rounded-[28px] border border-slate-200 bg-[#f8fafc] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">{i18n.home.featurePrivacyTitle}</p>
                <h3 className="mt-4 text-xl font-semibold tracking-[-0.03em] text-slate-950">{i18n.home.workflowStepFourTitle}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{i18n.home.featurePrivacyBody}</p>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="relative bg-[#f4f6f8]">
        <div className="mx-auto max-w-[1280px] px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
                {i18n.home.useCasesEyebrow}
              </p>
              <h2 className="max-w-4xl text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-[3rem] sm:leading-[1.02]">
                {i18n.home.useCasesTitle}
              </h2>
              <p className="max-w-3xl text-base leading-8 text-slate-600 sm:text-lg">{i18n.home.useCasesSubtitle}</p>
            </div>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {marketing.landings.slice(3).map((item) => (
              <Link
                key={item.slug}
                href={withLocalePath(locale, `/${item.slug}`)}
                className="group rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_20px_70px_rgba(15,23,42,0.05)] transition-transform hover:-translate-y-0.5"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">{item.eyebrow}</p>
                <h3 className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-slate-950">{item.heroTitle}</h3>
                <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">{item.metaDescription}</p>
                <div className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-slate-950">
                  <span>{item.navLabel}</span>
                  <span className="transition-transform group-hover:translate-x-1">→</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="relative bg-[#07111d] text-white">
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 18% 18%, rgba(56,189,248,0.12), transparent 24%), radial-gradient(circle at 86% 12%, rgba(255,255,255,0.05), transparent 16%)",
          }}
        />
        <div className="relative mx-auto max-w-[1280px] px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
          <div className="space-y-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-200">
              {i18n.home.workflowEyebrow}
            </p>
            <h2 className="mx-auto max-w-4xl text-3xl font-semibold tracking-[-0.04em] text-white sm:text-[2.9rem] sm:leading-[1.02]">
              {i18n.home.workflowTitle}
            </h2>
            <p className="mx-auto max-w-3xl text-base leading-8 text-slate-300 sm:text-lg">
              {i18n.home.workflowSubtitle}
            </p>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-4">
            {workflow.map((step) => (
              <div
                key={step.step}
                className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_70px_rgba(2,8,23,0.28)]"
              >
                <p className="text-sm font-semibold tracking-[0.26em] text-sky-200">{step.step}</p>
                <h3 className="mt-5 text-2xl font-semibold tracking-[-0.03em] text-white">{step.title}</h3>
                <p className="mt-4 text-sm leading-7 text-slate-300 sm:text-base">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative bg-white">
        <div className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6 lg:px-8 lg:pb-24 lg:pt-14">
          <div className="relative overflow-hidden rounded-[36px] bg-[#07111d] px-6 py-10 text-white shadow-[0_36px_120px_rgba(2,8,23,0.28)] sm:px-8 lg:px-12 lg:py-14">
            <div
              aria-hidden="true"
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(circle at 18% 16%, rgba(56,189,248,0.15), transparent 20%), radial-gradient(circle at 82% 18%, rgba(255,255,255,0.08), transparent 14%)",
              }}
            />
            <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-200">
                  {marketing.finalEyebrow}
                </p>
                <h2 className="max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-white sm:text-[3rem] sm:leading-[1.02]">
                  {marketing.finalTitle}
                </h2>
                <p className="max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">{marketing.finalBody}</p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <Link href={withLocalePath(locale, "/signup")}>
                  <Button className="w-full rounded-full bg-sky-400 px-6 py-6 text-sm font-semibold text-slate-950 shadow-[0_18px_60px_rgba(56,189,248,0.3)] hover:bg-sky-300 sm:w-auto">
                    {marketing.finalPrimaryCta}
                  </Button>
                </Link>
                <Link href={withLocalePath(locale, "/login")}>
                  <Button
                    variant="outline"
                    className="w-full rounded-full border-white/16 bg-white/5 px-6 py-6 text-sm font-medium text-white hover:bg-white/10 hover:text-white sm:w-auto"
                  >
                    {marketing.finalSecondaryCta}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
