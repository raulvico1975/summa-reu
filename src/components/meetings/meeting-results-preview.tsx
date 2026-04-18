"use client";

import { useI18n } from "@/src/i18n/client";
import type { MeetingRecordingStatus } from "@/src/lib/db/types";

export function MeetingResultsPreview({
  recordingStatus,
}: {
  recordingStatus: MeetingRecordingStatus;
}) {
  const { i18n } = useI18n();

  let title = i18n.meeting.resultsPreviewTitle;
  let body = i18n.meeting.resultsPreviewBody;

  if (recordingStatus === "stopping" || recordingStatus === "processing") {
    title = i18n.meeting.resultsPreviewProcessingTitle;
    body = i18n.meeting.resultsPreviewProcessingBody;
  } else if (recordingStatus === "error") {
    title = i18n.meeting.resultsPreviewNeedsHelpTitle;
    body = i18n.meeting.resultsPreviewNeedsHelpBody;
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#ffffff_38%,#ecfeff_100%)] p-5 sm:p-6">
      <div className="max-w-3xl space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
          {i18n.meeting.resultsPreviewEyebrow}
        </p>
        <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
        <p className="text-sm text-slate-700">{body}</p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">{i18n.meeting.resultsPreviewTranscriptTitle}</p>
          <p className="mt-2 text-sm text-slate-600">{i18n.meeting.resultsPreviewTranscriptBody}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">{i18n.meeting.resultsPreviewMinutesTitle}</p>
          <p className="mt-2 text-sm text-slate-600">{i18n.meeting.resultsPreviewMinutesBody}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">{i18n.meeting.resultsPreviewShareTitle}</p>
          <p className="mt-2 text-sm text-slate-600">{i18n.meeting.resultsPreviewShareBody}</p>
        </div>
      </div>

      <p className="mt-4 text-sm text-slate-600">{i18n.meeting.resultsPreviewNextStep}</p>
    </div>
  );
}
