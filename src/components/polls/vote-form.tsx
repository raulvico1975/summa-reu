"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/field";
import { useI18n } from "@/src/i18n/client";
import { withLocalePath } from "@/src/i18n/routing";

type Option = {
  id: string;
  label: string;
};

function normalizeVoterName(value: string): string {
  return value.trim().toLowerCase();
}

function readStoredTokensByName(key: string): Record<string, string> {
  const raw = window.localStorage.getItem(key);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};

    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string"
      )
    );
  } catch {
    return {};
  }
}

export function VoteForm({ slug, options, disabled }: { slug: string; options: Option[]; disabled?: boolean }) {
  const { locale, i18n } = useI18n();
  const tokensByNameKey = useMemo(() => `summareu:voterTokensByName:${slug}`, [slug]);
  const legacyTokenKey = useMemo(() => `summareu:voterToken:${slug}`, [slug]);

  const [voterName, setVoterName] = useState("");
  const [availability, setAvailability] = useState<Record<string, boolean>>(
    Object.fromEntries(options.map((option) => [option.id, false]))
  );
  const [state, setState] = useState<{ loading: boolean; message?: string; error?: string }>({
    loading: false,
  });

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ loading: true });

    try {
      const normalizedVoterName = normalizeVoterName(voterName);
      const storedTokensByName = readStoredTokensByName(tokensByNameKey);
      const voterToken = storedTokensByName[normalizedVoterName];

      const res = await fetch("/api/public/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          voterName,
          voterToken,
          availabilityByOptionId: availability,
        }),
      });

      const data = (await res.json()) as { voterToken?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? i18n.errors.generic);
      }

      if (data.voterToken) {
        storedTokensByName[normalizedVoterName] = data.voterToken;
        window.localStorage.setItem(tokensByNameKey, JSON.stringify(storedTokensByName));
        window.localStorage.removeItem(legacyTokenKey);
      }

      setState({ loading: false, message: i18n.poll.savedVote });
    } catch (error) {
      setState({
        loading: false,
        error: error instanceof Error ? error.message : i18n.errors.generic,
      });
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="voterName">
          {i18n.poll.voterName}
        </label>
        <Input
          id="voterName"
          required
          disabled={disabled}
          value={voterName}
          onChange={(event) => setVoterName(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-700">{i18n.poll.availability}</p>
        {options.map((option) => (
          <label
            key={option.id}
            className="flex items-start justify-between gap-3 rounded-md border border-slate-200 px-3 py-2"
          >
            <span className="min-w-0 break-words text-sm text-slate-700">{option.label}</span>
            <input
              type="checkbox"
              disabled={disabled}
              className="mt-0.5 h-4 w-4 shrink-0 accent-sky-600"
              checked={Boolean(availability[option.id])}
              onChange={(event) =>
                setAvailability((current) => ({
                  ...current,
                  [option.id]: event.target.checked,
                }))
              }
            />
          </label>
        ))}
      </div>

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.message ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="break-words text-sm font-medium leading-relaxed text-emerald-900">{state.message}</p>
          <Link
            href={withLocalePath(locale, `/p/${slug}/results`)}
            className="mt-2 inline-flex rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800"
          >
            {i18n.poll.viewResults}
          </Link>
        </div>
      ) : null}

      <Button type="submit" disabled={state.loading || disabled} className="w-full sm:w-auto">
        {state.loading ? i18n.poll.loadingSaving : i18n.poll.submitVote}
      </Button>
    </form>
  );
}
