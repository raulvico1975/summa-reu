"use client";

import { useState } from "react";
import { Button } from "@/src/components/ui/button";
import { useI18n } from "@/src/i18n/client";

type CopyState = "idle" | "copied" | "error";

export function MeetingInviteCard({
  scheduledLabel,
  meetingUrl,
  inviteMessage,
  participantCount,
  resultsHref,
}: {
  scheduledLabel: string;
  meetingUrl: string;
  inviteMessage: string;
  participantCount?: number;
  resultsHref?: string | null;
}) {
  const { i18n } = useI18n();
  const [messageState, setMessageState] = useState<CopyState>("idle");
  const [linkState, setLinkState] = useState<CopyState>("idle");

  async function copyText(
    value: string,
    onStateChange: (state: CopyState) => void
  ) {
    try {
      await navigator.clipboard.writeText(value);
      onStateChange("copied");
      window.setTimeout(() => onStateChange("idle"), 2500);
    } catch {
      onStateChange("error");
      window.setTimeout(() => onStateChange("idle"), 2500);
    }
  }

  return (
    <div className="rounded-2xl border border-emerald-200 bg-[linear-gradient(135deg,#ecfdf5_0%,#ffffff_46%,#f0fdf4_100%)] p-5 sm:p-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
          {i18n.meeting.inviteReadyEyebrow}
        </p>
        <h2 className="text-xl font-semibold text-slate-950">{i18n.meeting.inviteReadyTitle}</h2>
        <p className="max-w-3xl text-sm text-slate-700">{i18n.meeting.inviteReadyBody}</p>
        {typeof participantCount === "number" ? (
          <p className="text-sm font-medium text-emerald-900">
            {i18n.meeting.inviteReadyParticipantsHint.replace("{count}", String(participantCount))}
          </p>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-3 rounded-xl border border-emerald-100 bg-white p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              {i18n.meeting.meetingDateLabel}
            </p>
            <p className="mt-2 text-sm font-medium text-slate-900">{scheduledLabel}</p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              {i18n.meeting.meetingLinkLabel}
            </p>
            <p className="mt-2 break-all rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700">
              {meetingUrl}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              type="button"
              onClick={() => copyText(inviteMessage, setMessageState)}
              className="w-full sm:w-auto"
            >
              {i18n.meeting.copyInviteMessage}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => copyText(meetingUrl, setLinkState)}
              className="w-full sm:w-auto"
            >
              {i18n.meeting.copyMeetingLink}
            </Button>
            {resultsHref ? (
              <a
                href={resultsHref}
                className="inline-flex max-w-full items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-center text-sm font-medium leading-tight text-slate-900 transition-colors hover:bg-slate-50"
              >
                {i18n.poll.openPublicResults}
              </a>
            ) : null}
          </div>

          {messageState === "copied" ? (
            <p className="break-words text-xs text-emerald-700">{i18n.meeting.inviteMessageCopied}</p>
          ) : null}
          {messageState === "error" ? (
            <p className="break-words text-xs text-red-700">{i18n.meeting.inviteMessageCopyError}</p>
          ) : null}
          {linkState === "copied" ? (
            <p className="break-words text-xs text-emerald-700">{i18n.meeting.meetingLinkCopied}</p>
          ) : null}
          {linkState === "error" ? (
            <p className="break-words text-xs text-red-700">{i18n.meeting.meetingLinkCopyError}</p>
          ) : null}
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              {i18n.meeting.invitePreviewLabel}
            </p>
            <pre className="mt-2 whitespace-pre-wrap break-words rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              {inviteMessage}
            </pre>
          </div>
          <p className="text-sm text-slate-600">{i18n.meeting.inviteReadyNextStep}</p>
        </div>
      </div>
    </div>
  );
}
