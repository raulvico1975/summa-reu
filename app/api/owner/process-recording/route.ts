import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  isSubscriptionRequiredError,
  requireActiveSubscription,
  subscriptionRequiredResponse,
} from "@/src/lib/auth/require-active-subscription";
import { getOwnerFromRequest } from "@/src/lib/firebase/auth";
import {
  buildMeetingProcessingDeadline,
  claimRecordingForProcessing,
  getMeetingById,
  getOrgById,
  updateMeetingArtifacts,
  updateMeetingRecordingState,
  updateRecordingStatus,
} from "@/src/lib/db/repo";
import { hasGeminiApiKey } from "@/src/lib/gemini/client";
import { getGeminiFallbackModel, getGeminiModel } from "@/src/lib/gemini/selectModel";
import { processRecordingTask } from "@/src/lib/meetings/process-recording-task";
import { getRequestI18nFromNextRequest } from "@/src/i18n/request";
import {
  reportApiUnexpectedError,
  reportServerUnexpectedError,
} from "@/src/lib/monitoring/report";
import { isTrustedSameOrigin } from "@/src/lib/security/request";

export const runtime = "nodejs";

const bodySchema = z.object({
  meetingId: z.string().min(1),
  recordingId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const { i18n } = getRequestI18nFromNextRequest(request);
  try {
    if (!isTrustedSameOrigin(request)) {
      return NextResponse.json({ error: i18n.errors.unauthorized }, { status: 403 });
    }

    const body = bodySchema.parse(await request.json());
    const owner = await getOwnerFromRequest(request);
    if (!owner) {
      return NextResponse.json({ error: i18n.errors.unauthorized }, { status: 401 });
    }
    requireActiveSubscription(owner);

    const meeting = await getMeetingById(body.meetingId);
    if (!meeting || meeting.orgId !== owner.orgId) {
      return NextResponse.json({ error: i18n.errors.unauthorized }, { status: 403 });
    }

    const claim = await claimRecordingForProcessing({
      meetingId: body.meetingId,
      recordingId: body.recordingId,
    });

    if (claim === "missing") {
      return NextResponse.json({ error: i18n.errors.recordingNotFound }, { status: 404 });
    }

    if (claim === "processing") {
      return NextResponse.json({ ok: true, queued: false, status: "processing" });
    }

    if (claim === "done") {
      return NextResponse.json({ ok: true, queued: false, status: "done" });
    }

    await updateMeetingRecordingState({
      meetingId: body.meetingId,
      recordingStatus: "processing",
      processingDeadlineAt: buildMeetingProcessingDeadline(),
      recoveryState: "retry_running",
      recoveryReason: "manual_upload",
      lastRecoveryAttemptAt: Date.now(),
    });

    const hasKey = hasGeminiApiKey();
    let selectedModel = getGeminiFallbackModel();
    if (hasKey) {
      selectedModel = await getGeminiModel();
    }

    const mode: "stub" | "real" = hasKey ? "real" : "stub";
    const org = await getOrgById(owner.orgId);

    void processRecordingTask({
      meetingId: body.meetingId,
      recordingId: body.recordingId,
      language: org?.language,
    })
      .then(async (result) => {
        await Promise.all([
          updateRecordingStatus({
            meetingId: body.meetingId,
            recordingId: body.recordingId,
            status: "done",
            error: null,
          }),
          updateMeetingArtifacts({
            meetingId: body.meetingId,
            transcript: result.transcriptText,
            minutesDraft: result.minutesMarkdown,
            recordingStatus: "ready",
          }),
        ]);
      })
      .catch(async (error) => {
        const errorMessage =
          error instanceof Error ? error.message : i18n.meeting.processRecordingError;

        await Promise.all([
          updateRecordingStatus({
            meetingId: body.meetingId,
            recordingId: body.recordingId,
            status: "error",
            error: errorMessage,
          }),
          updateMeetingRecordingState({
            meetingId: body.meetingId,
            recordingStatus: "error",
            recoveryState: "retry_failed",
            recoveryReason: "manual_upload",
            lastRecoveryAttemptAt: Date.now(),
          }),
        ]);

        await reportServerUnexpectedError({
          stage: "process-recording.background-task",
          error,
          dedupeKey: `process-recording:${body.meetingId}:${body.recordingId}`,
        });

        console.error("process-recording background error", {
          meetingId: body.meetingId,
          recordingId: body.recordingId,
          error: error instanceof Error ? error.message : String(error),
        });
      });

    return NextResponse.json(
      { ok: true, queued: true, status: "processing", mode, model: selectedModel },
      { status: 202 }
    );
  } catch (error) {
    if (isSubscriptionRequiredError(error)) {
      return subscriptionRequiredResponse();
    }

    await reportApiUnexpectedError({
      route: "/api/owner/process-recording",
      action: "intentàvem processar una gravació de reunió",
      error,
    });

    return NextResponse.json({ error: i18n.errors.invalidPayload }, { status: 400 });
  }
}
