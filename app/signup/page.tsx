import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/src/components/ui/card";
import { EntitySignupForm } from "@/src/components/entity-signup-form";
import { getOwnerFromServerCookies } from "@/src/lib/firebase/auth";
import { ca } from "@/src/i18n/ca";

export default async function SignupPage() {
  const owner = await getOwnerFromServerCookies();
  if (owner) {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader className="space-y-1">
          <h1 className="text-xl font-semibold">{ca.signup.title}</h1>
          <p className="text-sm text-slate-600">{ca.signup.subtitle}</p>
        </CardHeader>
        <CardContent>
          <EntitySignupForm />
        </CardContent>
      </Card>
    </div>
  );
}
