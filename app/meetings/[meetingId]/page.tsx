import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/src/components/ui/card";
import { StatusBadge } from "@/src/components/ui/status-badge";
import { MeetingLiveRefresh } from "@/src/components/meetings/meeting-live-refresh";
import { RecordingUploader } from "@/src/components/meetings/recording-uploader";
import { MinutesEditor } from "@/src/components/meetings/minutes-editor";
import { getMeetingById } from "@/src/lib/db/repo";
import { formatDateTime } from "@/src/lib/dates";
import { requireOwnerPage } from "@/src/lib/ui/owner-page";
import { getRequestI18n } from "@/src/i18n/server";

export default async function MeetingPage({ params }: { params: Promise<{ meetingId: string }> }) {
  const { locale, i18n } = await getRequestI18n();
  const owner = await requireOwnerPage();
  const { meetingId } = await params;

  const meeting = await getMeetingById(meetingId);
  if (!meeting || meeting.orgId !== owner.orgId) {
    notFound();
  }

  const latestTranscript = meeting.transcripts[0];
  const latestMinutes = meeting.minutes[0];
  const hasActiveProcessing = meeting.recordings.some(
    (recording) => recording.status === "uploaded" || recording.status === "processing"
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{i18n.meeting.title}</h1>
        <p className="mt-1 break-words text-sm text-slate-600">{meeting.poll.title}</p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">{i18n.meeting.sectionCall}</h2>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            {i18n.meeting.meetingDateLabel}: {formatDateTime(meeting.scheduledAt, locale)}
          </p>
          <div className="grid gap-2 sm:flex sm:flex-wrap">
            <a
              href={`/api/public/ics?meetingId=${meeting.id}`}
              className="rounded-md border border-slate-300 px-3 py-2 text-center text-sm font-medium transition-colors hover:bg-slate-50"
            >
              {i18n.meeting.exportIcs}
            </a>
            <a
              href={`/api/owner/minutes/export?meetingId=${meeting.id}`}
              className="rounded-md border border-slate-300 px-3 py-2 text-center text-sm font-medium transition-colors hover:bg-slate-50"
            >
              {i18n.meeting.exportMinutesMd}
            </a>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">{i18n.meeting.sectionRecordings}</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <RecordingUploader meetingId={meeting.id} />
          <MeetingLiveRefresh enabled={hasActiveProcessing} />

          <div className="space-y-2">
            {meeting.recordings.length === 0 ? (
              <p className="text-sm text-slate-500">{i18n.meeting.emptyRecordings}</p>
            ) : (
              meeting.recordings.map((recording) => (
                <div
                  key={recording.id}
                  className="flex flex-col gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="break-all">{recording.originalName ?? recording.id}</p>
                    <p className="text-xs text-slate-500">{formatDateTime(recording.createdAt, locale)}</p>
                  </div>
                  <StatusBadge status={recording.status} labels={i18n.status} />
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">{i18n.meeting.sectionTranscript}</h2>
        </CardHeader>
        <CardContent>
          {latestTranscript?.text ? (
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
              {latestTranscript.text}
            </pre>
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
          {latestMinutes ? (
            <MinutesEditor
              meetingId={meeting.id}
              minutesId={latestMinutes.id}
              initialMarkdown={latestMinutes.minutesMarkdown}
            />
          ) : (
            <p className="text-sm text-slate-500">{i18n.meeting.emptyMinutes}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
