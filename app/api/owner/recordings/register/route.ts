import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getMeetingById, registerMeetingRecording } from "@/src/lib/db/repo";
import { getOwnerFromRequest } from "@/src/lib/firebase/auth";
import { ca } from "@/src/i18n/ca";
import { reportApiUnexpectedError } from "@/src/lib/monitoring/report";

export const runtime = "nodejs";

const bodySchema = z.object({
  meetingId: z.string().min(1),
  storagePath: z.string().optional().default(""),
  rawText: z.string().optional().default(""),
  mimeType: z.string().optional(),
  originalName: z.string().optional(),
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

    if (!body.storagePath && !body.rawText.trim()) {
      return NextResponse.json({ error: ca.errors.missingRecordingInput }, { status: 400 });
    }

    const recordingId = await registerMeetingRecording({
      meetingId: body.meetingId,
      storagePath: body.storagePath,
      rawText: body.rawText.trim() || undefined,
      mimeType: body.mimeType,
      originalName: body.originalName,
    });

    return NextResponse.json({ recordingId });
  } catch (error) {
    await reportApiUnexpectedError({
      route: "/api/owner/recordings/register",
      action: "intentàvem registrar una gravació de reunió",
      error,
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : ca.meeting.registerRecordingError },
      { status: 400 }
    );
  }
}
