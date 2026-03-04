import type { NextRequest } from "next/server";

function normalizeHost(input: string): string {
  return input.trim().toLowerCase().replace(/\.$/, "").replace(/:\d+$/, "");
}

function getRequestHost(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0] ?? "";
  const fhRequestedHost = request.headers.get("x-fh-requested-host")?.split(",")[0] ?? "";
  const host = request.headers.get("host")?.split(",")[0] ?? "";
  return normalizeHost(fhRequestedHost || forwardedHost || host);
}

export function getClientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export function isTrustedSameOrigin(request: NextRequest): boolean {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return true;
  }

  const host = getRequestHost(request);
  if (!host) {
    return false;
  }

  const origin = request.headers.get("origin");
  if (!origin) {
    const fetchSite = request.headers.get("sec-fetch-site");
    if (fetchSite === "same-origin" || fetchSite === "same-site") {
      return true;
    }

    return process.env.NODE_ENV !== "production";
  }

  try {
    const originHost = normalizeHost(new URL(origin).host);
    return originHost === host;
  } catch {
    return false;
  }
}
