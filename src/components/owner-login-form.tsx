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
        <label className="mb-1.5 block text-sm font-medium text-slate-700">{i18n.login.email}</label>
        <Input
          type="email"
          name="email"
          autoComplete="email"
          required
          className="rounded-xl border-slate-200 bg-slate-50/70 px-4 py-2.5 text-base shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)]"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">{i18n.login.password}</label>
        <Input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          className="rounded-xl border-slate-200 bg-slate-50/70 px-4 py-2.5 text-base shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)]"
        />
      </div>

      {errorMessage ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 break-words text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}

      <Button type="submit" className="h-11 w-full rounded-xl text-base font-semibold">
        {i18n.login.submit}
      </Button>

      <Link
        href={withLocalePath(locale, "/signup")}
        className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-sm font-medium text-sky-700 transition-colors hover:bg-slate-100"
      >
        {i18n.login.signupCta}
      </Link>
    </form>
  );
}
