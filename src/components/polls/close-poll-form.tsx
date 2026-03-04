"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/src/components/ui/button";

type Option = {
  id: string;
  label: string;
};

export function ClosePollForm({ pollId, options }: { pollId: string; options: Option[] }) {
  const router = useRouter();
  const [winningOptionId, setWinningOptionId] = useState(options[0]?.id ?? "");
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
        throw new Error(data.error ?? "No s'ha pogut tancar la votació.");
      }

      router.push(`/meetings/${data.meetingId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperat");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <select
        value={winningOptionId}
        onChange={(event) => setWinningOptionId(event.target.value)}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Button type="submit" disabled={loading}>
        {loading ? "Tancant..." : "Tancar votació"}
      </Button>
    </form>
  );
}
