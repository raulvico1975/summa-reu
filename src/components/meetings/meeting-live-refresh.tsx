"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/src/i18n/client";

export function MeetingLiveRefresh({
  enabled,
  intervalMs = 5000,
}: {
  enabled: boolean;
  intervalMs?: number;
}) {
  const { i18n } = useI18n();
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

  return <p className="break-words text-xs text-slate-500">{i18n.meeting.autoRefreshActive}</p>;
}
