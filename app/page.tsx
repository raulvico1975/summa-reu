import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { ca } from "@/src/i18n/ca";

export default function HomePage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-2">
          <span className="inline-flex w-fit rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
            {ca.home.badge}
          </span>
          <h1 className="break-words text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            {ca.home.title}
          </h1>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="break-words text-base text-slate-700">{ca.home.subtitle}</p>
          <p className="break-words text-sm text-slate-600">{ca.home.description}</p>
          <div className="grid gap-2 sm:flex sm:flex-wrap">
            <Link href="/login">
              <Button className="w-full sm:w-auto">{ca.home.ctaAccess}</Button>
            </Link>
            <Link href="/signup">
              <Button variant="secondary" className="w-full sm:w-auto">
                {ca.home.ctaSignup}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <h2 className="break-words text-base font-semibold">{ca.home.featurePollsTitle}</h2>
          </CardHeader>
          <CardContent>
            <p className="break-words text-sm text-slate-600">{ca.home.featurePollsBody}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="break-words text-base font-semibold">{ca.home.featureMinutesTitle}</h2>
          </CardHeader>
          <CardContent>
            <p className="break-words text-sm text-slate-600">{ca.home.featureMinutesBody}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="break-words text-base font-semibold">{ca.home.featurePrivacyTitle}</h2>
          </CardHeader>
          <CardContent>
            <p className="break-words text-sm text-slate-600">{ca.home.featurePrivacyBody}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
