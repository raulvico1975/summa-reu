import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { consumeRateLimitServer } from "@/src/lib/rate-limit-server";
import { reportClientRuntimeError } from "@/src/lib/monitoring/report";
import { getClientIp, isTrustedSameOrigin } from "@/src/lib/security/request";

export const runtime = "nodejs";

const bodySchema = z.object({
  kind: z.enum(["error", "unhandledrejection"]),
  page: z.string().min(1).max(180),
  message: z.string().min(1).max(400),
});

export async function POST(request: NextRequest) {
  try {
    if (!isTrustedSameOrigin(request)) {
      return NextResponse.json({ ok: true });
    }

    const ip = getClientIp(request);
    if (!(await consumeRateLimitServer(`client-error:${ip}`, 12, 10 * 60_000))) {
      return NextResponse.json({ ok: true });
    }

    const body = bodySchema.parse(await request.json());
    const key = `${ip}:${body.page}:${body.kind}:${body.message.slice(0, 40)}`;

    await reportClientRuntimeError({
      page: body.page,
      kind: body.kind,
      message: body.message,
      dedupeKey: key,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
