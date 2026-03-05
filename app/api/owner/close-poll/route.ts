import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { closePollCreateMeeting, getPollById } from "@/src/lib/db/repo";
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

    const body = bodySchema.parse(await request.json());
    const poll = await getPollById(body.pollId);

    if (!poll || poll.orgId !== owner.orgId) {
      return NextResponse.json({ error: i18n.errors.unauthorized }, { status: 403 });
    }

    const meetingId = await closePollCreateMeeting({
      pollId: body.pollId,
      winningOptionId: body.winningOptionId,
    });

    return NextResponse.json({ meetingId });
  } catch (error) {
    await reportApiUnexpectedError({
      route: "/api/owner/close-poll",
      action: "intentàvem tancar una votació i convocar la reunió",
      error,
    });

    return NextResponse.json({ error: i18n.poll.closePollError }, { status: 400 });
  }
}
