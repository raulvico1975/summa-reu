import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminAuth } from "@/src/lib/firebase/admin";
import { getOwnerFromRequest } from "@/src/lib/firebase/auth";
import { getRequestI18nFromNextRequest } from "@/src/i18n/request";
import { isTrustedSameOrigin } from "@/src/lib/security/request";

export const runtime = "nodejs";

const bodySchema = z.object({
  password: z.string().min(8).max(120),
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

    const body = bodySchema.parse(await request.json());
    await adminAuth.updateUser(owner.uid, { password: body.password });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: i18n.settings.passwordError }, { status: 400 });
  }
}
