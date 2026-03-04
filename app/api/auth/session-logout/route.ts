import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/src/lib/firebase/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    sameSite: "lax",
    path: "/",
  });

  return response;
}
