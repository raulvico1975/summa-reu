import { NextResponse } from "next/server";
import { z } from "zod";
import { adminAuth } from "@/src/lib/firebase/admin";
import { SESSION_COOKIE_NAME } from "@/src/lib/firebase/auth";
import { getOwnerOrgByUid } from "@/src/lib/db/repo";

const bodySchema = z.object({
  idToken: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const expiresIn = 5 * 24 * 60 * 60 * 1000;
    const decoded = await adminAuth.verifyIdToken(body.idToken);
    const ownerOrg = await getOwnerOrgByUid(decoded.uid);

    if (!ownerOrg) {
      return NextResponse.json({ error: "No autoritzat" }, { status: 403 });
    }

    const sessionCookie = await adminAuth.createSessionCookie(body.idToken, {
      expiresIn,
    });

    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: expiresIn / 1000,
      sameSite: "lax",
      path: "/",
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No autoritzat" },
      { status: 401 }
    );
  }
}
