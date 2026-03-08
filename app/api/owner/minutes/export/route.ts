import { NextRequest, NextResponse } from "next/server";
import { getOwnerFromRequest } from "@/src/lib/firebase/auth";
import { getMeetingById } from "@/src/lib/db/repo";
import { getRequestI18nFromNextRequest } from "@/src/i18n/request";
import { reportApiUnexpectedError } from "@/src/lib/monitoring/report";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { i18n } = getRequestI18nFromNextRequest(request);
  try {
    const owner = await getOwnerFromRequest(request);
    if (!owner) {
      return new NextResponse(i18n.errors.unauthorized, { status: 401 });
    }

    const meetingId = request.nextUrl.searchParams.get("meetingId");
    if (!meetingId) {
      return new NextResponse(i18n.errors.missingMeetingId, { status: 400 });
    }

    const meeting = await getMeetingById(meetingId);
    if (!meeting || meeting.orgId !== owner.orgId) {
      return new NextResponse(i18n.errors.unauthorized, { status: 403 });
    }

    const latestMinutes = meeting.minutes[0];
    const markdown = meeting.minutesDraft ?? latestMinutes?.minutesMarkdown ?? null;
    if (!markdown) {
      return new NextResponse(i18n.errors.minutesNotFound, { status: 404 });
    }

    return new NextResponse(markdown, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename=acta-${meeting.id}.md`,
      },
    });
  } catch (error) {
    await reportApiUnexpectedError({
      route: "/api/owner/minutes/export",
      action: "intentàvem exportar una acta",
      error,
    });
    return new NextResponse(i18n.errors.generic, { status: 500 });
  }
}
