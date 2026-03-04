import { redirect } from "next/navigation";
import { OwnerLoginForm } from "@/src/components/owner-login-form";
import { Card, CardContent, CardHeader } from "@/src/components/ui/card";
import { getOwnerFromServerCookies } from "@/src/lib/firebase/auth";
import { ca } from "@/src/i18n/ca";

export default async function LoginPage() {
  const owner = await getOwnerFromServerCookies();
  if (owner) {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <h1 className="text-xl font-semibold">{ca.login.title}</h1>
        </CardHeader>
        <CardContent>
          <OwnerLoginForm />
        </CardContent>
      </Card>
    </div>
  );
}
