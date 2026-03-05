"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ca } from "@/src/i18n/ca";

export function MeetingLiveRefresh({
  enabled,
  intervalMs = 5000,
}: {
  enabled: boolean;
  intervalMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const timer = window.setInterval(() => {
      router.refresh();
    }, intervalMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [enabled, intervalMs, router]);

  if (!enabled) {
    return null;
  }

  return <p className="break-words text-xs text-slate-500">{ca.meeting.autoRefreshActive}</p>;
}
