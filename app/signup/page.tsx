import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { getOwnerFromServerCookies } from "@/src/lib/firebase/auth";
import { getRequestI18n } from "@/src/i18n/server";
import { withLocalePath } from "@/src/i18n/routing";

export default async function SignupPage() {
  const { locale, i18n } = await getRequestI18n();
  const owner = await getOwnerFromServerCookies();
  if (owner) {
    redirect(withLocalePath(locale, "/dashboard"));
  }

  return (
    <div className="mx-auto max-w-md">
      <Card className="border-sky-100">
        <CardHeader className="space-y-1">
          <h1 className="text-xl font-semibold">{i18n.signup.title}</h1>
          <p className="break-words text-sm text-slate-600">{i18n.signup.subtitle}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-900">{i18n.signup.planTitle}</p>
            <p className="mt-1 break-words text-sm text-slate-600">{i18n.signup.planBody}</p>
          </div>
          <ul className="space-y-2 text-sm text-slate-700">
            <li>- {i18n.signup.benefitOne}</li>
            <li>- {i18n.signup.benefitTwo}</li>
            <li>- {i18n.signup.benefitThree}</li>
          </ul>
          <Button className="w-full" disabled>
            {i18n.signup.paymentCta}
          </Button>
          <p className="break-words text-xs text-slate-500">{i18n.signup.paymentNote}</p>
        </CardContent>
      </Card>
    </div>
  );
}
