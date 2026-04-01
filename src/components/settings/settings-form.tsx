"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/field";
import { useI18n } from "@/src/i18n/client";

type SettingsFormProps = {
  section: "orgName" | "language" | "password" | "delete";
  initialOrgName: string;
  initialLanguage: string;
};

export function SettingsForm({ section, initialOrgName, initialLanguage }: SettingsFormProps) {
  if (section === "orgName") return <OrgNameSection initialName={initialOrgName} />;
  if (section === "language") return <LanguageSection initialLanguage={initialLanguage} />;
  if (section === "password") return <PasswordSection />;
  return <DeleteSection orgName={initialOrgName} />;
}

function OrgNameSection({ initialName }: { initialName: string }) {
  const { i18n } = useI18n();
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [state, setState] = useState<{ loading: boolean; message?: string; error?: string }>({
    loading: false,
  });

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ loading: true });

    try {
      const res = await fetch("/api/owner/account/update-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!res.ok) throw new Error();
      setState({ loading: false, message: i18n.settings.orgNameSaved });
      router.refresh();
    } catch {
      setState({ loading: false, error: i18n.settings.orgNameError });
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Input
        required
        minLength={2}
        maxLength={160}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.message ? <p className="text-sm text-emerald-700">{state.message}</p> : null}
      <Button type="submit" disabled={state.loading}>
        {state.loading ? i18n.settings.orgNameSaving : i18n.settings.orgNameSave}
      </Button>
    </form>
  );
}

function LanguageSection({ initialLanguage }: { initialLanguage: string }) {
  const { i18n } = useI18n();
  const router = useRouter();
  const [language, setLanguage] = useState(initialLanguage);
  const [state, setState] = useState<{ loading: boolean; message?: string; error?: string }>({
    loading: false,
  });

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ loading: true });

    try {
      const res = await fetch("/api/owner/account/update-language", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language }),
      });

      if (!res.ok) throw new Error();
      setState({ loading: false, message: i18n.settings.languageSaved });
      router.refresh();
    } catch {
      setState({ loading: false, error: i18n.settings.languageError });
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
      >
        <option value="ca">{i18n.signup.languageCa}</option>
        <option value="es">{i18n.signup.languageEs}</option>
      </select>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.message ? <p className="text-sm text-emerald-700">{state.message}</p> : null}
      <Button type="submit" disabled={state.loading}>
        {state.loading ? i18n.settings.languageSaving : i18n.settings.languageSave}
      </Button>
    </form>
  );
}

function PasswordSection() {
  const { i18n } = useI18n();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState<{ loading: boolean; message?: string; error?: string }>({
    loading: false,
  });

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirm) {
      setState({ loading: false, error: i18n.settings.passwordMismatch });
      return;
    }

    setState({ loading: true });

    try {
      const res = await fetch("/api/owner/account/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) throw new Error();
      setPassword("");
      setConfirm("");
      setState({ loading: false, message: i18n.settings.passwordSaved });
    } catch {
      setState({ loading: false, error: i18n.settings.passwordError });
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          {i18n.settings.newPassword}
        </label>
        <Input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          {i18n.settings.confirmPassword}
        </label>
        <Input
          type="password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.message ? <p className="text-sm text-emerald-700">{state.message}</p> : null}
      <Button type="submit" disabled={state.loading}>
        {state.loading ? i18n.settings.passwordSaving : i18n.settings.passwordSave}
      </Button>
    </form>
  );
}

function DeleteSection({ orgName }: { orgName: string }) {
  const { locale, i18n } = useI18n();
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [state, setState] = useState<{ loading: boolean; error?: string }>({ loading: false });

  const canDelete = confirmation === orgName;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canDelete) return;

    setState({ loading: true });

    try {
      const res = await fetch("/api/owner/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) throw new Error();
      router.push(locale === "es" ? "/es" : "/");
      router.refresh();
    } catch {
      setState({ loading: false, error: i18n.settings.deleteError });
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <p className="text-sm text-slate-700">
        {i18n.settings.deleteConfirm} <strong>{orgName}</strong>
      </p>
      <Input
        required
        value={confirmation}
        onChange={(e) => setConfirmation(e.target.value)}
        placeholder={orgName}
      />
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <Button
        type="submit"
        disabled={!canDelete || state.loading}
        className="bg-red-600 hover:bg-red-700"
      >
        {state.loading ? i18n.settings.deleteDeleting : i18n.settings.deleteButton}
      </Button>
    </form>
  );
}
