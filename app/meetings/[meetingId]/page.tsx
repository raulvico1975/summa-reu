import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/src/components/ui/card";
import { StatusBadge } from "@/src/components/ui/status-badge";
import { MeetingLiveRefresh } from "@/src/components/meetings/meeting-live-refresh";
import { RecordingUploader } from "@/src/components/meetings/recording-uploader";
import { MinutesEditor } from "@/src/components/meetings/minutes-editor";
import { getMeetingById } from "@/src/lib/db/repo";
import { formatDateTime } from "@/src/lib/dates";
import { requireOwnerPage } from "@/src/lib/ui/owner-page";
import { ca } from "@/src/i18n/ca";

export default async function MeetingPage({ params }: { params: Promise<{ meetingId: string }> }) {
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
        <h1 className="text-2xl font-semibold">{ca.meeting.title}</h1>
        <p className="text-sm text-slate-600">{meeting.poll.title}</p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">{ca.meeting.sectionCall}</h2>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            {ca.meeting.meetingDateLabel}: {formatDateTime(meeting.scheduledAt)}
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href={`/api/public/ics?meetingId=${meeting.id}`}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              {ca.meeting.exportIcs}
            </a>
            <a
              href={`/api/owner/minutes/export?meetingId=${meeting.id}`}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              {ca.meeting.exportMinutesMd}
            </a>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">{ca.meeting.sectionRecordings}</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <RecordingUploader meetingId={meeting.id} />
          <MeetingLiveRefresh enabled={hasActiveProcessing} />

          <div className="space-y-2">
            {meeting.recordings.length === 0 ? (
              <p className="text-sm text-slate-500">{ca.meeting.emptyRecordings}</p>
            ) : (
              meeting.recordings.map((recording) => (
                <div
                  key={recording.id}
                  className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm"
                >
                  <div>
                    <p>{recording.originalName ?? recording.id}</p>
                    <p className="text-xs text-slate-500">{formatDateTime(recording.createdAt)}</p>
                  </div>
                  <StatusBadge status={recording.status} />
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">{ca.meeting.sectionTranscript}</h2>
        </CardHeader>
        <CardContent>
          {latestTranscript?.text ? (
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
              {latestTranscript.text}
            </pre>
          ) : (
            <p className="text-sm text-slate-500">{ca.meeting.emptyTranscript}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">{ca.meeting.sectionMinutes}</h2>
        </CardHeader>
        <CardContent>
          {latestMinutes ? (
            <MinutesEditor
              meetingId={meeting.id}
              minutesId={latestMinutes.id}
              initialMarkdown={latestMinutes.minutesMarkdown}
            />
          ) : (
            <p className="text-sm text-slate-500">{ca.meeting.emptyMinutes}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
