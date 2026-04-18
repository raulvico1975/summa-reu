import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/src/components/ui/card";
import { MeetingLiveRefresh } from "@/src/components/meetings/meeting-live-refresh";
import { MeetingInviteCard } from "@/src/components/meetings/meeting-invite-card";
import { MeetingControlPanel } from "@/src/components/meetings/meeting-control-panel";
import { MeetingResultsPreview } from "@/src/components/meetings/meeting-results-preview";
import { MeetingReadySummary } from "@/src/components/meetings/meeting-ready-summary";
import { MeetingTranscriptViewer } from "@/src/components/meetings/meeting-transcript-viewer";
import { MinutesEditor } from "@/src/components/meetings/minutes-editor";
import { RecordingUploader } from "@/src/components/meetings/recording-uploader";
import { DeleteMeetingButton } from "@/src/components/meetings/delete-meeting-button";
import { getMeetingById, getPollVoteRows, isMeetingProcessingExpired, isMeetingUsable } from "@/src/lib/db/repo";
import { formatDateTime } from "@/src/lib/dates";
import { canDeletePastMeeting } from "@/src/lib/meetings/get-owner-meetings";
import { requireOwnerPage } from "@/src/lib/ui/owner-page";
import { getRequestI18n } from "@/src/i18n/server";
import { withLocalePath } from "@/src/i18n/routing";

function replaceTemplateTokens(template: string, tokens: Record<string, string>) {
  return Object.entries(tokens).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, value),
    template
  );
}

export default async function OwnerMeetingPage({
  params,
  searchParams,
}: {
  params: Promise<{ meetingId: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { locale, i18n } = await getRequestI18n();
  const owner = await requireOwnerPage();
  const { meetingId } = await params;
  const { created } = await searchParams;
  const highlightInvitePack = created === "1";

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
  const isProcessingExpired = isMeetingProcessingExpired(meeting);
  const showProcessingError = recordingStatus === "error" || latestIngestJob?.status === "error";
  const canRetryIngest =
    !!latestIngestJob?.recordingUrl && (recordingStatus === "error" || isProcessingExpired);
  const dailyRoomUrl = meeting.dailyRoomUrl ?? meeting.meetingUrl ?? null;
  const showInvitePack = Boolean(dailyRoomUrl) && recordingStatus !== "ready";
  const showManualRecovery = !canShowFinalArtifacts && (!dailyRoomUrl || showProcessingError || isProcessingExpired);
  const canShowDeleteSection = canDeletePastMeeting(meeting);
  const deleteRedirectHref = meeting.poll
    ? withLocalePath(locale, `/polls/${meeting.poll.id}`)
    : withLocalePath(locale, "/dashboard");
  const participantCount =
    showInvitePack && meeting.poll
      ? (await getPollVoteRows(meeting.poll.id, i18n.poll.participant)).length
      : null;
  const inviteMessage =
    showInvitePack && dailyRoomUrl
      ? replaceTemplateTokens(i18n.meeting.inviteShareMessageTemplate, {
          title: meeting.title,
          date: formatDateTime(meeting.scheduledAt, locale),
          meetingUrl: dailyRoomUrl,
        })
      : "";
  const resultsHref = meeting.poll?.slug ? withLocalePath(locale, `/p/${meeting.poll.slug}/results`) : null;

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

      {showInvitePack && dailyRoomUrl ? (
        <div className={highlightInvitePack ? "rounded-[1.35rem] ring-4 ring-emerald-100/70" : undefined}>
          <MeetingInviteCard
            scheduledLabel={formatDateTime(meeting.scheduledAt, locale)}
            meetingUrl={dailyRoomUrl}
            inviteMessage={inviteMessage}
            participantCount={participantCount ?? undefined}
            resultsHref={resultsHref}
          />
        </div>
      ) : null}

      {canShowFinalArtifacts ? (
        <MeetingReadySummary
          meetingId={meeting.id}
          transcript={transcript}
          minutesMarkdown={minutesDraft}
          hasRecording={Boolean(meeting.recordingUrl)}
          resultsHref={resultsHref}
        />
      ) : (
        <Card className="border-slate-300 shadow-sm">
          <CardHeader>
            <h2 className="text-base font-semibold">{i18n.meeting.controlPanelTitle}</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <MeetingControlPanel
              meetingId={meeting.id}
              meetingUrl={dailyRoomUrl}
              recordingStatus={recordingStatus}
              canRetryIngest={canRetryIngest}
              showMeetingLinkCard={!showInvitePack}
            />
            {showProcessingError ? (
              <div className="space-y-1 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <p className="font-medium">{i18n.meeting.processingErrorTitle}</p>
                <p>{i18n.meeting.processingErrorAction}</p>
              </div>
            ) : null}
            {isProcessingExpired ? (
              <p className="text-sm text-amber-700">{i18n.meeting.processingExpiredHint}</p>
            ) : null}
            <MeetingLiveRefresh
              enabled={showRefresh}
              reconcileMeetingId={recordingStatus === "stopping" ? meeting.id : null}
            />
          </CardContent>
        </Card>
      )}

      {showManualRecovery ? (
        <Card id="manual-recovery" className="border-amber-200 shadow-sm">
          <CardHeader>
            <h2 className="text-base font-semibold text-amber-950">{i18n.meeting.manualRecoveryTitle}</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-700">{i18n.meeting.manualRecoveryBody}</p>
            <RecordingUploader meetingId={meeting.id} />
          </CardContent>
        </Card>
      ) : null}

      {canShowFinalArtifacts ? (
        <>
          <Card id="transcript-section" className="border-slate-300 shadow-sm">
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
              {transcript ? (
                <MeetingTranscriptViewer transcript={transcript} />
              ) : (
                <p className="text-sm text-slate-500">{i18n.meeting.emptyTranscript}</p>
              )}
            </CardContent>
          </Card>

          <Card id="minutes-editor" className="border-slate-300 shadow-sm">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-base font-semibold">{i18n.meeting.sectionMinutes}</h2>
              <a
                href={`/api/owner/minutes/export?meetingId=${meeting.id}`}
                className="rounded-md border border-slate-300 px-3 py-2 text-center text-sm font-medium transition-colors hover:bg-slate-50"
              >
                {i18n.meeting.exportMinutesMd}
              </a>
            </CardHeader>
            <CardContent>
              {minutesDraft ? (
                <MinutesEditor meetingId={meeting.id} minutesId={minutesId} initialMarkdown={minutesDraft} />
              ) : (
                <p className="text-sm text-slate-500">{i18n.meeting.emptyMinutes}</p>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <MeetingResultsPreview recordingStatus={recordingStatus} />
      )}

      {canShowDeleteSection ? (
        <Card className="border-red-200 shadow-sm">
          <CardHeader>
            <h2 className="text-base font-semibold text-red-700">{i18n.meeting.deleteTitle}</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">{i18n.meeting.deleteDescription}</p>
            <DeleteMeetingButton meetingId={meeting.id} redirectHref={deleteRedirectHref} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
