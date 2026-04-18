"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/src/components/ui/button";
import { StatusBadge } from "@/src/components/ui/status-badge";
import { MeetingRecordingControls } from "@/src/components/meetings/meeting-recording-controls";
import { useI18n } from "@/src/i18n/client";
import type { MeetingRecordingStatus } from "@/src/lib/db/types";

type CopyState = "idle" | "copied" | "error";
type JourneyStepState = "upcoming" | "current" | "done";

function getStepClasses(state: JourneyStepState) {
  if (state === "done") {
    return "border-emerald-200 bg-emerald-50 text-emerald-950";
  }

  if (state === "current") {
    return "border-sky-200 bg-sky-50 text-sky-950";
  }

  return "border-slate-200 bg-white text-slate-900";
}

function StepIndicator({
  hasOpenedMeeting,
  meetingAvailable,
  hasCopiedMeetingLink,
  recordingStatus,
}: {
  hasOpenedMeeting: boolean;
  meetingAvailable: boolean;
  hasCopiedMeetingLink: boolean;
  recordingStatus: MeetingRecordingStatus;
}) {
  const { i18n } = useI18n();
  let meetingLinkStepLabel = i18n.meeting.stepShareMeetingLink;
  let recordingStepLabel = i18n.meeting.stepStartRecording;
  let openMeetingState: JourneyStepState = hasOpenedMeeting ? "done" : "current";
  let meetingLinkState: JourneyStepState = meetingAvailable ? "current" : "upcoming";
  let recordingStepState: JourneyStepState = "upcoming";
  const isManualFlowWithoutRoom = !meetingAvailable && recordingStatus !== "none";

  if (!meetingAvailable) {
    meetingLinkStepLabel = i18n.meeting.stepMeetingLinkPending;
  } else if (hasCopiedMeetingLink) {
    meetingLinkStepLabel = i18n.meeting.stepMeetingLinkCopied;
    meetingLinkState = "done";
  }

  if (recordingStatus === "recording") {
    recordingStepLabel = i18n.meeting.stepRecordingActive;
    openMeetingState = "done";
    meetingLinkState = "done";
    recordingStepState = "current";
  } else if (recordingStatus === "stopping") {
    recordingStepLabel = i18n.meeting.stepRecordingStopped;
    openMeetingState = "done";
    meetingLinkState = "done";
    recordingStepState = "current";
  } else if (recordingStatus === "processing") {
    recordingStepLabel = i18n.meeting.stepProcessing;
    openMeetingState = "done";
    meetingLinkState = "done";
    recordingStepState = "current";
  } else if (recordingStatus === "ready") {
    recordingStepLabel = i18n.meeting.stepResultReady;
    openMeetingState = "done";
    meetingLinkState = "done";
    recordingStepState = "done";
  } else if (recordingStatus === "error") {
    recordingStepLabel = i18n.meeting.stepResultError;
    openMeetingState = "done";
    meetingLinkState = "done";
    recordingStepState = "current";
  } else if (meetingAvailable && hasOpenedMeeting) {
    meetingLinkState = hasCopiedMeetingLink ? "done" : "current";
    recordingStepState = "current";
  }

  if (isManualFlowWithoutRoom) {
    if (recordingStatus === "processing") {
      meetingLinkStepLabel = i18n.meeting.stepManualRecovery;
      meetingLinkState = "current";
    } else if (recordingStatus === "ready") {
      meetingLinkStepLabel = i18n.meeting.stepManualResultReady;
      meetingLinkState = "done";
    } else if (recordingStatus === "error") {
      meetingLinkStepLabel = i18n.meeting.stepManualNeedsHelp;
      meetingLinkState = "current";
    }
  }

  return (
    <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-3">
      <div className={`rounded-lg border px-3 py-3 ${getStepClasses(openMeetingState)}`}>
        <p className="font-medium">
          {isManualFlowWithoutRoom
            ? i18n.meeting.stepManualNoRoom
            : hasOpenedMeeting
              ? i18n.meeting.stepMeetingOpened
              : i18n.meeting.stepOpenMeeting}
        </p>
      </div>
      <div className={`rounded-lg border px-3 py-3 ${getStepClasses(meetingLinkState)}`}>
        <p className="font-medium">{meetingLinkStepLabel}</p>
      </div>
      <div className={`rounded-lg border px-3 py-3 ${getStepClasses(recordingStepState)}`}>
        <p className="font-medium">{recordingStepLabel}</p>
      </div>
    </div>
  );
}

function MeetingStatus({
  meetingAvailable,
  recordingStatus,
}: {
  meetingAvailable: boolean;
  recordingStatus: MeetingRecordingStatus;
}) {
  const { i18n } = useI18n();
  const isManualFlowWithoutRoom = !meetingAvailable && recordingStatus !== "none";
  let recordingTitle = i18n.meeting.recordingStateReadyToStartTitle;
  let recordingBody = i18n.meeting.recordingStateReadyToStartBody;
  let badgeStatus: MeetingRecordingStatus = "none";
  let roomTitle = meetingAvailable ? i18n.meeting.roomStateReadyTitle : i18n.meeting.roomStatePendingTitle;
  let roomBody = meetingAvailable ? i18n.meeting.roomStateReadyBody : i18n.meeting.roomStatePendingBody;

  if (recordingStatus === "recording") {
    recordingTitle = i18n.meeting.recordingStateLiveTitle;
    recordingBody = i18n.meeting.recordingStateLiveBody;
    badgeStatus = "recording";
  } else if (recordingStatus === "stopping") {
    recordingTitle = i18n.meeting.recordingStateClosingTitle;
    recordingBody = i18n.meeting.recordingStateClosingBody;
    badgeStatus = "stopping";
  } else if (recordingStatus === "processing") {
    recordingTitle = i18n.meeting.recordingStateProcessingTitle;
    recordingBody = i18n.meeting.recordingStateProcessingBody;
    badgeStatus = "processing";
  } else if (recordingStatus === "ready") {
    recordingTitle = i18n.meeting.recordingStateReadyTitle;
    recordingBody = i18n.meeting.recordingStateReadyBody;
    badgeStatus = "ready";
  } else if (recordingStatus === "error") {
    recordingTitle = i18n.meeting.recordingStateNeedsHelpTitle;
    recordingBody = i18n.meeting.recordingStateNeedsHelpBody;
    badgeStatus = "error";
  }

  if (isManualFlowWithoutRoom) {
    roomTitle =
      recordingStatus === "ready" ? i18n.meeting.roomStateManualReadyTitle : i18n.meeting.roomStateManualFlowTitle;
    roomBody =
      recordingStatus === "ready" ? i18n.meeting.roomStateManualReadyBody : i18n.meeting.roomStateManualFlowBody;
  }

  return (
    <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm sm:grid-cols-2">
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          {i18n.meeting.roomStatusLabel}
        </p>
        <p className="mt-2 text-base font-semibold text-slate-900">
          {roomTitle}
        </p>
        <p className="mt-1 text-sm text-slate-600">{roomBody}</p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          {i18n.meeting.recordingStatusLabel}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge status={badgeStatus} labels={i18n.status} />
        </div>
        <p className="mt-2 text-base font-semibold text-slate-900">{recordingTitle}</p>
        <p className="mt-1 text-sm text-slate-600">{recordingBody}</p>
      </div>
    </div>
  );
}

function buildContextMessage(
  i18n: ReturnType<typeof useI18n>["i18n"],
  recordingStatus: MeetingRecordingStatus,
  meetingAvailable: boolean
) {
  if (!meetingAvailable && recordingStatus !== "none") {
    if (recordingStatus === "ready") {
      return i18n.meeting.contextManualReady;
    }

    if (recordingStatus === "error") {
      return i18n.meeting.contextManualError;
    }

    return i18n.meeting.contextManualFlow;
  }

  switch (recordingStatus) {
    case "recording":
      return i18n.meeting.contextRecording;
    case "stopping":
      return i18n.meeting.contextStopping;
    case "processing":
      return i18n.meeting.contextProcessing;
    case "ready":
      return i18n.meeting.contextReady;
    case "error":
      return i18n.meeting.contextError;
    case "none":
    default:
      return i18n.meeting.contextNone;
  }
}

export function MeetingControlPanel({
  meetingId,
  meetingUrl,
  recordingStatus,
  canRetryIngest,
  showMeetingLinkCard = true,
}: {
  meetingId: string;
  meetingUrl: string | null;
  recordingStatus: MeetingRecordingStatus;
  canRetryIngest?: boolean;
  showMeetingLinkCard?: boolean;
}) {
  const router = useRouter();
  const { i18n } = useI18n();
  const [openedMeeting, setOpenedMeeting] = useState(false);
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [retryState, setRetryState] = useState<{ loading: boolean; error?: string }>({ loading: false });

  const meetingAvailable = Boolean(meetingUrl);
  const hasOpenedMeeting = openedMeeting || recordingStatus !== "none";
  const hasCopiedMeetingLink = copyState === "copied";
  const contextMessage = buildContextMessage(i18n, recordingStatus, meetingAvailable);
  const showManualNoRoomHint = !meetingAvailable && recordingStatus !== "none";

  async function copyMeetingLink() {
    if (!meetingUrl) {
      setCopyState("error");
      window.setTimeout(() => setCopyState("idle"), 2500);
      return;
    }

    try {
      await navigator.clipboard.writeText(meetingUrl);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2500);
    } catch {
      setCopyState("error");
      window.setTimeout(() => setCopyState("idle"), 2500);
    }
  }

  async function retryIngest() {
    setRetryState({ loading: true });

    try {
      const res = await fetch("/api/owner/meetings/retry-ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? i18n.meeting.retryIngestUnavailable);
      }

      setRetryState({ loading: false });
      router.refresh();
    } catch (error) {
      setRetryState({
        loading: false,
        error: error instanceof Error ? error.message : i18n.meeting.retryIngestUnavailable,
      });
    }
  }

  return (
    <div className="space-y-4">
      <StepIndicator
        hasOpenedMeeting={hasOpenedMeeting}
        meetingAvailable={meetingAvailable}
        hasCopiedMeetingLink={hasCopiedMeetingLink}
        recordingStatus={recordingStatus}
      />

      <div className="rounded-2xl border border-slate-200 bg-[linear-gradient(135deg,#e0f2fe_0%,#ffffff_42%,#f8fafc_100%)] p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
              {i18n.meeting.controlPanelEyebrow}
            </p>
            <h2 className="text-xl font-semibold text-slate-950">{i18n.meeting.controlPanelTitle}</h2>
            <p className="text-sm text-slate-600">{contextMessage}</p>
          </div>

          <div className="w-full lg:max-w-xs">
            {showManualNoRoomHint ? (
              <div className="rounded-xl border border-sky-200 bg-white px-4 py-3 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">{i18n.meeting.noMeetingRoomNeededTitle}</p>
                <p className="mt-1 text-slate-600">{i18n.meeting.noMeetingRoomNeededBody}</p>
              </div>
            ) : (
              <Button
                type="button"
                className="min-h-12 w-full text-base"
                disabled={!meetingUrl}
                onClick={() => {
                  if (!meetingUrl) {
                    return;
                  }
                  window.open(meetingUrl, "_blank", "noopener,noreferrer");
                  setOpenedMeeting(true);
                }}
              >
                {i18n.meeting.enterMeeting}
              </Button>
            )}
          </div>
        </div>

        {showMeetingLinkCard && meetingAvailable && meetingUrl ? (
          <div className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {i18n.meeting.meetingLinkLabel}
                </p>
                <p className="mt-2 break-all rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700">
                  {meetingUrl}
                </p>
                <p className="mt-2 text-sm text-slate-600">{i18n.meeting.meetingLinkHint}</p>
              </div>
              <Button type="button" variant="secondary" onClick={copyMeetingLink} className="w-full sm:w-auto">
                {i18n.meeting.copyMeetingLink}
              </Button>
            </div>
            {copyState === "copied" ? (
              <p className="mt-2 break-words text-xs text-emerald-700">{i18n.meeting.meetingLinkCopied}</p>
            ) : null}
            {copyState === "error" ? (
              <p className="mt-2 break-words text-xs text-red-700">{i18n.meeting.meetingLinkCopyError}</p>
            ) : null}
          </div>
        ) : null}

        {openedMeeting ? (
          <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
            <p className="font-medium">{i18n.meeting.meetingOpenedBannerTitle}</p>
            <p className="mt-1 text-sky-800">{i18n.meeting.meetingOpenedBannerBody}</p>
          </div>
        ) : null}

        {!meetingAvailable ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {i18n.meeting.roomCreateError}
          </div>
        ) : null}

        {canRetryIngest ? (
          <div className="mt-4 space-y-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p>{i18n.meeting.retryIngestHint}</p>
            <Button type="button" variant="secondary" disabled={retryState.loading} onClick={retryIngest}>
              {retryState.loading ? i18n.meeting.retryIngestRunning : i18n.meeting.retryIngest}
            </Button>
            {retryState.error ? <p className="break-words text-sm text-red-700">{retryState.error}</p> : null}
          </div>
        ) : null}
      </div>

      <MeetingRecordingControls
        meetingId={meetingId}
        meetingUrl={meetingUrl}
        recordingStatus={recordingStatus}
      />

      <MeetingStatus meetingAvailable={meetingAvailable} recordingStatus={recordingStatus} />
    </div>
  );
}
