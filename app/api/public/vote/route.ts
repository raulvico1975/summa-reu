import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPollBySlug, upsertVoteByVoterId } from "@/src/lib/db/repo";
import { consumeRateLimitServer } from "@/src/lib/rate-limit-server";
import {
  generateVoterToken,
  hashVoterToken,
  voterIdFromTokenHash,
} from "@/src/lib/security";
import { getRequestI18nFromNextRequest } from "@/src/i18n/request";
import { reportApiUnexpectedError } from "@/src/lib/monitoring/report";
import { getClientIp, isTrustedSameOrigin } from "@/src/lib/security/request";

export const runtime = "nodejs";

const bodySchema = z.object({
  slug: z.string().min(1),
  voterName: z.string().trim().min(1).max(120),
  voterToken: z.string().min(8).optional(),
  availabilityByOptionId: z.record(z.string(), z.boolean()),
});

export async function POST(request: NextRequest) {
  const { i18n } = getRequestI18nFromNextRequest(request);
  try {
    if (!isTrustedSameOrigin(request)) {
      return NextResponse.json({ error: i18n.errors.unauthorized }, { status: 403 });
    }

    const body = bodySchema.parse(await request.json());
    const poll = await getPollBySlug(body.slug);

    if (!poll) {
      return NextResponse.json({ error: i18n.errors.pollNotFound }, { status: 404 });
    }

    if (poll.status !== "open") {
      return NextResponse.json({ error: i18n.errors.pollClosed }, { status: 400 });
    }

    const ip = getClientIp(request);
    const rateKey = `${poll.id}:${ip}`;
    if (!(await consumeRateLimitServer(rateKey, 40, 10 * 60_000))) {
      return NextResponse.json({ error: i18n.errors.rateLimited }, { status: 429 });
    }

    const optionIds = new Set(poll.options.map((option) => option.id));
    const payloadOptionIds = Object.keys(body.availabilityByOptionId);
    const hasOnlyKnownOptions =
      payloadOptionIds.length > 0 && payloadOptionIds.every((optionId) => optionIds.has(optionId));

    if (!hasOnlyKnownOptions) {
      return NextResponse.json({ error: i18n.errors.optionInvalid }, { status: 400 });
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

    return NextResponse.json({ error: i18n.errors.invalidPayload }, { status: 400 });
  }
}
