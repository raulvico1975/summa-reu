import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminAuth } from "@/src/lib/firebase/admin";
import { createOrgForOwner } from "@/src/lib/db/repo";
import { consumeRateLimit } from "@/src/lib/rate-limit";
import { ca } from "@/src/i18n/ca";

export const runtime = "nodejs";

const bodySchema = z.object({
  orgName: z.string().trim().min(2).max(160),
  contactName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(120),
});

export async function POST(request: NextRequest) {
  let createdUid: string | null = null;

  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (!consumeRateLimit(`signup:${ip}`, 10, 10 * 60_000)) {
      return NextResponse.json({ error: ca.errors.rateLimited }, { status: 429 });
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
      return NextResponse.json({ error: ca.errors.emailAlreadyExists }, { status: 409 });
    }

    if (code === "auth/weak-password" || code === "auth/invalid-password") {
      return NextResponse.json({ error: ca.errors.weakPassword }, { status: 400 });
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: ca.errors.createOrgError }, { status: 400 });
  }
}
