"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/src/i18n/client";

export function MeetingLiveRefresh({
  enabled,
  reconcileMeetingId,
  intervalMs = 5000,
}: {
  enabled: boolean;
  reconcileMeetingId?: string | null;
  intervalMs?: number;
}) {
  const { i18n } = useI18n();
  const router = useRouter();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const timer = window.setInterval(async () => {
      if (reconcileMeetingId) {
        try {
          await fetch("/api/owner/meetings/reconcile-recording", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ meetingId: reconcileMeetingId }),
          });
        } catch {
          // Best-effort reconciliation; the UI still refreshes even if polling fails.
        }
      }

      router.refresh();
    }, intervalMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [enabled, intervalMs, reconcileMeetingId, router]);

  if (!enabled) {
    return null;
  }

  return <p className="break-words text-xs text-slate-500">{i18n.meeting.autoRefreshActive}</p>;
}
