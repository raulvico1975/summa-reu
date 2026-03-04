import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const CANONICAL_HOST = process.env.CANONICAL_HOST ?? "summa-board.app";
const FORCE_CANONICAL_REDIRECT = process.env.FORCE_CANONICAL_REDIRECT === "true";

function isLocalHost(host: string): boolean {
  return host.startsWith("127.0.0.1") || host.startsWith("localhost");
}

export function middleware(request: NextRequest) {
  if (!FORCE_CANONICAL_REDIRECT) {
    return NextResponse.next();
  }

  const host =
    request.headers.get("x-fh-requested-host")?.toLowerCase() ??
    request.headers.get("x-forwarded-host")?.toLowerCase() ??
    request.headers.get("host")?.toLowerCase() ??
    "";

  if (!host || isLocalHost(host) || host === CANONICAL_HOST) {
    return NextResponse.next();
  }

  if (host.endsWith(".web.app") || host.endsWith(".firebaseapp.com")) {
    const nextUrl = request.nextUrl.clone();
    nextUrl.protocol = "https";
    nextUrl.hostname = CANONICAL_HOST;
    nextUrl.port = "";
    return NextResponse.redirect(nextUrl, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
