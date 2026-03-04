import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createPollForOrg } from "@/src/lib/db/repo";
import { getOwnerFromRequest } from "@/src/lib/firebase/auth";
import { ca } from "@/src/i18n/ca";
import { reportApiUnexpectedError } from "@/src/lib/monitoring/report";

export const runtime = "nodejs";

const bodySchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().max(2000).optional().default(""),
  timezone: z.string().min(3).max(80).optional(),
  optionsIso: z.array(z.string().min(10)).min(1).max(20),
});

export async function POST(request: NextRequest) {
  try {
    const owner = await getOwnerFromRequest(request);
    if (!owner) {
      return NextResponse.json({ error: ca.errors.unauthorized }, { status: 401 });
    }

    const body = bodySchema.parse(await request.json());
    const validDates = body.optionsIso.filter((value) => !Number.isNaN(new Date(value).getTime()));

    if (validDates.length === 0) {
      return NextResponse.json({ error: ca.errors.invalidOptionDates }, { status: 400 });
    }

    const created = await createPollForOrg({
      orgId: owner.orgId,
      title: body.title,
      description: body.description,
      timezone: body.timezone,
      optionsIso: validDates,
    });

    return NextResponse.json(created);
  } catch (error) {
    await reportApiUnexpectedError({
      route: "/api/owner/polls/create",
      action: "intentàvem crear una votació",
      error,
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : ca.poll.createPollError },
      { status: 400 }
    );
  }
}
