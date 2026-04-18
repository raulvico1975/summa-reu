"use client";

import { useState } from "react";
import { Button } from "@/src/components/ui/button";
import { useI18n } from "@/src/i18n/client";

type CopyState = "idle" | "copied" | "error";

export function MeetingReadySummary({
  meetingId,
  transcript,
  minutesMarkdown,
  hasRecording,
  resultsHref,
}: {
  meetingId: string;
  transcript: string;
  minutesMarkdown: string;
  hasRecording: boolean;
  resultsHref?: string | null;
}) {
  const { i18n } = useI18n();
  const [copyState, setCopyState] = useState<CopyState>("idle");

  async function copyMinutes() {
    try {
      await navigator.clipboard.writeText(minutesMarkdown);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2500);
    } catch {
      setCopyState("error");
      window.setTimeout(() => setCopyState("idle"), 2500);
    }
  }

  return (
    <div className="rounded-2xl border border-emerald-200 bg-[linear-gradient(135deg,#f0fdf4_0%,#ffffff_42%,#ecfeff_100%)] p-5 sm:p-6">
      <div className="max-w-3xl space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
          {i18n.meeting.readySummaryEyebrow}
        </p>
        <h2 className="text-xl font-semibold text-slate-950">{i18n.meeting.readySummaryTitle}</h2>
        <p className="text-sm text-slate-700">{i18n.meeting.readySummaryBody}</p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">{i18n.meeting.readySummaryMinutesTitle}</p>
          <p className="mt-2 text-sm text-slate-600">{i18n.meeting.readySummaryMinutesBody}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">{i18n.meeting.readySummaryTranscriptTitle}</p>
          <p className="mt-2 text-sm text-slate-600">
            {transcript ? i18n.meeting.readySummaryTranscriptBody : i18n.meeting.readySummaryTranscriptEmptyBody}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">{i18n.meeting.readySummaryShareTitle}</p>
          <p className="mt-2 text-sm text-slate-600">
            {hasRecording ? i18n.meeting.readySummaryShareBody : i18n.meeting.readySummaryShareNoRecordingBody}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button type="button" onClick={copyMinutes} className="w-full sm:w-auto">
          {i18n.meeting.copyMinutes}
        </Button>
        <a
          href={`/api/owner/minutes/export?meetingId=${meetingId}`}
          className="inline-flex w-full items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50 sm:w-auto"
        >
          {i18n.meeting.exportMinutesMd}
        </a>
        <a
          href="#minutes-editor"
          className="inline-flex w-full items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50 sm:w-auto"
        >
          {i18n.meeting.reviewMinutes}
        </a>
        <a
          href="#transcript-section"
          className="inline-flex w-full items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50 sm:w-auto"
        >
          {i18n.meeting.reviewTranscript}
        </a>
        {resultsHref ? (
          <a
            href={resultsHref}
            className="inline-flex w-full items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50 sm:w-auto"
          >
            {i18n.meeting.openPublicResults}
          </a>
        ) : null}
      </div>

      {copyState === "copied" ? (
        <p className="mt-3 break-words text-sm text-emerald-700">{i18n.meeting.minutesCopied}</p>
      ) : null}
      {copyState === "error" ? (
        <p className="mt-3 break-words text-sm text-red-700">{i18n.meeting.minutesCopyError}</p>
      ) : null}
    </div>
  );
}
