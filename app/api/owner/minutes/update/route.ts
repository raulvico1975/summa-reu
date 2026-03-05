import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getMeetingById, updateMinutesMarkdown } from "@/src/lib/db/repo";
import { getOwnerFromRequest } from "@/src/lib/firebase/auth";
import { getRequestI18nFromNextRequest } from "@/src/i18n/request";
import { reportApiUnexpectedError } from "@/src/lib/monitoring/report";
import { isTrustedSameOrigin } from "@/src/lib/security/request";

export const runtime = "nodejs";

const bodySchema = z.object({
  meetingId: z.string().min(1),
  minutesId: z.string().min(1),
  minutesMarkdown: z.string().min(1),
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

    await updateMinutesMarkdown({
      meetingId: body.meetingId,
      minutesId: body.minutesId,
      minutesMarkdown: body.minutesMarkdown,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    await reportApiUnexpectedError({
      route: "/api/owner/minutes/update",
      action: "intentàvem desar canvis a l'acta",
      error,
    });

    return NextResponse.json({ error: i18n.meeting.saveMinutesError }, { status: 400 });
  }
}
