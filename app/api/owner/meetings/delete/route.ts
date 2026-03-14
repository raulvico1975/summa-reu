import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { deleteMeetingById, getMeetingById } from "@/src/lib/db/repo";
import {
  isSubscriptionRequiredError,
  requireActiveSubscription,
  subscriptionRequiredResponse,
} from "@/src/lib/auth/require-active-subscription";
import { getOwnerFromRequest } from "@/src/lib/firebase/auth";
import { canDeletePastMeeting } from "@/src/lib/meetings/get-owner-meetings";
import { reportApiUnexpectedError } from "@/src/lib/monitoring/report";
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

    if (!meeting) {
      return NextResponse.json({ error: i18n.errors.meetingNotFound }, { status: 404 });
    }

    if (meeting.orgId !== owner.orgId) {
      return NextResponse.json({ error: i18n.errors.unauthorized }, { status: 403 });
    }

    if (!canDeletePastMeeting(meeting)) {
      return NextResponse.json({ error: i18n.meeting.deleteOnlyPastError }, { status: 409 });
    }

    await deleteMeetingById(meeting.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isSubscriptionRequiredError(error)) {
      return subscriptionRequiredResponse();
    }

    await reportApiUnexpectedError({
      route: "/api/owner/meetings/delete",
      action: "intentàvem eliminar una reunió",
      error,
    });

    return NextResponse.json({ error: i18n.meeting.deleteError }, { status: 400 });
  }
}
