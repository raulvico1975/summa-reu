import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { getOwnerFromServerCookies } from "@/src/lib/firebase/auth";
import { ca } from "@/src/i18n/ca";

export default async function SignupPage() {
  const owner = await getOwnerFromServerCookies();
  if (owner) {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto max-w-md">
      <Card className="border-sky-100">
        <CardHeader className="space-y-1">
          <h1 className="text-xl font-semibold">{ca.signup.title}</h1>
          <p className="break-words text-sm text-slate-600">{ca.signup.subtitle}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-900">{ca.signup.planTitle}</p>
            <p className="mt-1 break-words text-sm text-slate-600">{ca.signup.planBody}</p>
          </div>
          <ul className="space-y-2 text-sm text-slate-700">
            <li>- {ca.signup.benefitOne}</li>
            <li>- {ca.signup.benefitTwo}</li>
            <li>- {ca.signup.benefitThree}</li>
          </ul>
          <Button className="w-full" disabled>
            {ca.signup.paymentCta}
          </Button>
          <p className="break-words text-xs text-slate-500">{ca.signup.paymentNote}</p>
        </CardContent>
      </Card>
    </div>
  );
}
