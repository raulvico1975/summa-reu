import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createMeetingForOrg } from "@/src/lib/db/repo";
import {
  isSubscriptionRequiredError,
  requireActiveSubscription,
  subscriptionRequiredResponse,
} from "@/src/lib/auth/require-active-subscription";
import { getOwnerFromRequest } from "@/src/lib/firebase/auth";
import { reportApiUnexpectedError } from "@/src/lib/monitoring/report";
import { createDailyRoom } from "@/src/lib/meetings/daily";
import { isTrustedSameOrigin } from "@/src/lib/security/request";
import { getRequestI18nFromNextRequest } from "@/src/i18n/request";

export const runtime = "nodejs";

const bodySchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(5000).optional(),
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
    const dailyRoom = await createDailyRoom({ title: body.title });
    const meetingId = await createMeetingForOrg({
      orgId: owner.orgId,
      title: body.title,
      description: body.description,
      createdBy: owner.uid,
      meetingUrl: dailyRoom.meetingUrl,
    });

    return NextResponse.json({ meetingId });
  } catch (error) {
    if (isSubscriptionRequiredError(error)) {
      return subscriptionRequiredResponse();
    }

    const message =
      error instanceof Error && error.message === "DAILY_NOT_CONFIGURED"
        ? i18n.errors.dailyNotConfigured
        : i18n.errors.invalidPayload;

    await reportApiUnexpectedError({
      route: "/api/owner/meetings/create",
      action: "intentàvem crear una reunió",
      error,
    });

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
