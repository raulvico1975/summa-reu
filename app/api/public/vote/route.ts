import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPollBySlug, upsertVoteByVoterId } from "@/src/lib/db/repo";
import { consumeRateLimit } from "@/src/lib/rate-limit";
import {
  generateVoterToken,
  hashVoterToken,
  voterIdFromTokenHash,
} from "@/src/lib/security";
import { ca } from "@/src/i18n/ca";
import { reportApiUnexpectedError } from "@/src/lib/monitoring/report";

export const runtime = "nodejs";

const bodySchema = z.object({
  slug: z.string().min(1),
  voterName: z.string().trim().min(1).max(120),
  voterToken: z.string().min(8).optional(),
  availabilityByOptionId: z.record(z.string(), z.boolean()),
});

export async function POST(request: NextRequest) {
  try {
    const body = bodySchema.parse(await request.json());
    const poll = await getPollBySlug(body.slug);

    if (!poll) {
      return NextResponse.json({ error: ca.errors.pollNotFound }, { status: 404 });
    }

    if (poll.status !== "open") {
      return NextResponse.json({ error: ca.errors.pollClosed }, { status: 400 });
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    const rateKey = `${poll.id}:${ip}`;
    if (!consumeRateLimit(rateKey, 40, 10 * 60_000)) {
      return NextResponse.json({ error: ca.errors.rateLimited }, { status: 429 });
    }

    const optionIds = new Set(poll.options.map((option) => option.id));
    const payloadOptionIds = Object.keys(body.availabilityByOptionId);
    const hasOnlyKnownOptions =
      payloadOptionIds.length > 0 && payloadOptionIds.every((optionId) => optionIds.has(optionId));

    if (!hasOnlyKnownOptions) {
      return NextResponse.json({ error: ca.errors.optionInvalid }, { status: 400 });
    }

    const voterToken = body.voterToken ?? generateVoterToken();
    const tokenHash = hashVoterToken(voterToken);
    const voterId = voterIdFromTokenHash(tokenHash);

    await upsertVoteByVoterId({
      pollId: poll.id,
      voterId,
      voterName: body.voterName,
      tokenHash,
      availabilityByOptionId: body.availabilityByOptionId,
    });

    return NextResponse.json({ voterToken, voterId });
  } catch (error) {
    await reportApiUnexpectedError({
      route: "/api/public/vote",
      action: "intentàvem registrar un vot públic",
      error,
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : ca.errors.invalidPayload },
      { status: 400 }
    );
  }
}
