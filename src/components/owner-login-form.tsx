import Link from "next/link";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/field";
import type { I18nLocale } from "@/src/i18n/config";
import { withLocalePath } from "@/src/i18n/routing";
import type { getI18n } from "@/src/i18n";

type OwnerLoginFormProps = {
  locale: I18nLocale;
  i18n: ReturnType<typeof getI18n>;
  errorMessage?: string;
};

export function OwnerLoginForm({ locale, i18n, errorMessage }: OwnerLoginFormProps) {
  return (
    <form className="space-y-4" method="post" action="/api/auth/password-login">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">{i18n.login.email}</label>
        <Input type="email" name="email" autoComplete="email" required />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">{i18n.login.password}</label>
        <Input type="password" name="password" autoComplete="current-password" required />
      </div>

      {errorMessage ? <p className="break-words text-sm text-red-600">{errorMessage}</p> : null}

      <Button type="submit" className="w-full">
        {i18n.login.submit}
      </Button>

      <Link
        href={withLocalePath(locale, "/signup")}
        className="block break-words text-sm font-medium text-sky-700 hover:underline"
      >
        {i18n.login.signupCta}
      </Link>
    </form>
  );
}
