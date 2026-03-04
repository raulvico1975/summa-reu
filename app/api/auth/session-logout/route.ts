import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/src/lib/firebase/auth";
import { isTrustedSameOrigin } from "@/src/lib/security/request";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  if (!isTrustedSameOrigin(request)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const response = NextResponse.json({ ok: true });
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    sameSite: "strict",
    path: "/",
  });

  return response;
}
