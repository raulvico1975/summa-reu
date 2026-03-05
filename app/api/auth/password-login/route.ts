import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { adminAuth } from "@/src/lib/firebase/admin";
import { getOwnerOrgByUid } from "@/src/lib/db/repo";
import { SESSION_COOKIE_NAME } from "@/src/lib/firebase/auth";
import { getRequestI18nFromNextRequest } from "@/src/i18n/request";
import { withLocalePath } from "@/src/i18n/routing";
import { reportApiUnexpectedError } from "@/src/lib/monitoring/report";
import { isTrustedSameOrigin } from "@/src/lib/security/request";

const firebaseApiKey =
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "AIzaSyBcly9Qtk4BrgudbiDAhEhTNCHzNLb6fpM";

const bodySchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(1).max(120),
});

function buildLocalizedUrl(request: NextRequest, pathname: string, params?: Record<string, string>): URL {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }
  return url;
}

async function signInWithPassword(email: string, password: string): Promise<string | null> {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(firebaseApiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    }
  );

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as { idToken?: unknown };
  return typeof data.idToken === "string" && data.idToken.length > 0 ? data.idToken : null;
}

export async function POST(request: NextRequest) {
  const { locale } = getRequestI18nFromNextRequest(request);
  const loginPath = withLocalePath(locale, "/login");
  const dashboardPath = withLocalePath(locale, "/dashboard");

  try {
    if (!isTrustedSameOrigin(request)) {
      return NextResponse.redirect(
        buildLocalizedUrl(request, loginPath, { error: "unauthorized" }),
        303
      );
    }

    const formData = await request.formData();
    const parsed = bodySchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    if (!parsed.success) {
      return NextResponse.redirect(
        buildLocalizedUrl(request, loginPath, { error: "unauthorized" }),
        303
      );
    }

    const idToken = await signInWithPassword(parsed.data.email, parsed.data.password);
    if (!idToken) {
      return NextResponse.redirect(
        buildLocalizedUrl(request, loginPath, { error: "unauthorized" }),
        303
      );
    }

    const decoded = await adminAuth.verifyIdToken(idToken);
    const ownerOrg = await getOwnerOrgByUid(decoded.uid);

    if (!ownerOrg) {
      return NextResponse.redirect(
        buildLocalizedUrl(request, loginPath, { error: "unauthorized" }),
        303
      );
    }

    const expiresIn = 5 * 24 * 60 * 60 * 1000;
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });

    const response = NextResponse.redirect(buildLocalizedUrl(request, dashboardPath), 303);
    response.headers.set("Cache-Control", "no-store");
    response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: expiresIn / 1000,
      sameSite: "strict",
      path: "/",
    });

    return response;
  } catch (error) {
    await reportApiUnexpectedError({
      route: "/api/auth/password-login",
      action: "intentàvem iniciar sessió amb correu i contrasenya",
      error,
    });

    return NextResponse.redirect(
      buildLocalizedUrl(request, loginPath, { error: "unauthorized" }),
      303
    );
  }
}
