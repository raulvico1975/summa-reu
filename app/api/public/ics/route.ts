import { NextRequest, NextResponse } from "next/server";
import { getMeetingById } from "@/src/lib/db/repo";
import { buildMeetingIcs } from "@/src/lib/ics";
import { timestampToDate } from "@/src/lib/dates";
import { ca } from "@/src/i18n/ca";
import { reportApiUnexpectedError } from "@/src/lib/monitoring/report";
import { getOwnerFromRequest } from "@/src/lib/firebase/auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const owner = await getOwnerFromRequest(request);
    if (!owner) {
      return new NextResponse(ca.errors.unauthorized, { status: 401 });
    }

    const meetingId = request.nextUrl.searchParams.get("meetingId");
    if (!meetingId) {
      return new NextResponse(ca.errors.missingMeetingId, { status: 400 });
    }

    const meeting = await getMeetingById(meetingId);
    if (!meeting || meeting.orgId !== owner.orgId) {
      return new NextResponse(ca.errors.unauthorized, { status: 403 });
    }

    const startsAt = timestampToDate(meeting.scheduledAt);
    if (!startsAt) {
      return new NextResponse(ca.errors.invalidMeetingDate, { status: 400 });
    }

    const ics = buildMeetingIcs({
      uid: `meeting-${meeting.id}@summareu.app`,
      title: meeting.poll.title,
      description: `Reunió generada des de la votació ${meeting.poll.slug}`,
      startsAt,
      timezone: meeting.poll.timezone,
    });

    return new NextResponse(ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename=meeting-${meeting.id}.ics`,
      },
    });
  } catch (error) {
    await reportApiUnexpectedError({
      route: "/api/public/ics",
      action: "intentàvem generar el fitxer de calendari d'una reunió",
      error,
    });
    return new NextResponse(ca.errors.generic, { status: 500 });
  }
}
