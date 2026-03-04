"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { clientAuth } from "@/src/lib/firebase/client";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/field";
import { ca } from "@/src/i18n/ca";

export function OwnerLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const credential = await signInWithEmailAndPassword(clientAuth, email, password);
      const idToken = await credential.user.getIdToken();

      const sessionRes = await fetch("/api/auth/session-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!sessionRes.ok) {
        throw new Error(ca.errors.unauthorized);
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : ca.login.error);
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">{ca.login.email}</label>
        <Input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">{ca.login.password}</label>
        <Input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? ca.login.loading : ca.login.submit}
      </Button>
    </form>
  );
}
