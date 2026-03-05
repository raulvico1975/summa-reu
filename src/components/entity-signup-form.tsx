"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { clientAuth } from "@/src/lib/firebase/client";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/field";
import { useI18n } from "@/src/i18n/client";
import { withLocalePath } from "@/src/i18n/routing";

type State = {
  loading: boolean;
  error?: string;
};

export function EntitySignupForm() {
  const { locale, i18n } = useI18n();
  const router = useRouter();
  const [orgName, setOrgName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<State>({ loading: false });

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ loading: true });

    try {
      const signupRes = await fetch("/api/auth/entity-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgName,
          contactName,
          email,
          password,
        }),
      });

      const signupData = (await signupRes.json()) as { ok?: boolean; error?: string };
      if (!signupRes.ok || !signupData.ok) {
        throw new Error(signupData.error ?? i18n.signup.error);
      }

      const credential = await signInWithEmailAndPassword(clientAuth, email, password);
      const idToken = await credential.user.getIdToken();

      const sessionRes = await fetch("/api/auth/session-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!sessionRes.ok) {
        throw new Error(i18n.errors.unauthorized);
      }

      router.push(withLocalePath(locale, "/dashboard"));
      router.refresh();
    } catch (error) {
      setState({
        loading: false,
        error: error instanceof Error ? error.message : i18n.signup.error,
      });
    }
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">{i18n.signup.orgName}</label>
        <Input required value={orgName} onChange={(event) => setOrgName(event.target.value)} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">{i18n.signup.contactName}</label>
        <Input required value={contactName} onChange={(event) => setContactName(event.target.value)} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">{i18n.signup.email}</label>
        <Input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">{i18n.signup.password}</label>
        <Input type="password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} />
      </div>

      {state.error ? <p className="break-words text-sm text-red-600">{state.error}</p> : null}

      <Button type="submit" disabled={state.loading} className="w-full">
        {state.loading ? i18n.signup.loading : i18n.signup.submit}
      </Button>

      <Link
        href={withLocalePath(locale, "/login")}
        className="block break-words text-sm font-medium text-sky-700 hover:underline"
      >
        {i18n.signup.toLogin}
      </Link>
    </form>
  );
}
