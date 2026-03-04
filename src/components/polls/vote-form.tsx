"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/field";
import { ca } from "@/src/i18n/ca";

type Option = {
  id: string;
  label: string;
};

export function VoteForm({ slug, options, disabled }: { slug: string; options: Option[]; disabled?: boolean }) {
  const tokenKey = useMemo(() => `summaboard:voterToken:${slug}`, [slug]);

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
      const voterToken = window.localStorage.getItem(tokenKey) ?? undefined;

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
        throw new Error(data.error ?? ca.errors.generic);
      }

      if (data.voterToken) {
        window.localStorage.setItem(tokenKey, data.voterToken);
      }

      setState({ loading: false, message: ca.poll.savedVote });
    } catch (error) {
      setState({
        loading: false,
        error: error instanceof Error ? error.message : ca.errors.generic,
      });
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="voterName">
          {ca.poll.voterName}
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
        <p className="text-sm font-medium text-slate-700">{ca.poll.availability}</p>
        {options.map((option) => (
          <label key={option.id} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
            <span className="text-sm text-slate-700">{option.label}</span>
            <input
              type="checkbox"
              disabled={disabled}
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
          <p className="text-sm font-medium leading-relaxed text-emerald-900">{state.message}</p>
          <Link
            href={`/p/${slug}/results`}
            className="mt-2 inline-flex rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800"
          >
            {ca.poll.viewResults}
          </Link>
        </div>
      ) : null}

      <Button type="submit" disabled={state.loading || disabled}>
        {state.loading ? ca.poll.loadingSaving : ca.poll.submitVote}
      </Button>
    </form>
  );
}
