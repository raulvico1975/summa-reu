import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createPollForOrg } from "@/src/lib/db/repo";
import {
  isSubscriptionRequiredError,
  requireActiveSubscription,
  subscriptionRequiredResponse,
} from "@/src/lib/auth/require-active-subscription";
import { getOwnerFromRequest } from "@/src/lib/firebase/auth";
import { getRequestI18nFromNextRequest } from "@/src/i18n/request";
import { reportApiUnexpectedError } from "@/src/lib/monitoring/report";
import { notifyOwnerPollCreated } from "@/src/lib/notifications/poll-email";
import { isTrustedSameOrigin } from "@/src/lib/security/request";

export const runtime = "nodejs";

const bodySchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().max(2000).optional().default(""),
  timezone: z.string().min(3).max(80).optional(),
  optionsIso: z.array(z.string().min(10)).min(1).max(20),
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
    requireActiveSubscription(owner);

    const body = bodySchema.parse(await request.json());
    const validDates = body.optionsIso.filter((value) => !Number.isNaN(new Date(value).getTime()));

    if (validDates.length === 0) {
      return NextResponse.json({ error: i18n.errors.invalidOptionDates }, { status: 400 });
    }

    const created = await createPollForOrg({
      orgId: owner.orgId,
      title: body.title,
      description: body.description,
      timezone: body.timezone,
      optionsIso: validDates,
    });

    notifyOwnerPollCreated({
      orgId: owner.orgId,
      pollTitle: body.title,
      pollSlug: created.slug,
    }).catch(() => {});

    return NextResponse.json(created);
  } catch (error) {
    if (isSubscriptionRequiredError(error)) {
      return subscriptionRequiredResponse();
    }

    await reportApiUnexpectedError({
      route: "/api/owner/polls/create",
      action: "intentàvem crear una votació",
      error,
    });

    return NextResponse.json({ error: i18n.poll.createPollError }, { status: 400 });
  }
}
