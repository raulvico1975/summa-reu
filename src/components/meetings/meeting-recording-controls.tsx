"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/src/components/ui/button";
import { useI18n } from "@/src/i18n/client";
import type { MeetingRecordingStatus } from "@/src/lib/db/types";

export function MeetingRecordingControls({
  meetingId,
  meetingUrl,
  recordingStatus,
}: {
  meetingId: string;
  meetingUrl: string | null | undefined;
  recordingStatus: MeetingRecordingStatus | null | undefined;
}) {
  const router = useRouter();
  const { i18n } = useI18n();
  const [state, setState] = useState<{ loading: boolean; error?: string }>({ loading: false });

  async function post(url: string) {
    if (!meetingUrl) {
      setState({ loading: false, error: i18n.meeting.missingMeetingUrl });
      return;
    }

    setState({ loading: true });

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
        details?: string;
      };
      if (!res.ok || !data.ok) {
        if (url === "/api/owner/meetings/start-recording" && res.status === 400) {
          throw new Error(i18n.meeting.recordingStartRequiresParticipant);
        }

        if (data.error === "daily_stop_failed") {
          throw new Error(i18n.meeting.recordingStopActionError);
        }

        throw new Error(data.error ?? data.message ?? i18n.poll.unexpectedError);
      }

      setState({ loading: false });
      router.refresh();
    } catch (error) {
      setState({
        loading: false,
        error: error instanceof Error ? error.message : i18n.poll.unexpectedError,
      });
    }
  }

  const canStartRecording = recordingStatus === "none";
  const canStopRecording = recordingStatus === "recording";

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          onClick={() => post("/api/owner/meetings/start-recording")}
          disabled={state.loading || !meetingUrl || !canStartRecording}
          className="w-full sm:w-auto"
        >
          {i18n.meeting.startRecording}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => post("/api/owner/meetings/stop-recording")}
          disabled={state.loading || !meetingUrl || !canStopRecording}
          className="w-full sm:w-auto"
        >
          {i18n.meeting.stopRecording}
        </Button>
      </div>
      {recordingStatus === "none" ? (
        <p className="text-sm text-slate-600">{i18n.meeting.recordingStartHint}</p>
      ) : null}
      {state.error ? <p className="break-words text-sm text-red-600">{state.error}</p> : null}
    </div>
  );
}
