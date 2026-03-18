"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/src/components/ui/button";
import { useI18n } from "@/src/i18n/client";
import { withLocalePath } from "@/src/i18n/routing";

type Option = {
  id: string;
  label: string;
};

export function ClosePollForm({
  pollId,
  options,
  initialWinningOptionId,
  lockOptionSelection,
  submitLabel,
  loadingLabel,
  helperText,
}: {
  pollId: string;
  options: Option[];
  initialWinningOptionId?: string;
  lockOptionSelection?: boolean;
  submitLabel?: string;
  loadingLabel?: string;
  helperText?: string;
}) {
  const { locale, i18n } = useI18n();
  const router = useRouter();
  const [winningOptionId, setWinningOptionId] = useState(initialWinningOptionId ?? options[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/owner/close-poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pollId, winningOptionId }),
      });

      const data = (await res.json()) as { meetingId?: string; error?: string };
      if (!res.ok || !data.meetingId) {
        throw new Error(data.error ?? i18n.poll.closePollError);
      }

      router.push(withLocalePath(locale, `/owner/meetings/${data.meetingId}`));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : i18n.poll.unexpectedError);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {helperText ? <p className="text-sm text-slate-600">{helperText}</p> : null}
      <select
        value={winningOptionId}
        onChange={(event) => setWinningOptionId(event.target.value)}
        disabled={lockOptionSelection}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>

      {error ? <p className="break-words text-sm text-red-600">{error}</p> : null}

      <Button type="submit" disabled={loading} className="w-full sm:w-auto">
        {loading ? (loadingLabel ?? i18n.poll.loadingClosing) : (submitLabel ?? i18n.poll.closePoll)}
      </Button>
    </form>
  );
}
