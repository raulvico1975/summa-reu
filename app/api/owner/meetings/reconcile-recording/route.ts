import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getMeetingById } from "@/src/lib/db/repo";
import { getOwnerFromRequest } from "@/src/lib/firebase/auth";
import { reportApiUnexpectedError } from "@/src/lib/monitoring/report";
import { reconcileStoppedMeetingRecording } from "@/src/lib/meetings/daily-recording-workflow";
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

    const result = await reconcileStoppedMeetingRecording(meeting.id);
    return NextResponse.json({ ok: true, status: result.status, recordingId: result.recordingId ?? null });
  } catch (error) {
    await reportApiUnexpectedError({
      route: "/api/owner/meetings/reconcile-recording",
      action: "intentàvem reconciliar una gravació aturada",
      error,
    });

    return NextResponse.json({ error: i18n.errors.generic }, { status: 400 });
  }
}
