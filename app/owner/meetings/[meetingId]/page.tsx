import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/src/components/ui/card";
import { MeetingLiveRefresh } from "@/src/components/meetings/meeting-live-refresh";
import { MeetingControlPanel } from "@/src/components/meetings/meeting-control-panel";
import { MinutesEditor } from "@/src/components/meetings/minutes-editor";
import { DeleteMeetingButton } from "@/src/components/meetings/delete-meeting-button";
import { getMeetingById, isMeetingUsable } from "@/src/lib/db/repo";
import { formatDateTime } from "@/src/lib/dates";
import { requireOwnerPage } from "@/src/lib/ui/owner-page";
import { getRequestI18n } from "@/src/i18n/server";
import { withLocalePath } from "@/src/i18n/routing";

export default async function OwnerMeetingPage({
  params,
}: {
  params: Promise<{ meetingId: string }>;
}) {
  const { locale, i18n } = await getRequestI18n();
  const owner = await requireOwnerPage();
  const { meetingId } = await params;

  const meeting = await getMeetingById(meetingId);
  if (!meeting || meeting.orgId !== owner.orgId || !isMeetingUsable(meeting)) {
    notFound();
  }

  const recordingStatus = meeting.recordingStatus ?? "none";
  const canShowFinalArtifacts = recordingStatus === "ready";
  const transcript = canShowFinalArtifacts ? (meeting.transcript ?? meeting.transcripts[0]?.text ?? "") : "";
  const minutesDraft = canShowFinalArtifacts
    ? (meeting.minutesDraft ?? meeting.minutes[0]?.minutesMarkdown ?? "")
    : "";
  const minutesId = meeting.minutes[0]?.id ?? "daily";
  const showRefresh = recordingStatus === "stopping" || recordingStatus === "processing";
  const latestIngestJob = meeting.latestIngestJob;
  const showProcessingError = recordingStatus === "error" || latestIngestJob?.status === "error";
  const isAwaitingDailyConfirmation = recordingStatus === "stopping";
  const isProcessing = latestIngestJob?.status === "processing" || recordingStatus === "processing";
  const dailyRoomUrl = meeting.dailyRoomUrl ?? meeting.meetingUrl ?? null;
  const deleteRedirectHref = meeting.poll
    ? withLocalePath(locale, `/polls/${meeting.poll.id}`)
    : withLocalePath(locale, "/dashboard");

  return (
    <div className="space-y-6">
      <Card className="border-slate-300 shadow-sm">
        <CardHeader>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {i18n.meeting.title}
            </p>
            <h1 className="text-xl font-semibold text-slate-950 sm:text-2xl">{meeting.title}</h1>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700">
          {meeting.scheduledAt ? (
            <p className="font-medium">
              {i18n.meeting.meetingDateLabel}: {formatDateTime(meeting.scheduledAt, locale)}
            </p>
          ) : null}
          {meeting.description ? <p className="break-words text-slate-600">{meeting.description}</p> : null}
        </CardContent>
      </Card>

      <Card className="border-slate-300 shadow-sm">
        <CardHeader>
          <h2 className="text-base font-semibold">{i18n.meeting.controlPanelTitle}</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <MeetingControlPanel
            meetingId={meeting.id}
            meetingUrl={dailyRoomUrl}
            recordingStatus={recordingStatus}
          />
          {showProcessingError ? (
            <div className="space-y-1 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <p className="font-medium">{i18n.meeting.processingErrorTitle}</p>
              <p>{i18n.meeting.processingErrorAction}</p>
            </div>
          ) : null}
          {isAwaitingDailyConfirmation ? (
            <p className="text-sm text-slate-500">{i18n.meeting.recordingPendingWebhook}</p>
          ) : null}
          {isProcessing ? (
            <p className="text-sm text-slate-500">{i18n.meeting.recordingReady}</p>
          ) : null}
          <MeetingLiveRefresh enabled={showRefresh} />
        </CardContent>
      </Card>

      <Card className="border-slate-300 shadow-sm">
        <CardHeader>
          <h2 className="text-base font-semibold">{i18n.meeting.sectionTranscript}</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          {meeting.recordingUrl ? (
            <video
              controls
              className="w-full rounded-md border border-slate-200 bg-slate-950"
              src={meeting.recordingUrl}
            />
          ) : null}
          {canShowFinalArtifacts && transcript ? (
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
              {transcript}
            </pre>
          ) : isAwaitingDailyConfirmation ? (
            <p className="text-sm text-slate-500">{i18n.meeting.transcriptPendingWebhook}</p>
          ) : recordingStatus === "processing" ? (
            <p className="text-sm text-slate-500">{i18n.meeting.transcriptProcessing}</p>
          ) : showProcessingError ? (
            <div className="space-y-1 text-sm text-red-600">
              <p>{i18n.meeting.processingErrorTitle}</p>
              <p>{i18n.meeting.processingErrorAction}</p>
            </div>
          ) : canShowFinalArtifacts ? (
            <p className="text-sm text-slate-500">{i18n.meeting.emptyTranscript}</p>
          ) : (
            <p className="text-sm text-slate-500">{i18n.meeting.transcriptReadyOnly}</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-300 shadow-sm">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold">{i18n.meeting.sectionMinutes}</h2>
          {canShowFinalArtifacts ? (
            <a
              href={`/api/owner/minutes/export?meetingId=${meeting.id}`}
              className="rounded-md border border-slate-300 px-3 py-2 text-center text-sm font-medium transition-colors hover:bg-slate-50"
            >
              {i18n.meeting.exportMinutesMd}
            </a>
          ) : null}
        </CardHeader>
        <CardContent>
          {canShowFinalArtifacts && minutesDraft ? (
            <MinutesEditor meetingId={meeting.id} minutesId={minutesId} initialMarkdown={minutesDraft} />
          ) : isAwaitingDailyConfirmation ? (
            <p className="text-sm text-slate-500">{i18n.meeting.minutesPendingWebhook}</p>
          ) : recordingStatus === "processing" ? (
            <p className="text-sm text-slate-500">{i18n.meeting.minutesProcessing}</p>
          ) : showProcessingError ? (
            <div className="space-y-1 text-sm text-red-600">
              <p>{i18n.meeting.processingErrorTitle}</p>
              <p>{i18n.meeting.processingErrorAction}</p>
            </div>
          ) : canShowFinalArtifacts ? (
            <p className="text-sm text-slate-500">{i18n.meeting.emptyMinutes}</p>
          ) : (
            <p className="text-sm text-slate-500">{i18n.meeting.minutesReadyOnly}</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-red-200 shadow-sm">
        <CardHeader>
          <h2 className="text-base font-semibold text-red-700">{i18n.meeting.deleteTitle}</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">{i18n.meeting.deleteDescription}</p>
          <DeleteMeetingButton meetingId={meeting.id} redirectHref={deleteRedirectHref} />
        </CardContent>
      </Card>
    </div>
  );
}
