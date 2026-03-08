import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { closePollCreateMeeting, getPollById } from "@/src/lib/db/repo";
import {
  isSubscriptionRequiredError,
  requireActiveSubscription,
  subscriptionRequiredResponse,
} from "@/src/lib/auth/require-active-subscription";
import { getOwnerFromRequest } from "@/src/lib/firebase/auth";
import { getRequestI18nFromNextRequest } from "@/src/i18n/request";
import { reportApiUnexpectedError } from "@/src/lib/monitoring/report";
import { isTrustedSameOrigin } from "@/src/lib/security/request";

export const runtime = "nodejs";

const bodySchema = z.object({
  pollId: z.string().min(1),
  winningOptionId: z.string().min(1),
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
    const poll = await getPollById(body.pollId);

    if (!poll || poll.orgId !== owner.orgId) {
      return NextResponse.json({ error: i18n.errors.unauthorized }, { status: 403 });
    }

    const meetingId = await closePollCreateMeeting({
      pollId: body.pollId,
      winningOptionId: body.winningOptionId,
      createdBy: owner.uid,
    });

    return NextResponse.json({ meetingId });
  } catch (error) {
    if (isSubscriptionRequiredError(error)) {
      return subscriptionRequiredResponse();
    }

    await reportApiUnexpectedError({
      route: "/api/owner/close-poll",
      action: "intentàvem tancar una votació i convocar la reunió",
      error,
    });

    const message =
      error instanceof Error && error.message === "DAILY_NOT_CONFIGURED"
        ? i18n.errors.dailyNotConfigured
        : i18n.poll.closePollError;

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
