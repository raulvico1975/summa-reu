import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { closePollCreateMeeting, getPollById } from "@/src/lib/db/repo";
import { getOwnerFromRequest } from "@/src/lib/firebase/auth";

export const runtime = "nodejs";

const bodySchema = z.object({
  pollId: z.string().min(1),
  winningOptionId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const owner = await getOwnerFromRequest(request);
    if (!owner) {
      return NextResponse.json({ error: "No autoritzat" }, { status: 401 });
    }

    const body = bodySchema.parse(await request.json());
    const poll = await getPollById(body.pollId);

    if (!poll || poll.orgId !== owner.orgId) {
      return NextResponse.json({ error: "No autoritzat" }, { status: 403 });
    }

    const meetingId = await closePollCreateMeeting({
      pollId: body.pollId,
      winningOptionId: body.winningOptionId,
    });

    return NextResponse.json({ meetingId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No s'ha pogut tancar la votació" },
      { status: 400 }
    );
  }
}
