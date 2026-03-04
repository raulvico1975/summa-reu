import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getMeetingById, updateMinutesMarkdown } from "@/src/lib/db/repo";
import { getOwnerFromRequest } from "@/src/lib/firebase/auth";
import { ca } from "@/src/i18n/ca";
import { reportApiUnexpectedError } from "@/src/lib/monitoring/report";

export const runtime = "nodejs";

const bodySchema = z.object({
  meetingId: z.string().min(1),
  minutesId: z.string().min(1),
  minutesMarkdown: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const owner = await getOwnerFromRequest(request);
    if (!owner) {
      return NextResponse.json({ error: ca.errors.unauthorized }, { status: 401 });
    }

    const body = bodySchema.parse(await request.json());
    const meeting = await getMeetingById(body.meetingId);

    if (!meeting || meeting.orgId !== owner.orgId) {
      return NextResponse.json({ error: ca.errors.unauthorized }, { status: 403 });
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

    return NextResponse.json(
      { error: error instanceof Error ? error.message : ca.meeting.saveMinutesError },
      { status: 400 }
    );
  }
}
