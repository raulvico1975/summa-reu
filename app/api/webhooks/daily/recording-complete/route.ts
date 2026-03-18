import { NextRequest, NextResponse } from "next/server";
import {
  claimMeetingIngestJob,
  enqueueMeetingIngestJob,
  getMeetingByMeetingUrl,
  updateMeetingIngestJobStatus,
  updateMeetingRecordingState,
} from "@/src/lib/db/repo";
import { processMeetingIngestJob } from "@/src/lib/jobs/processMeetingIngestJob";
import { reportApiUnexpectedError, reportServerUnexpectedError } from "@/src/lib/monitoring/report";
import {
  buildDailyRoomUrl,
  getDailyRecordingLink,
  isAuthorizedDailyWebhook,
} from "@/src/lib/meetings/daily";
import { getRequestI18nFromNextRequest } from "@/src/i18n/request";

export const runtime = "nodejs";

type DailyWebhookPayload = {
  event?: string;
  type?: string;
  room_name?: string;
  recording_id?: string;
  download_link?: string;
  payload?: {
    event?: string;
    type?: string;
    room_name?: string;
    recording_id?: string;
    download_link?: string;
  };
};

export function resolveWebhookValue(
  body: DailyWebhookPayload
): { event: string; roomName: string; recordingId: string | null; recordingUrl: string | null } {
  const event = body.event ?? body.type ?? body.payload?.event ?? body.payload?.type ?? "";
  const roomName = body.payload?.room_name ?? body.room_name ?? "";
  const recordingId = body.payload?.recording_id ?? body.recording_id ?? null;
  const recordingUrl = body.payload?.download_link ?? body.download_link ?? null;

  return { event, roomName, recordingId, recordingUrl };
}

export async function POST(request: NextRequest) {
  const { i18n } = getRequestI18nFromNextRequest(request);

  try {
    if (!isAuthorizedDailyWebhook(request.headers.get("authorization"))) {
      console.warn("meeting_recording_webhook_rejected", {
        meetingId: null,
        recordingId: null,
        orgId: null,
        status: "rejected",
        reason: "unauthorized",
      });
      return NextResponse.json({ error: i18n.errors.dailyWebhookUnauthorized }, { status: 401 });
    }

    const body = (await request.json()) as DailyWebhookPayload;
    const { event, roomName, recordingId, recordingUrl } = resolveWebhookValue(body);

    const isCompletedEvent =
      event === "recording.ready-to-download" ||
      event === "recording.completed" ||
      event === "recording-upload-completed";

    if (!isCompletedEvent || !roomName) {
      console.info("meeting_recording_webhook_rejected", {
        meetingId: null,
        recordingId: recordingId ?? null,
        orgId: null,
        status: "rejected",
        reason: "unexpected_event",
      });
      return NextResponse.json({ ok: true, ignored: true });
    }

    const meeting = await getMeetingByMeetingUrl(buildDailyRoomUrl(roomName));
    if (!meeting) {
      console.info("meeting_recording_webhook_rejected", {
        meetingId: null,
        recordingId: recordingId ?? null,
        orgId: null,
        status: "rejected",
        reason: "meeting_not_found",
      });
      return NextResponse.json({ ok: true, ignored: true });
    }

    const resolvedRecordingId = recordingId ?? `daily-${Date.now()}`;
    const resolvedRecordingUrl =
      recordingUrl ?? (recordingId ? await getDailyRecordingLink(recordingId) : null);

    if (!resolvedRecordingUrl) {
      return NextResponse.json({ error: i18n.errors.dailyWebhookInvalid }, { status: 400 });
    }

    await updateMeetingRecordingState({
      meetingId: meeting.id,
      recordingStatus: "processing",
      recordingUrl: resolvedRecordingUrl,
    });

    console.info("DAILY_RECORDING_COMPLETE", {
      meetingId: meeting.id,
      recordingId: recordingId ?? null,
    });

    // Idempotency key: one ingest job per meetingId + recordingId.
    const enqueued = await enqueueMeetingIngestJob({
      meetingId: meeting.id,
      orgId: meeting.orgId,
      recordingId: resolvedRecordingId,
      recordingUrl: resolvedRecordingUrl,
    });

    if (!enqueued.created) {
      console.info("meeting_recording_webhook_duplicate", {
        meetingId: meeting.id,
        recordingId: resolvedRecordingId,
        orgId: meeting.orgId,
        status: "duplicate",
        reason: "job_exists",
      });
      return NextResponse.json({ ok: true, duplicate: true });
    }

    console.info("meeting_recording_webhook_accepted", {
      meetingId: meeting.id,
      recordingId: resolvedRecordingId,
      orgId: meeting.orgId,
      status: "accepted",
      reason: event,
    });

    void (async () => {
      const claim = await claimMeetingIngestJob(enqueued.jobId);
      if (claim !== "claimed") {
        return;
      }

      try {
        await processMeetingIngestJob({
          meetingId: meeting.id,
          recordingId: resolvedRecordingId,
          recordingUrl: resolvedRecordingUrl,
        });

        await updateMeetingIngestJobStatus({
          jobId: enqueued.jobId,
          status: "completed",
          error: null,
        });
      } catch (error) {
        await updateMeetingRecordingState({
          meetingId: meeting.id,
          recordingStatus: "error",
          recordingUrl: resolvedRecordingUrl,
        });

        await updateMeetingIngestJobStatus({
          jobId: enqueued.jobId,
          status: "error",
          error: error instanceof Error ? error.message : "MEETING_INGEST_UNKNOWN_ERROR",
        });

        console.error("meeting_ingest_job_error", {
          meetingId: meeting.id,
          recordingId: resolvedRecordingId,
          orgId: meeting.orgId,
          status: "error",
          reason: error instanceof Error ? error.message : "MEETING_INGEST_UNKNOWN_ERROR",
        });

        await reportServerUnexpectedError({
          stage: "daily.recording-complete.processMeetingIngestJob",
          error,
          dedupeKey: `daily-recording-complete:${meeting.id}:${resolvedRecordingId}`,
        });
      }
    })();

    return NextResponse.json({ ok: true });
  } catch (error) {
    await reportApiUnexpectedError({
      route: "/api/webhooks/daily/recording-complete",
      action: "intentàvem processar la finalització d'una gravació de Daily",
      error,
    });

    return NextResponse.json({ error: i18n.errors.generic }, { status: 500 });
  }
}
