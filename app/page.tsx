import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardHeader } from "@/src/components/ui/card";
import { getRequestI18n } from "@/src/i18n/server";
import { withLocalePath } from "@/src/i18n/routing";
import { localizedPublicMetadata } from "@/src/lib/seo";

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

  return (
    <div className="space-y-8 sm:space-y-10">
      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 sm:p-7">
        <p className="inline-flex w-fit rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
          {i18n.home.badge}
        </p>
        <h1 className="break-words text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          {i18n.home.title}
        </h1>
        <p className="break-words text-base text-slate-700">{i18n.home.subtitle}</p>
        <p className="break-words text-sm text-slate-600">{i18n.home.description}</p>
        <div className="grid gap-2 sm:flex sm:flex-wrap">
          <Link href={withLocalePath(locale, "/signup")}>
            <Button className="w-full sm:w-auto">{i18n.home.ctaSignup}</Button>
          </Link>
        </div>
        <p className="text-xs text-slate-500">{i18n.home.paymentHint}</p>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <h2 className="break-words text-base font-semibold">{i18n.home.featurePollsTitle}</h2>
          </CardHeader>
          <CardContent>
            <p className="break-words text-sm text-slate-600">{i18n.home.featurePollsBody}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="break-words text-base font-semibold">{i18n.home.featureMinutesTitle}</h2>
          </CardHeader>
          <CardContent>
            <p className="break-words text-sm text-slate-600">{i18n.home.featureMinutesBody}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="break-words text-base font-semibold">{i18n.home.featurePrivacyTitle}</h2>
          </CardHeader>
          <CardContent>
            <p className="break-words text-sm text-slate-600">{i18n.home.featurePrivacyBody}</p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
