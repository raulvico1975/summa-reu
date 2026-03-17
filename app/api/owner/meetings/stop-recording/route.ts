import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getMeetingById, updateMeetingRecordingState } from "@/src/lib/db/repo";
import {
  isSubscriptionRequiredError,
  requireActiveSubscription,
  subscriptionRequiredResponse,
} from "@/src/lib/auth/require-active-subscription";
import { getOwnerFromRequest } from "@/src/lib/firebase/auth";
import { reportApiUnexpectedError } from "@/src/lib/monitoring/report";
import { stopDailyRecording } from "@/src/lib/meetings/daily";
import { isTrustedSameOrigin } from "@/src/lib/security/request";
import { getRequestI18nFromNextRequest } from "@/src/i18n/request";

export const runtime = "nodejs";

const bodySchema = z.object({
  meetingId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const { i18n } = getRequestI18nFromNextRequest(request);

  try {
    if (!isTrustedSameOrigin(request)) {
      return NextResponse.json({ error: i18n.errors.unauthorized }, { status: 403 });
    }

    const owner = await getOwnerFromRequest(request);
    if (!owner) {
      return NextResponse.json({ error: i18n.errors.unauthorized }, { status: 401 });
    }
    requireActiveSubscription(owner);

    const body = bodySchema.parse(await request.json());
    const meeting = await getMeetingById(body.meetingId);

    if (!meeting || meeting.orgId !== owner.orgId) {
      return NextResponse.json({ error: i18n.errors.unauthorized }, { status: 403 });
    }

    if (!meeting.meetingUrl) {
      return NextResponse.json({ error: i18n.meeting.missingMeetingUrl }, { status: 400 });
    }

    if ((meeting.recordingStatus ?? "none") !== "recording") {
      return NextResponse.json({ error: i18n.meeting.recordingStopInvalidState }, { status: 409 });
    }

    try {
      await stopDailyRecording(meeting.meetingUrl);
    } catch (error) {
      await updateMeetingRecordingState({
        meetingId: meeting.id,
        recordingStatus: "error",
      });

      console.error("DAILY_STOP_RECORDING_ERROR", {
        meetingId: meeting.id,
        meetingUrl: meeting.meetingUrl,
        error,
      });

      return NextResponse.json(
        {
          error: "daily_stop_failed",
          message: "Daily no ha pogut aturar la gravació",
          details: String(error),
        },
        { status: 500 }
      );
    }

    await updateMeetingRecordingState({
      meetingId: meeting.id,
      recordingStatus: "stopping",
    });

    console.info("meeting_recording_stopped", {
      meetingId: meeting.id,
      orgId: meeting.orgId,
      status: "stopping",
      reason: "owner_request",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isSubscriptionRequiredError(error)) {
      return subscriptionRequiredResponse();
    }

    const message =
      error instanceof Error && error.message === "DAILY_NOT_CONFIGURED"
        ? i18n.errors.dailyNotConfigured
        : i18n.meeting.recordingStopError;

    await reportApiUnexpectedError({
      route: "/api/owner/meetings/stop-recording",
      action: "intentàvem aturar la gravació d'una reunió",
      error,
    });

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
