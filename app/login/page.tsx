import { redirect } from "next/navigation";
import { OwnerLoginForm } from "@/src/components/owner-login-form";
import { Card, CardContent, CardHeader } from "@/src/components/ui/card";
import { getOwnerFromServerCookies } from "@/src/lib/firebase/auth";
import { getRequestI18n } from "@/src/i18n/server";
import { withLocalePath } from "@/src/i18n/routing";

type LoginPageProps = {
  searchParams?: Promise<{ error?: string }> | { error?: string };
};

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
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader className="space-y-1">
          <h1 className="text-xl font-semibold">{i18n.login.title}</h1>
          <p className="break-words text-sm text-slate-600">{i18n.login.subtitle}</p>
        </CardHeader>
        <CardContent>
          <OwnerLoginForm locale={locale} i18n={i18n} errorMessage={errorMessage} />
        </CardContent>
      </Card>
    </div>
  );
}
