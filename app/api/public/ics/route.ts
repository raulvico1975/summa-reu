import { NextRequest, NextResponse } from "next/server";
import { getMeetingById } from "@/src/lib/db/repo";
import { buildMeetingIcs } from "@/src/lib/ics";
import { timestampToDate } from "@/src/lib/dates";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const meetingId = request.nextUrl.searchParams.get("meetingId");
  if (!meetingId) {
    return new NextResponse("Missing meetingId", { status: 400 });
  }

  const meeting = await getMeetingById(meetingId);
  if (!meeting) {
    return new NextResponse("Meeting not found", { status: 404 });
  }

  const startsAt = timestampToDate(meeting.scheduledAt);
  if (!startsAt) {
    return new NextResponse("Invalid meeting date", { status: 400 });
  }

  const ics = buildMeetingIcs({
    uid: `meeting-${meeting.id}@summaboard`,
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
}
