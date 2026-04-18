import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/src/components/ui/button";
import { getRequestI18n } from "@/src/i18n/server";
import { withLocalePath } from "@/src/i18n/routing";
import {
  getAllMarketingPaths,
  getMarketingContent,
  getMarketingPageByKey,
  getMarketingPageBySlug,
} from "@/src/lib/marketing";
import { absoluteBaseUrl, localizedPublicMetadata } from "@/src/lib/seo";

type MarketingLandingPageProps = {
  params: Promise<{ slug: string }>;
};

const coreLandingKeys = new Set(["actes-ai", "boards", "calls-voting"]);

export function generateStaticParams() {
  return getAllMarketingPaths().map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: MarketingLandingPageProps): Promise<Metadata> {
  const { locale } = await getRequestI18n();
  const { slug } = await params;
  const landing = getMarketingPageBySlug(locale, slug);

  if (!landing) {
    return {};
  }

  const caLanding = getMarketingPageByKey("ca", landing.key);
  const esLanding = getMarketingPageByKey("es", landing.key);

  return localizedPublicMetadata({
    locale,
    path: `/${slug}`,
    alternatePaths: {
      ca: caLanding ? `/${caLanding.slug}` : undefined,
      es: esLanding ? `/${esLanding.slug}` : undefined,
      "x-default": caLanding ? `/${caLanding.slug}` : undefined,
    },
    title: landing.metaTitle,
    description: landing.metaDescription,
    keywords: landing.keywords,
    imagePath: "/media/hero/summareu-hero-poster.png",
  });
}

export default async function MarketingLandingPage({ params }: MarketingLandingPageProps) {
  const { locale } = await getRequestI18n();
  const { slug } = await params;
  const landing = getMarketingPageBySlug(locale, slug);

  if (!landing) {
    notFound();
  }

  const marketing = getMarketingContent(locale);
  const relatedPages = coreLandingKeys.has(landing.key)
    ? marketing.landings.filter((item) => coreLandingKeys.has(item.key) && item.slug !== landing.slug)
    : marketing.landings.filter((item) => coreLandingKeys.has(item.key));
  const softwareApplicationSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: landing.metaTitle.replace(" | Summa Reu", ""),
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: `${absoluteBaseUrl()}${withLocalePath(locale, `/${landing.slug}`)}`,
    description: landing.metaDescription,
    provider: {
      "@type": "Organization",
      name: "Summa Reu",
      url: absoluteBaseUrl(),
    },
    featureList: [...landing.bullets, ...landing.proofItems],
  };
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Summa Reu",
        item: `${absoluteBaseUrl()}${withLocalePath(locale, "/")}`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: landing.navLabel,
        item: `${absoluteBaseUrl()}${withLocalePath(locale, `/${landing.slug}`)}`,
      },
    ],
  };

  return (
    <div className="marketing-shell space-y-0 bg-[#f4f6f8]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <section className="relative overflow-hidden bg-[#07111d] text-white">
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 12% 18%, rgba(56,189,248,0.16), transparent 24%), radial-gradient(circle at 82% 12%, rgba(255,255,255,0.07), transparent 18%)",
          }}
        />
        <div className="relative mx-auto grid max-w-[1280px] gap-8 px-4 pb-14 pt-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.82fr)] lg:items-end lg:px-8 lg:pb-18 lg:pt-16">
          <div className="space-y-5">
            <p className="inline-flex rounded-full border border-white/12 bg-white/6 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-sky-100">
              {landing.eyebrow}
            </p>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl lg:text-[4rem] lg:leading-[0.95]">
              {landing.heroTitle}
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-slate-200 sm:text-xl">{landing.heroBody}</p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href={withLocalePath(locale, "/signup")}>
                <Button className="w-full rounded-full bg-sky-400 px-6 py-6 text-sm font-semibold text-slate-950 hover:bg-sky-300 sm:w-auto">
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

          <div className="marketing-panel rounded-[34px] p-7 shadow-[0_30px_110px_rgba(2,8,23,0.24)] lg:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-200">{landing.introTitle}</p>
            <p className="mt-5 text-base leading-8 text-slate-300">{landing.introBody}</p>
            <ul className="mt-6 space-y-4 text-sm leading-7 text-slate-200 sm:text-base">
              {landing.bullets.map((item) => (
                <li key={item} className="flex gap-4">
                  <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-sky-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="relative border-y border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1280px] flex-wrap gap-x-8 gap-y-4 px-4 py-5 text-sm text-slate-600 sm:px-6 lg:px-8">
          {landing.proofItems.map((item) => (
            <div key={item} className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="relative bg-[#f4f6f8]">
        <div className="mx-auto max-w-[1280px] px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
          <div className="max-w-3xl space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">{landing.navLabel}</p>
            <h2 className="text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-[2.8rem] sm:leading-[1.02]">
              {landing.introTitle}
            </h2>
            <p className="text-base leading-8 text-slate-600 sm:text-lg">{landing.introBody}</p>
          </div>

          <div className="mt-10 space-y-4">
            {landing.sections.map((section, index) => (
              <article
                key={section.title}
                className="grid gap-5 rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_20px_70px_rgba(15,23,42,0.06)] lg:grid-cols-[120px_minmax(0,1fr)] lg:items-start lg:p-8"
              >
                <div className="border-b border-slate-200 pb-4 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.26em] text-sky-700">
                    {(index + 1).toString().padStart(2, "0")}
                  </p>
                </div>
                <div className="grid gap-4 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1fr)] lg:gap-8">
                  <h3 className="text-2xl font-semibold tracking-[-0.03em] text-slate-950">{section.title}</h3>
                  <p className="text-sm leading-7 text-slate-600 sm:text-base">{section.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative bg-white">
        <div className="mx-auto grid max-w-[1280px] gap-6 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] lg:px-8 lg:py-18">
          <div className="rounded-[34px] bg-[#07111d] p-7 text-white shadow-[0_28px_100px_rgba(2,8,23,0.22)] lg:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-200">{landing.proofTitle}</p>
            <ul className="mt-6 space-y-4">
              {landing.proofItems.map((item) => (
                <li key={item} className="flex gap-4 text-sm leading-7 text-slate-200 sm:text-base">
                  <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-sky-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[34px] border border-slate-200 bg-[#f8fafc] p-7 shadow-[0_20px_70px_rgba(15,23,42,0.05)] lg:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">{landing.navLabel}</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-[2.7rem] sm:leading-[1.02]">
              {landing.ctaTitle}
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">{landing.ctaBody}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={withLocalePath(locale, "/signup")}>
                <Button className="w-full rounded-full bg-slate-950 px-6 py-6 text-sm font-semibold text-white hover:bg-slate-800 sm:w-auto">
                  {marketing.finalPrimaryCta}
                </Button>
              </Link>
              <Link href={withLocalePath(locale, "/")}>
                <Button variant="outline" className="w-full rounded-full px-6 py-6 text-sm font-medium sm:w-auto">
                  Summa Reu
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="relative bg-white">
        <div className="mx-auto max-w-[1280px] px-4 pb-20 sm:px-6 lg:px-8">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">{marketing.landingSectionEyebrow}</p>
            <h2 className="max-w-4xl text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-[2.8rem] sm:leading-[1.02]">
              {marketing.landingSectionTitle}
            </h2>
          </div>
          <div className={`mt-8 grid gap-4 ${relatedPages.length === 2 ? "lg:grid-cols-2" : "lg:grid-cols-3"}`}>
            {relatedPages.map((item) => (
              <Link
                key={item.slug}
                href={withLocalePath(locale, `/${item.slug}`)}
                className="rounded-[30px] border border-slate-200 bg-[#f8fafc] p-6 shadow-[0_20px_70px_rgba(15,23,42,0.05)] transition-transform hover:-translate-y-0.5"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">{item.eyebrow}</p>
                <h3 className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-slate-950">{item.navLabel}</h3>
                <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">{item.metaDescription}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
