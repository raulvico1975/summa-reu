import {
  buildMeetingProcessingDeadline,
  claimMeetingIngestJob,
  enqueueMeetingIngestJob,
  getMeetingById,
  updateMeetingIngestJobStatus,
  updateMeetingRecordingState,
} from "@/src/lib/db/repo";
import { reportServerUnexpectedError } from "@/src/lib/monitoring/report";
import {
  getDailyRecordingLink,
  getLatestFinishedDailyRecording,
} from "@/src/lib/meetings/daily";
import { processMeetingIngestJob } from "@/src/lib/jobs/processMeetingIngestJob";

export async function acceptDailyRecordingForMeeting(input: {
  meetingId: string;
  orgId: string;
  recordingId: string;
  recordingUrl: string;
  reason: string;
  markWebhookAt?: boolean;
}): Promise<{ ok: true; duplicate: boolean; jobId: string }> {
  const enqueued = await enqueueMeetingIngestJob({
    meetingId: input.meetingId,
    orgId: input.orgId,
    recordingId: input.recordingId,
    recordingUrl: input.recordingUrl,
  });

  if (!enqueued.created) {
    console.info("meeting_recording_ingest_duplicate", {
      meetingId: input.meetingId,
      recordingId: input.recordingId,
      orgId: input.orgId,
      status: "duplicate",
      reason: input.reason,
    });
    return { ok: true, duplicate: true, jobId: enqueued.jobId };
  }

  await updateMeetingRecordingState({
    meetingId: input.meetingId,
    recordingStatus: "processing",
    recordingUrl: input.recordingUrl,
    processingDeadlineAt: buildMeetingProcessingDeadline(),
    recoveryState: null,
    recoveryReason: null,
    lastWebhookAt: input.markWebhookAt ? Date.now() : undefined,
  });

  void runDailyRecordingIngest({
    meetingId: input.meetingId,
    orgId: input.orgId,
    recordingId: input.recordingId,
    recordingUrl: input.recordingUrl,
    jobId: enqueued.jobId,
    reason: input.reason,
  });

  return { ok: true, duplicate: false, jobId: enqueued.jobId };
}

async function runDailyRecordingIngest(input: {
  meetingId: string;
  orgId: string;
  recordingId: string;
  recordingUrl: string;
  jobId: string;
  reason: string;
}): Promise<void> {
  const claim = await claimMeetingIngestJob(input.jobId);
  if (claim !== "claimed") {
    return;
  }

  try {
    await processMeetingIngestJob({
      meetingId: input.meetingId,
      recordingId: input.recordingId,
      recordingUrl: input.recordingUrl,
    });

    await updateMeetingIngestJobStatus({
      jobId: input.jobId,
      status: "completed",
      error: null,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "MEETING_INGEST_UNKNOWN_ERROR";

    await updateMeetingRecordingState({
      meetingId: input.meetingId,
      recordingStatus: "error",
      recordingUrl: input.recordingUrl,
      recoveryState: "retry_pending",
      recoveryReason: reason,
    });

    await updateMeetingIngestJobStatus({
      jobId: input.jobId,
      status: "error",
      error: reason,
      lastErrorAt: Date.now(),
    });

    console.error("meeting_ingest_job_error", {
      meetingId: input.meetingId,
      recordingId: input.recordingId,
      orgId: input.orgId,
      status: "error",
      reason,
    });

    await reportServerUnexpectedError({
      stage: `daily-recording-ingest.${input.reason}`,
      error,
      dedupeKey: `daily-recording-ingest:${input.meetingId}:${input.recordingId}`,
    });
  }
}

export async function reconcileStoppedMeetingRecording(meetingId: string): Promise<{
  status: "meeting_not_found" | "not_waiting" | "recording_not_ready" | "accepted" | "duplicate";
  recordingId?: string;
}> {
  const meeting = await getMeetingById(meetingId);
  if (!meeting) {
    return { status: "meeting_not_found" };
  }

  if (meeting.recordingStatus !== "stopping" || !meeting.meetingUrl) {
    return { status: "not_waiting" };
  }

  const latest = await getLatestFinishedDailyRecording(meeting.meetingUrl);
  if (!latest) {
    return { status: "recording_not_ready" };
  }

  const recordingUrl = await getDailyRecordingLink(latest.recordingId);
  const accepted = await acceptDailyRecordingForMeeting({
    meetingId: meeting.id,
    orgId: meeting.orgId,
    recordingId: latest.recordingId,
    recordingUrl,
    reason: "reconcile",
  });

  return {
    status: accepted.duplicate ? "duplicate" : "accepted",
    recordingId: latest.recordingId,
  };
}
