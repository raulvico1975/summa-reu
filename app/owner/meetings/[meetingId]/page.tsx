import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/src/components/ui/card";
import { StatusBadge } from "@/src/components/ui/status-badge";
import { MeetingLiveRefresh } from "@/src/components/meetings/meeting-live-refresh";
import { MeetingRecordingControls } from "@/src/components/meetings/meeting-recording-controls";
import { MinutesEditor } from "@/src/components/meetings/minutes-editor";
import { getMeetingById } from "@/src/lib/db/repo";
import { formatDateTime } from "@/src/lib/dates";
import { requireOwnerPage } from "@/src/lib/ui/owner-page";
import { getRequestI18n } from "@/src/i18n/server";

export default async function OwnerMeetingPage({
  params,
}: {
  params: Promise<{ meetingId: string }>;
}) {
  const { locale, i18n } = await getRequestI18n();
  const owner = await requireOwnerPage();
  const { meetingId } = await params;

  const meeting = await getMeetingById(meetingId);
  if (!meeting || meeting.orgId !== owner.orgId) {
    notFound();
  }

  const transcript = meeting.transcript ?? meeting.transcripts[0]?.text ?? "";
  const minutesDraft = meeting.minutesDraft ?? meeting.minutes[0]?.minutesMarkdown ?? "";
  const minutesId = meeting.minutes[0]?.id ?? "daily";
  const recordingStatus = meeting.recordingStatus ?? "none";
  const showRefresh = recordingStatus === "processing";
  const latestIngestJob = meeting.latestIngestJob;
  const showProcessingError = recordingStatus === "error" || latestIngestJob?.status === "error";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">{meeting.title}</h2>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-slate-700">
              {i18n.meeting.recordingStatusLabel}: {i18n.status[recordingStatus]}
            </p>
            <StatusBadge status={recordingStatus} labels={i18n.status} />
          </div>
          {meeting.scheduledAt ? (
            <p>
              {i18n.meeting.meetingDateLabel}: {formatDateTime(meeting.scheduledAt, locale)}
            </p>
          ) : null}
          {meeting.description ? <p className="break-words text-slate-600">{meeting.description}</p> : null}
          {showProcessingError ? (
            <div className="space-y-1 text-sm text-red-600">
              <p>{i18n.meeting.processingErrorTitle}</p>
              <p>{i18n.meeting.processingErrorAction}</p>
            </div>
          ) : null}
          {latestIngestJob?.status === "processing" || recordingStatus === "processing" ? (
            <p className="text-sm text-slate-500">{i18n.meeting.recordingReady}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">{i18n.meeting.sectionCall}</h2>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid gap-2 sm:flex sm:flex-wrap">
            {meeting.meetingUrl ? (
              <a
                href={meeting.meetingUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-md bg-sky-500 px-4 py-2 text-center font-medium text-white transition-colors hover:bg-sky-600"
              >
                {i18n.meeting.enterMeeting}
              </a>
            ) : (
              <span className="rounded-md border border-slate-300 px-3 py-2 text-center font-medium text-slate-500">
                {i18n.meeting.missingMeetingUrl}
              </span>
            )}
            <a
              href={`/api/owner/minutes/export?meetingId=${meeting.id}`}
              className="rounded-md border border-slate-300 px-3 py-2 text-center font-medium transition-colors hover:bg-slate-50"
            >
              {i18n.meeting.exportMinutesMd}
            </a>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">{i18n.meeting.embeddedMeeting}</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-600">{i18n.meeting.embeddedMeetingHint}</p>
          {meeting.meetingUrl ? (
            <iframe
              src={meeting.meetingUrl}
              title={meeting.title}
              className="h-[520px] w-full rounded-md border border-slate-200 bg-white"
              allow="camera; microphone; fullscreen; display-capture"
            />
          ) : (
            <p className="text-sm text-slate-500">{i18n.meeting.missingMeetingUrl}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">{i18n.meeting.sectionRecording}</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <MeetingRecordingControls
            meetingId={meeting.id}
            meetingUrl={meeting.meetingUrl}
            recordingStatus={recordingStatus}
          />
          <MeetingLiveRefresh enabled={showRefresh} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">{i18n.meeting.sectionRecordings}</h2>
        </CardHeader>
        <CardContent>
          {meeting.recordingUrl ? (
            <video
              controls
              className="w-full rounded-md border border-slate-200 bg-slate-950"
              src={meeting.recordingUrl}
            />
          ) : (
            <p className="text-sm text-slate-500">{i18n.meeting.emptyRecordings}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">{i18n.meeting.sectionTranscript}</h2>
        </CardHeader>
        <CardContent>
          {transcript ? (
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
              {transcript}
            </pre>
          ) : recordingStatus === "processing" ? (
            <p className="text-sm text-slate-500">{i18n.meeting.transcriptProcessing}</p>
          ) : showProcessingError ? (
            <div className="space-y-1 text-sm text-red-600">
              <p>{i18n.meeting.processingErrorTitle}</p>
              <p>{i18n.meeting.processingErrorAction}</p>
            </div>
          ) : (
            <p className="text-sm text-slate-500">{i18n.meeting.emptyTranscript}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">{i18n.meeting.sectionMinutes}</h2>
        </CardHeader>
        <CardContent>
          {minutesDraft ? (
            <MinutesEditor meetingId={meeting.id} minutesId={minutesId} initialMarkdown={minutesDraft} />
          ) : recordingStatus === "processing" ? (
            <p className="text-sm text-slate-500">{i18n.meeting.minutesProcessing}</p>
          ) : showProcessingError ? (
            <div className="space-y-1 text-sm text-red-600">
              <p>{i18n.meeting.processingErrorTitle}</p>
              <p>{i18n.meeting.processingErrorAction}</p>
            </div>
          ) : (
            <p className="text-sm text-slate-500">{i18n.meeting.emptyMinutes}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
