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

function buildLocalizedLocation(pathname: string, params?: Record<string, string>): string {
  if (!params || Object.keys(params).length === 0) {
    return pathname;
  }

  const search = new URLSearchParams(params).toString();
  return `${pathname}?${search}`;
}

function redirect303(location: string): NextResponse {
  return new NextResponse(null, {
    status: 303,
    headers: {
      Location: location,
    },
  });
}

async function signInWithPassword(email: string, password: string): Promise<string | null> {
  const authEmulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST?.trim();
  const signInBaseUrl = authEmulatorHost
    ? `http://${authEmulatorHost}/identitytoolkit.googleapis.com/v1`
    : "https://identitytoolkit.googleapis.com/v1";
  const apiKey = authEmulatorHost ? "fake-api-key" : firebaseApiKey;
  const response = await fetch(
    `${signInBaseUrl}/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
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
      return redirect303(buildLocalizedLocation(loginPath, { error: "unauthorized" }));
    }

    const formData = await request.formData();
    const parsed = bodySchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    if (!parsed.success) {
      return redirect303(buildLocalizedLocation(loginPath, { error: "unauthorized" }));
    }

    const idToken = await signInWithPassword(parsed.data.email, parsed.data.password);
    if (!idToken) {
      return redirect303(buildLocalizedLocation(loginPath, { error: "unauthorized" }));
    }

    const decoded = await adminAuth.verifyIdToken(idToken);
    const ownerOrg = await getOwnerOrgByUid(decoded.uid);

    if (!ownerOrg) {
      return redirect303(buildLocalizedLocation(loginPath, { error: "unauthorized" }));
    }

    const expiresIn = 24 * 60 * 60 * 1000;
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });

    const response = redirect303(buildLocalizedLocation(dashboardPath));
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

    return redirect303(buildLocalizedLocation(loginPath, { error: "unauthorized" }));
  }
}
