"use client";

import { useState } from "react";
import { Button } from "@/src/components/ui/button";
import { useI18n } from "@/src/i18n/client";
import { withLocalePath } from "@/src/i18n/routing";
import { cn } from "@/src/lib/cn";

type CopyState = "idle" | "copied" | "error";

export function CopyVoteLinkButton({ slug, className }: { slug: string; className?: string }) {
  const { locale, i18n } = useI18n();
  const [state, setState] = useState<CopyState>("idle");

  async function handleCopy() {
    const voteUrl = new URL(withLocalePath(locale, `/p/${slug}`), window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(voteUrl);
      setState("copied");
      window.setTimeout(() => setState("idle"), 2500);
    } catch {
      setState("error");
      window.setTimeout(() => setState("idle"), 2500);
    }
  }

  return (
    <div className={cn("flex w-full flex-col items-start gap-2 sm:w-auto sm:flex-row sm:items-center", className)}>
      <Button type="button" variant="secondary" onClick={handleCopy} className="w-full sm:w-auto">
        {i18n.poll.copyVoteLink}
      </Button>
      {state === "copied" ? (
        <span className="break-words text-xs text-emerald-700">{i18n.poll.voteLinkCopied}</span>
      ) : null}
      {state === "error" ? (
        <span className="break-words text-xs text-red-700">{i18n.poll.voteLinkCopyError}</span>
      ) : null}
    </div>
  );
}
