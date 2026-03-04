"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/src/components/ui/button";
import { Input, Textarea } from "@/src/components/ui/field";
import { defaultTimezone } from "@/src/lib/firebase/env";

export function NewPollForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [timezone, setTimezone] = useState(defaultTimezone);
  const [optionsText, setOptionsText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const optionsIso = optionsText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    try {
      const res = await fetch("/api/owner/polls/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          timezone,
          optionsIso,
        }),
      });

      const data = (await res.json()) as { pollId?: string; error?: string };
      if (!res.ok || !data.pollId) {
        throw new Error(data.error ?? "No s'ha pogut crear la votació");
      }

      router.push(`/polls/${data.pollId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperat");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Títol</label>
        <Input required value={title} onChange={(event) => setTitle(event.target.value)} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Descripció</label>
        <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Fus horari</label>
        <Input required value={timezone} onChange={(event) => setTimezone(event.target.value)} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Opcions (ISO, una línia per opció)</label>
        <Textarea
          required
          value={optionsText}
          onChange={(event) => setOptionsText(event.target.value)}
          rows={6}
          placeholder="2026-03-10T17:00:00.000Z"
        />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button type="submit" disabled={loading}>
        {loading ? "Creant..." : "Crear votació"}
      </Button>
    </form>
  );
}
