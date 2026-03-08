import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getMeetingById, updateMeetingRecordingState } from "@/src/lib/db/repo";
import { getOwnerFromRequest } from "@/src/lib/firebase/auth";
import { reportApiUnexpectedError } from "@/src/lib/monitoring/report";
import { startDailyRecording } from "@/src/lib/meetings/daily";
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

    const body = bodySchema.parse(await request.json());
    const meeting = await getMeetingById(body.meetingId);

    if (!meeting || meeting.orgId !== owner.orgId) {
      return NextResponse.json({ error: i18n.errors.unauthorized }, { status: 403 });
    }

    if (!meeting.meetingUrl) {
      return NextResponse.json({ error: i18n.meeting.missingMeetingUrl }, { status: 400 });
    }

    const currentStatus = meeting.recordingStatus ?? "none";
    if (currentStatus !== "none" && currentStatus !== "ready" && currentStatus !== "error") {
      return NextResponse.json({ error: i18n.meeting.recordingStartInvalidState }, { status: 409 });
    }

    await startDailyRecording(meeting.meetingUrl);
    await updateMeetingRecordingState({
      meetingId: meeting.id,
      recordingStatus: "recording",
      recordingUrl: null,
      clearArtifacts: true,
    });

    console.info("meeting_recording_started", {
      meetingId: meeting.id,
      orgId: meeting.orgId,
      status: "recording",
      reason: "owner_request",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error && error.message === "DAILY_NOT_CONFIGURED"
        ? i18n.errors.dailyNotConfigured
        : i18n.meeting.recordingStartError;

    await reportApiUnexpectedError({
      route: "/api/owner/meetings/start-recording",
      action: "intentàvem iniciar la gravació d'una reunió",
      error,
    });

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
