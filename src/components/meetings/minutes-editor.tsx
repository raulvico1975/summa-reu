"use client";

import { useState } from "react";
import { Button } from "@/src/components/ui/button";
import { Textarea } from "@/src/components/ui/field";
import { ca } from "@/src/i18n/ca";

export function MinutesEditor({
  meetingId,
  minutesId,
  initialMarkdown,
}: {
  meetingId: string;
  minutesId: string;
  initialMarkdown: string;
}) {
  const [value, setValue] = useState(initialMarkdown);
  const [state, setState] = useState<{ loading: boolean; message?: string; error?: string }>({
    loading: false,
  });

  async function onSave() {
    setState({ loading: true });

    try {
      const res = await fetch("/api/owner/minutes/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId, minutesId, minutesMarkdown: value }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? ca.meeting.saveMinutesError);
      }

      setState({ loading: false, message: ca.meeting.minutesSaved });
    } catch (error) {
      setState({
        loading: false,
        error: error instanceof Error ? error.message : ca.poll.unexpectedError,
      });
    }
  }

  return (
    <div className="space-y-3">
      <Textarea rows={14} value={value} onChange={(event) => setValue(event.target.value)} />
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.message ? <p className="text-sm text-emerald-700">{state.message}</p> : null}
      <Button type="button" onClick={onSave} disabled={state.loading}>
        {state.loading ? ca.meeting.savingMinutes : ca.meeting.saveMinutes}
      </Button>
    </div>
  );
}
