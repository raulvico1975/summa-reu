import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminAuth } from "@/src/lib/firebase/admin";
import { createOrgForOwner } from "@/src/lib/db/repo";
import { consumeRateLimitServer } from "@/src/lib/rate-limit-server";
import { getRequestI18nFromNextRequest } from "@/src/i18n/request";
import { reportApiUnexpectedError } from "@/src/lib/monitoring/report";
import { getClientIp, isTrustedSameOrigin } from "@/src/lib/security/request";

export const runtime = "nodejs";

const bodySchema = z.object({
  orgName: z.string().trim().min(2).max(160),
  contactName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(120),
});

export async function POST(request: NextRequest) {
  const { i18n } = getRequestI18nFromNextRequest(request);
  let createdUid: string | null = null;

  try {
    if (!isTrustedSameOrigin(request)) {
      return NextResponse.json({ error: i18n.errors.unauthorized }, { status: 403 });
    }

    const ip = getClientIp(request);
    if (!(await consumeRateLimitServer(`signup:${ip}`, 10, 10 * 60_000))) {
      return NextResponse.json({ error: i18n.errors.rateLimited }, { status: 429 });
    }

    const body = bodySchema.parse(await request.json());
    const created = await adminAuth.createUser({
      email: body.email.toLowerCase(),
      password: body.password,
      displayName: body.contactName,
      disabled: false,
    });
    createdUid = created.uid;

    await createOrgForOwner({
      ownerUid: created.uid,
      name: body.orgName,
    });

    return NextResponse.json({ ok: true, uid: created.uid });
  } catch (error) {
    if (createdUid) {
      await adminAuth.deleteUser(createdUid).catch(() => undefined);
    }

    const code =
      typeof error === "object" && error && "code" in error && typeof error.code === "string"
        ? error.code
        : undefined;

    if (code === "auth/email-already-exists") {
      return NextResponse.json({ error: i18n.errors.emailAlreadyExists }, { status: 409 });
    }

    if (code === "auth/weak-password" || code === "auth/invalid-password") {
      return NextResponse.json({ error: i18n.errors.weakPassword }, { status: 400 });
    }

    if (error instanceof Error) {
      await reportApiUnexpectedError({
        route: "/api/auth/entity-signup",
        action: "intentàvem donar d'alta una entitat",
        error,
      });
      return NextResponse.json({ error: i18n.errors.createOrgError }, { status: 400 });
    }

    await reportApiUnexpectedError({
      route: "/api/auth/entity-signup",
      action: "intentàvem donar d'alta una entitat",
      error,
    });
    return NextResponse.json({ error: i18n.errors.createOrgError }, { status: 400 });
  }
}
